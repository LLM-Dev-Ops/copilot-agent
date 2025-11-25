#!/bin/bash
# PostgreSQL Backup Script with S3 Integration
# Version: 1.0.0
# Description: Automated backup with compression, encryption, and retention policy

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

# Database Configuration
DB_NAME="${POSTGRES_DB:-llm_copilot_agent}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Backup Configuration
BACKUP_DIR="${BACKUP_DIR:-/backup/postgresql}"
WAL_DIR="${WAL_DIR:-/backup/wal}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# S3 Configuration
S3_ENABLED="${S3_ENABLED:-false}"
S3_BUCKET="${S3_BUCKET:-llm-copilot-backups}"
S3_REGION="${S3_REGION:-us-east-1}"
S3_PREFIX="postgresql"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y%m%d)
MONTH=$(date +%Y/%m)

# Filenames
BACKUP_FILE="${BACKUP_DIR}/full_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_CHECKSUM="${BACKUP_FILE}.sha256"
BACKUP_METADATA="${BACKUP_FILE}.metadata.json"

# Logging
LOG_FILE="${BACKUP_DIR}/backup_${DATE}.log"

# ============================================================================
# Functions
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "${LOG_FILE}" >&2
}

# Create necessary directories
setup_directories() {
    log "Creating backup directories..."
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "${WAL_DIR}"
    mkdir -p "$(dirname "${LOG_FILE}")"
}

# Verify PostgreSQL connection
verify_connection() {
    log "Verifying PostgreSQL connection..."
    if ! PGPASSWORD="${POSTGRES_PASSWORD}" pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
        error "Cannot connect to PostgreSQL at ${DB_HOST}:${DB_PORT}"
        return 1
    fi
    log "PostgreSQL connection verified"
}

# Perform full backup
perform_backup() {
    log "Starting full backup of database: ${DB_NAME}"

    local start_time=$(date +%s)

    # Perform backup with compression
    if PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -Fc \
        -Z 6 \
        "${DB_NAME}" \
        | gzip > "${BACKUP_FILE}"; then

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local size=$(du -h "${BACKUP_FILE}" | cut -f1)

        log "Backup completed successfully: ${BACKUP_FILE}"
        log "Size: ${size}, Duration: ${duration}s"

        # Create checksum
        sha256sum "${BACKUP_FILE}" > "${BACKUP_CHECKSUM}"
        log "Checksum created: ${BACKUP_CHECKSUM}"

        # Create metadata
        create_metadata "${size}" "${duration}"

        return 0
    else
        error "Backup failed!"
        return 1
    fi
}

# Create backup metadata
create_metadata() {
    local size=$1
    local duration=$2

    cat > "${BACKUP_METADATA}" <<EOF
{
    "backup_type": "full",
    "database": "${DB_NAME}",
    "timestamp": "${TIMESTAMP}",
    "date": "$(date -Iseconds)",
    "host": "${DB_HOST}",
    "port": ${DB_PORT},
    "size": "${size}",
    "duration_seconds": ${duration},
    "compression": "gzip",
    "format": "custom",
    "pg_version": "$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -t -c "SELECT version();")",
    "hostname": "$(hostname)",
    "backup_file": "${BACKUP_FILE}"
}
EOF

    log "Metadata created: ${BACKUP_METADATA}"
}

# Archive WAL files
archive_wal_files() {
    log "Archiving WAL files..."

    if [ -d "${WAL_DIR}" ] && [ "$(ls -A ${WAL_DIR})" ]; then
        local wal_count=$(ls -1 "${WAL_DIR}" | wc -l)
        log "Found ${wal_count} WAL files to archive"

        # Clean up old WAL files (keep last 24 hours)
        find "${WAL_DIR}" -type f -mtime +1 -delete

        log "WAL archiving completed"
    else
        log "No WAL files to archive"
    fi
}

# Upload to S3
upload_to_s3() {
    if [ "${S3_ENABLED}" != "true" ]; then
        log "S3 upload disabled, skipping..."
        return 0
    fi

    log "Uploading backup to S3..."

    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found, cannot upload to S3"
        return 1
    fi

    # Upload backup file
    if aws s3 cp "${BACKUP_FILE}" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/${MONTH}/$(basename ${BACKUP_FILE})" \
        --region "${S3_REGION}" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --metadata "db=${DB_NAME},timestamp=${TIMESTAMP},type=full"; then
        log "Backup uploaded to S3 successfully"
    else
        error "Failed to upload backup to S3"
        return 1
    fi

    # Upload checksum
    aws s3 cp "${BACKUP_CHECKSUM}" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/${MONTH}/$(basename ${BACKUP_CHECKSUM})" \
        --region "${S3_REGION}" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256

    # Upload metadata
    aws s3 cp "${BACKUP_METADATA}" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/${MONTH}/$(basename ${BACKUP_METADATA})" \
        --region "${S3_REGION}" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256

    # Upload WAL files if they exist
    if [ -d "${WAL_DIR}" ] && [ "$(ls -A ${WAL_DIR})" ]; then
        aws s3 sync "${WAL_DIR}" \
            "s3://${S3_BUCKET}/${S3_PREFIX}/wal/${MONTH}/" \
            --region "${S3_REGION}" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        log "WAL files uploaded to S3"
    fi
}

# Apply retention policy
apply_retention_policy() {
    log "Applying retention policy (${RETENTION_DAYS} days)..."

    # Delete local backups older than retention period
    local deleted_count=$(find "${BACKUP_DIR}" \
        -name "full_*.sql.gz" \
        -type f \
        -mtime +${RETENTION_DAYS} \
        -delete \
        -print | wc -l)

    if [ ${deleted_count} -gt 0 ]; then
        log "Deleted ${deleted_count} old backup(s)"
    else
        log "No old backups to delete"
    fi

    # Delete associated metadata and checksum files
    find "${BACKUP_DIR}" \
        -name "full_*.sha256" \
        -type f \
        -mtime +${RETENTION_DAYS} \
        -delete

    find "${BACKUP_DIR}" \
        -name "full_*.metadata.json" \
        -type f \
        -mtime +${RETENTION_DAYS} \
        -delete
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."

    # Verify checksum
    if sha256sum -c "${BACKUP_CHECKSUM}" >/dev/null 2>&1; then
        log "Checksum verification passed"
    else
        error "Checksum verification failed!"
        return 1
    fi

    # Test restore (to a test database)
    # Uncomment to enable full restore testing
    # log "Testing backup restore..."
    # if PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore -l "${BACKUP_FILE}" >/dev/null 2>&1; then
    #     log "Backup restore test passed"
    # else
    #     error "Backup restore test failed!"
    #     return 1
    # fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2

    # Implement notification logic (email, Slack, etc.)
    # Example using mail command:
    # echo "${message}" | mail -s "Backup ${status}: ${DB_NAME}" admin@example.com

    log "Notification: ${status} - ${message}"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log "=========================================="
    log "PostgreSQL Backup Started"
    log "Database: ${DB_NAME}"
    log "Host: ${DB_HOST}:${DB_PORT}"
    log "=========================================="

    # Setup
    setup_directories

    # Verify connection
    if ! verify_connection; then
        send_notification "FAILED" "Cannot connect to database"
        exit 1
    fi

    # Perform backup
    if ! perform_backup; then
        send_notification "FAILED" "Backup operation failed"
        exit 1
    fi

    # Verify backup
    if ! verify_backup; then
        send_notification "FAILED" "Backup verification failed"
        exit 1
    fi

    # Archive WAL files
    archive_wal_files

    # Upload to S3
    if ! upload_to_s3; then
        log "S3 upload failed, but backup is saved locally"
    fi

    # Apply retention policy
    apply_retention_policy

    # Success notification
    local backup_size=$(du -h "${BACKUP_FILE}" | cut -f1)
    send_notification "SUCCESS" "Backup completed successfully (${backup_size})"

    log "=========================================="
    log "Backup Process Completed Successfully"
    log "=========================================="
}

# Run main function
main "$@"
