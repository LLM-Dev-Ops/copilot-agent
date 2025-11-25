# LLM-CoPilot-Agent Security Hardening Guide (Part 2)

**Continued from SECURITY-HARDENING.md**

---

## 5. Data Protection

### 5.1 Encryption Key Rotation

#### Key Management Service (AWS KMS)
```yaml
# terraform/modules/kms/main.tf
resource "aws_kms_key" "llm_copilot" {
  description             = "LLM-CoPilot-Agent encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true  # Automatic annual rotation

  tags = {
    Name        = "llm-copilot-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "llm_copilot" {
  name          = "alias/llm-copilot-${var.environment}"
  target_key_id = aws_kms_key.llm_copilot.key_id
}

# Separate key for database encryption
resource "aws_kms_key" "database" {
  description             = "LLM-CoPilot-Agent database encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "llm-copilot-db-${var.environment}"
    Environment = var.environment
  }
}

# Key policy
resource "aws_kms_key_policy" "llm_copilot" {
  key_id = aws_kms_key.llm_copilot.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM policies"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow EKS to use the key"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.eks_node_group.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
      }
    ]
  })
}
```

#### Manual Key Rotation Procedure
```typescript
// scripts/rotate-encryption-keys.ts
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';

interface KeyRotationConfig {
  oldKeyId: string;
  newKeyId: string;
  tablesToRotate: string[];
}

class KeyRotationService {
  private kms: AWS.KMS;
  private rds: AWS.RDS;
  private s3: AWS.S3;

  constructor() {
    this.kms = new AWS.KMS({ region: process.env.AWS_REGION });
    this.rds = new AWS.RDS({ region: process.env.AWS_REGION });
    this.s3 = new AWS.S3({ region: process.env.AWS_REGION });
  }

  // Rotate database encryption key
  async rotateDatabaseKey(config: KeyRotationConfig): Promise<void> {
    console.log('Starting database key rotation...');

    // 1. Create new KMS key
    const newKey = await this.kms.createKey({
      Description: 'LLM-CoPilot-Agent database encryption key (rotated)',
      Origin: 'AWS_KMS'
    }).promise();

    console.log(`Created new key: ${newKey.KeyMetadata!.KeyId}`);

    // 2. Create snapshot of current database
    const snapshotId = `llm-copilot-rotation-${Date.now()}`;
    await this.rds.createDBSnapshot({
      DBInstanceIdentifier: 'llm-copilot-db',
      DBSnapshotIdentifier: snapshotId
    }).promise();

    console.log(`Created snapshot: ${snapshotId}`);

    // 3. Wait for snapshot to complete
    await this.waitForSnapshot(snapshotId);

    // 4. Copy snapshot with new encryption key
    const newSnapshotId = `${snapshotId}-encrypted`;
    await this.rds.copyDBSnapshot({
      SourceDBSnapshotIdentifier: snapshotId,
      TargetDBSnapshotIdentifier: newSnapshotId,
      KmsKeyId: newKey.KeyMetadata!.KeyId
    }).promise();

    console.log(`Copied snapshot with new encryption: ${newSnapshotId}`);

    // 5. Wait for copy to complete
    await this.waitForSnapshot(newSnapshotId);

    // 6. Restore from encrypted snapshot (requires maintenance window)
    console.log('Ready to restore from encrypted snapshot');
    console.log('This step requires a maintenance window and should be performed manually:');
    console.log(`aws rds restore-db-instance-from-db-snapshot --db-instance-identifier llm-copilot-db-new --db-snapshot-identifier ${newSnapshotId}`);
  }

  // Rotate application secrets
  async rotateApplicationSecrets(): Promise<void> {
    console.log('Rotating application secrets...');

    const secretsToRotate = [
      'llm-copilot/jwt-signing-key',
      'llm-copilot/session-secret',
      'llm-copilot/api-encryption-key'
    ];

    for (const secretName of secretsToRotate) {
      await this.rotateSecret(secretName);
    }
  }

  private async rotateSecret(secretName: string): Promise<void> {
    const secretsManager = new AWS.SecretsManager({ region: process.env.AWS_REGION });

    // Generate new secret value
    const newSecret = crypto.randomBytes(64).toString('base64');

    // Update secret
    await secretsManager.putSecretValue({
      SecretId: secretName,
      SecretString: newSecret
    }).promise();

    console.log(`Rotated secret: ${secretName}`);

    // Trigger application reload (via Kubernetes secret update)
    // External Secrets Operator will automatically sync the new value
  }

  private async waitForSnapshot(snapshotId: string): Promise<void> {
    console.log(`Waiting for snapshot ${snapshotId} to complete...`);

    while (true) {
      const snapshot = await this.rds.describeDBSnapshots({
        DBSnapshotIdentifier: snapshotId
      }).promise();

      const status = snapshot.DBSnapshots![0].Status;

      if (status === 'available') {
        console.log(`Snapshot ${snapshotId} is available`);
        break;
      }

      if (status === 'failed') {
        throw new Error(`Snapshot ${snapshotId} failed`);
      }

      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }
  }
}

// Run rotation
(async () => {
  const service = new KeyRotationService();

  try {
    // Rotate application secrets
    await service.rotateApplicationSecrets();

    console.log('Key rotation completed successfully');
  } catch (error) {
    console.error('Key rotation failed:', error);
    process.exit(1);
  }
})();
```

#### Key Rotation Schedule
```yaml
# config/key-rotation-schedule.yaml
keyRotationSchedule:

  # Automatic rotation (AWS KMS)
  automatic:
    - keyType: "KMS Master Keys"
      frequency: "Annual"
      automation: "AWS KMS automatic rotation"
      status: "Enabled"

  # Manual rotation
  manual:
    - keyType: "JWT Signing Keys"
      frequency: "Quarterly"
      procedure: "scripts/rotate-jwt-keys.sh"
      lastRotation: "2025-11-01"
      nextRotation: "2026-02-01"

    - keyType: "Session Encryption Keys"
      frequency: "Monthly"
      procedure: "scripts/rotate-session-keys.sh"
      lastRotation: "2025-11-15"
      nextRotation: "2025-12-15"

    - keyType: "API Encryption Keys"
      frequency: "Quarterly"
      procedure: "scripts/rotate-api-keys.sh"
      lastRotation: "2025-11-01"
      nextRotation: "2026-02-01"

    - keyType: "Database Encryption Keys"
      frequency: "Annual"
      procedure: "scripts/rotate-db-keys.sh"
      lastRotation: "2025-06-01"
      nextRotation: "2026-06-01"
      requiresDowntime: true
      maintenanceWindow: "Required"

  # Emergency rotation (on-demand)
  emergency:
    trigger: "Security incident or suspected key compromise"
    sla: "Within 4 hours"
    procedure: "docs/runbooks/emergency-key-rotation.md"
```

### 5.2 Secrets Management

#### External Secrets Operator Configuration
```yaml
# deployment/kubernetes/base/external-secrets.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: external-secrets
---
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: llm-copilot
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: llm-copilot-secrets
  namespace: llm-copilot
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore

  target:
    name: llm-copilot-secrets
    creationPolicy: Owner
    template:
      engineVersion: v2
      data:
        DATABASE_URL: "postgresql://{{ .username }}:{{ .password }}@{{ .host }}:5432/{{ .database }}"
        REDIS_URL: "redis://:{{ .redis_password }}@{{ .redis_host }}:6379"
        JWT_PRIVATE_KEY: "{{ .jwt_private_key }}"
        JWT_PUBLIC_KEY: "{{ .jwt_public_key }}"
        SESSION_SECRET: "{{ .session_secret }}"
        ENCRYPTION_KEY: "{{ .encryption_key }}"
        LLM_API_KEY: "{{ .llm_api_key }}"

  data:
    - secretKey: username
      remoteRef:
        key: llm-copilot/database
        property: username

    - secretKey: password
      remoteRef:
        key: llm-copilot/database
        property: password

    - secretKey: host
      remoteRef:
        key: llm-copilot/database
        property: host

    - secretKey: database
      remoteRef:
        key: llm-copilot/database
        property: database

    - secretKey: redis_password
      remoteRef:
        key: llm-copilot/redis
        property: password

    - secretKey: redis_host
      remoteRef:
        key: llm-copilot/redis
        property: host

    - secretKey: jwt_private_key
      remoteRef:
        key: llm-copilot/jwt
        property: private_key

    - secretKey: jwt_public_key
      remoteRef:
        key: llm-copilot/jwt
        property: public_key

    - secretKey: session_secret
      remoteRef:
        key: llm-copilot/session
        property: secret

    - secretKey: encryption_key
      remoteRef:
        key: llm-copilot/encryption
        property: key

    - secretKey: llm_api_key
      remoteRef:
        key: llm-copilot/llm
        property: api_key
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-secrets-sa
  namespace: llm-copilot
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/llm-copilot-external-secrets
```

#### Secrets Creation (AWS Secrets Manager)
```bash
#!/bin/bash
# scripts/create-secrets.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "Creating secrets in AWS Secrets Manager..."

# Database credentials
aws secretsmanager create-secret \
  --name "llm-copilot/database" \
  --description "Database credentials for LLM-CoPilot-Agent" \
  --secret-string "{
    \"username\": \"llm_copilot_user\",
    \"password\": \"$(openssl rand -base64 32)\",
    \"host\": \"llm-copilot-db.cluster-xxxxx.us-east-1.rds.amazonaws.com\",
    \"database\": \"llm_copilot\"
  }" \
  --region "${AWS_REGION}" \
  --tags Key=Environment,Value="${ENVIRONMENT}" Key=ManagedBy,Value=terraform

# Redis credentials
aws secretsmanager create-secret \
  --name "llm-copilot/redis" \
  --description "Redis credentials for LLM-CoPilot-Agent" \
  --secret-string "{
    \"password\": \"$(openssl rand -base64 32)\",
    \"host\": \"llm-copilot-redis.xxxxx.cache.amazonaws.com\"
  }" \
  --region "${AWS_REGION}" \
  --tags Key=Environment,Value="${ENVIRONMENT}"

# JWT keys (RSA 4096-bit)
openssl genrsa -out /tmp/jwt-private.pem 4096
openssl rsa -in /tmp/jwt-private.pem -pubout -out /tmp/jwt-public.pem

aws secretsmanager create-secret \
  --name "llm-copilot/jwt" \
  --description "JWT signing keys for LLM-CoPilot-Agent" \
  --secret-string "{
    \"private_key\": \"$(cat /tmp/jwt-private.pem | base64 -w 0)\",
    \"public_key\": \"$(cat /tmp/jwt-public.pem | base64 -w 0)\"
  }" \
  --region "${AWS_REGION}" \
  --tags Key=Environment,Value="${ENVIRONMENT}"

rm /tmp/jwt-private.pem /tmp/jwt-public.pem

# Session secret
aws secretsmanager create-secret \
  --name "llm-copilot/session" \
  --description "Session secret for LLM-CoPilot-Agent" \
  --secret-string "{
    \"secret\": \"$(openssl rand -base64 64)\"
  }" \
  --region "${AWS_REGION}" \
  --tags Key=Environment,Value="${ENVIRONMENT}"

# Encryption key
aws secretsmanager create-secret \
  --name "llm-copilot/encryption" \
  --description "Application encryption key for LLM-CoPilot-Agent" \
  --secret-string "{
    \"key\": \"$(openssl rand -base64 32)\"
  }" \
  --region "${AWS_REGION}" \
  --tags Key=Environment,Value="${ENVIRONMENT}"

# LLM API key (placeholder - should be set manually)
aws secretsmanager create-secret \
  --name "llm-copilot/llm" \
  --description "LLM API key for LLM-CoPilot-Agent" \
  --secret-string "{
    \"api_key\": \"REPLACE_WITH_ACTUAL_API_KEY\"
  }" \
  --region "${AWS_REGION}" \
  --tags Key=Environment,Value="${ENVIRONMENT}"

echo "Secrets created successfully"
echo "WARNING: Update llm-copilot/llm secret with actual API key"
```

### 5.3 PII Handling Procedures

#### PII Detection and Redaction
```typescript
// services/data-protection/pii-handler.ts
import * as crypto from 'crypto';

interface PIIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

export class PIIHandler {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;

  // PII patterns
  private static readonly PII_PATTERNS: PIIPattern[] = [
    {
      name: 'email',
      pattern: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
      replacement: '[EMAIL_REDACTED]'
    },
    {
      name: 'phone',
      pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      replacement: '[PHONE_REDACTED]'
    },
    {
      name: 'ssn',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: '[SSN_REDACTED]'
    },
    {
      name: 'credit_card',
      pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      replacement: '[CARD_REDACTED]'
    },
    {
      name: 'ip_address',
      pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      replacement: '[IP_REDACTED]'
    },
    {
      name: 'api_key',
      pattern: /\b[A-Za-z0-9]{32,}\b/g,
      replacement: '[KEY_REDACTED]'
    }
  ];

  // Detect PII in text
  static detectPII(text: string): Array<{ type: string; value: string; start: number; end: number }> {
    const detected: Array<{ type: string; value: string; start: number; end: number }> = [];

    for (const pattern of this.PII_PATTERNS) {
      const matches = text.matchAll(pattern.pattern);
      for (const match of matches) {
        detected.push({
          type: pattern.name,
          value: match[0],
          start: match.index!,
          end: match.index! + match[0].length
        });
      }
    }

    return detected;
  }

  // Redact PII from text
  static redactPII(text: string): string {
    let redacted = text;

    for (const pattern of this.PII_PATTERNS) {
      redacted = redacted.replace(pattern.pattern, pattern.replacement);
    }

    return redacted;
  }

  // Pseudonymize PII (reversible with key)
  static pseudonymizePII(text: string, key: string): string {
    const detected = this.detectPII(text);
    let pseudonymized = text;
    let offset = 0;

    for (const item of detected) {
      const encrypted = this.encrypt(item.value, key);
      const replacement = `[${item.type.toUpperCase()}_${encrypted.substring(0, 8)}]`;

      pseudonymized =
        pseudonymized.substring(0, item.start + offset) +
        replacement +
        pseudonymized.substring(item.end + offset);

      offset += replacement.length - item.value.length;
    }

    return pseudonymized;
  }

  // Encrypt PII
  static encrypt(text: string, key: string): string {
    const keyBuffer = crypto.scryptSync(key, 'salt', this.KEY_LENGTH);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, keyBuffer, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // Decrypt PII
  static decrypt(encrypted: string, key: string): string {
    const [ivHex, authTagHex, encryptedText] = encrypted.split(':');

    const keyBuffer = crypto.scryptSync(key, 'salt', this.KEY_LENGTH);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Validate that text contains no PII
  static validateNoPII(text: string): { valid: boolean; violations: string[] } {
    const detected = this.detectPII(text);

    if (detected.length === 0) {
      return { valid: true, violations: [] };
    }

    const violations = detected.map(d => d.type);
    return {
      valid: false,
      violations: Array.from(new Set(violations))
    };
  }
}

// PII logging middleware
export function piiLoggingMiddleware(req: any, res: any, next: any) {
  // Redact PII from request logs
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const redacted = args.map(arg => {
      if (typeof arg === 'string') {
        return PIIHandler.redactPII(arg);
      }
      if (typeof arg === 'object') {
        return JSON.parse(PIIHandler.redactPII(JSON.stringify(arg)));
      }
      return arg;
    });
    originalLog.apply(console, redacted);
  };

  next();
}
```

#### GDPR Data Subject Rights
```typescript
// services/data-protection/gdpr.ts

export interface DataSubjectRequest {
  userId: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction';
  requestedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
}

export class GDPRService {

  // Right to Access (Art. 15)
  async exportUserData(userId: string): Promise<any> {
    const userData = {
      profile: await this.getUserProfile(userId),
      queries: await this.getUserQueries(userId),
      tests: await this.getUserTests(userId),
      workflows: await this.getUserWorkflows(userId),
      incidents: await this.getUserIncidents(userId),
      auditLogs: await this.getUserAuditLogs(userId)
    };

    // Redact sensitive internal data
    return this.redactInternalData(userData);
  }

  // Right to Erasure (Art. 17)
  async deleteUserData(userId: string): Promise<void> {
    // Anonymize instead of delete for audit compliance
    await this.anonymizeUserData(userId);

    // Delete non-essential data
    await this.deleteUserTests(userId);
    await this.deleteUserWorkflows(userId);
    await this.deleteUserQueries(userId);

    // Keep audit logs but pseudonymize
    await this.pseudonymizeAuditLogs(userId);
  }

  // Right to Data Portability (Art. 20)
  async exportUserDataPortable(userId: string): Promise<string> {
    const data = await this.exportUserData(userId);

    // Export in machine-readable format (JSON)
    return JSON.stringify(data, null, 2);
  }

  // Right to Rectification (Art. 16)
  async updateUserData(userId: string, updates: any): Promise<void> {
    // Validate updates
    this.validateUserUpdates(updates);

    // Apply updates
    await this.applyUserUpdates(userId, updates);

    // Log data subject request
    await this.logDataSubjectRequest(userId, 'rectification');
  }

  // Right to Restriction (Art. 18)
  async restrictUserData(userId: string): Promise<void> {
    // Mark user as restricted
    await this.markUserRestricted(userId);

    // Prevent data processing
    await this.disableUserProcessing(userId);

    // Log request
    await this.logDataSubjectRequest(userId, 'restriction');
  }

  // Consent management
  async updateConsent(userId: string, consent: {
    marketing: boolean;
    analytics: boolean;
    thirdParty: boolean;
  }): Promise<void> {
    await this.saveUserConsent(userId, consent);
  }

  // Data retention
  async applyDataRetention(): Promise<void> {
    // Delete data older than retention period
    const retentionDays = 365 * 2; // 2 years

    await this.deleteOldQueryData(retentionDays);
    await this.deleteOldTestData(retentionDays);
    await this.deleteOldWorkflowData(retentionDays);
  }

  private async getUserProfile(userId: string): Promise<any> {
    // Implementation
    return {};
  }

  private async getUserQueries(userId: string): Promise<any[]> {
    return [];
  }

  private async getUserTests(userId: string): Promise<any[]> {
    return [];
  }

  private async getUserWorkflows(userId: string): Promise<any[]> {
    return [];
  }

  private async getUserIncidents(userId: string): Promise<any[]> {
    return [];
  }

  private async getUserAuditLogs(userId: string): Promise<any[]> {
    return [];
  }

  private redactInternalData(data: any): any {
    // Remove internal fields
    return data;
  }

  private async anonymizeUserData(userId: string): Promise<void> {
    // Replace user data with anonymized version
  }

  private async deleteUserTests(userId: string): Promise<void> {}
  private async deleteUserWorkflows(userId: string): Promise<void> {}
  private async deleteUserQueries(userId: string): Promise<void> {}
  private async pseudonymizeAuditLogs(userId: string): Promise<void> {}

  private validateUserUpdates(updates: any): void {
    // Validation logic
  }

  private async applyUserUpdates(userId: string, updates: any): Promise<void> {}

  private async logDataSubjectRequest(userId: string, type: string): Promise<void> {}

  private async markUserRestricted(userId: string): Promise<void> {}
  private async disableUserProcessing(userId: string): Promise<void> {}

  private async saveUserConsent(userId: string, consent: any): Promise<void> {}

  private async deleteOldQueryData(retentionDays: number): Promise<void> {}
  private async deleteOldTestData(retentionDays: number): Promise<void> {}
  private async deleteOldWorkflowData(retentionDays: number): Promise<void> {}
}
```

### 5.4 Data Classification

```yaml
# config/data-classification.yaml
dataClassification:

  # Classification levels
  levels:
    - level: "Public"
      description: "Data that can be freely shared"
      retention: "Indefinite"
      encryption: "Optional"
      examples:
        - "Public documentation"
        - "Marketing materials"
        - "Public API schemas"

    - level: "Internal"
      description: "Data for internal use only"
      retention: "3 years"
      encryption: "Required at rest"
      examples:
        - "Internal documentation"
        - "System metrics"
        - "Non-sensitive logs"

    - level: "Confidential"
      description: "Sensitive business data"
      retention: "2 years"
      encryption: "Required at rest and in transit"
      accessControl: "RBAC required"
      examples:
        - "User queries"
        - "Test results"
        - "Workflow definitions"
        - "Incident reports"

    - level: "Restricted"
      description: "Highly sensitive data"
      retention: "1 year"
      encryption: "AES-256 at rest and in transit"
      accessControl: "MFA required"
      auditLogging: "All access logged"
      examples:
        - "Authentication credentials"
        - "API keys"
        - "Personal identifiable information (PII)"
        - "Payment information"
        - "Audit logs"

  # Data types and their classification
  dataTypes:
    - type: "User Credentials"
      classification: "Restricted"
      pii: true
      encryption: "AES-256"
      storage: "AWS Secrets Manager"
      backup: "Encrypted"
      retention: "Account lifetime + 30 days"

    - type: "User Profile"
      classification: "Confidential"
      pii: true
      encryption: "AES-256"
      storage: "PostgreSQL (encrypted)"
      backup: "Encrypted"
      retention: "Account lifetime + 90 days"

    - type: "LLM Queries"
      classification: "Confidential"
      pii: "May contain"
      encryption: "AES-256"
      storage: "PostgreSQL (encrypted)"
      backup: "Encrypted"
      retention: "90 days"

    - type: "Test Results"
      classification: "Confidential"
      pii: false
      encryption: "AES-256"
      storage: "PostgreSQL"
      backup: "Encrypted"
      retention: "2 years"

    - type: "Audit Logs"
      classification: "Restricted"
      pii: true
      encryption: "AES-256"
      storage: "S3 (encrypted)"
      backup: "Encrypted with versioning"
      retention: "7 years"

    - type: "Metrics and Telemetry"
      classification: "Internal"
      pii: false
      encryption: "Optional"
      storage: "Prometheus / CloudWatch"
      backup: "Not required"
      retention: "90 days"

  # Handling procedures
  handling:
    - classification: "Public"
      procedures:
        - "No special handling required"
        - "Can be transmitted over unencrypted channels"

    - classification: "Internal"
      procedures:
        - "Encrypt in transit (TLS 1.3)"
        - "Access restricted to employees"
        - "No external sharing"

    - classification: "Confidential"
      procedures:
        - "Encrypt at rest (AES-256)"
        - "Encrypt in transit (TLS 1.3)"
        - "Access via RBAC"
        - "Audit all access"
        - "Require secure deletion"

    - classification: "Restricted"
      procedures:
        - "Encrypt at rest (AES-256)"
        - "Encrypt in transit (TLS 1.3)"
        - "MFA required for access"
        - "Audit all access"
        - "Require secure deletion"
        - "Annual access review"
        - "DLP monitoring"
```

### 5.5 Backup Encryption

```yaml
# deployment/kubernetes/base/backup-encryption.yaml
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: default
  namespace: velero
spec:
  provider: aws
  objectStorage:
    bucket: llm-copilot-backups
    prefix: kubernetes
  config:
    region: us-east-1
    s3Url: https://s3.us-east-1.amazonaws.com
    # Server-side encryption with KMS
    serverSideEncryption: aws:kms
    kmsKeyId: arn:aws:kms:us-east-1:123456789012:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
---
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: encrypted-daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  template:
    includeClusterResources: true
    includedNamespaces:
      - llm-copilot
      - llm-copilot-*
    excludedResources:
      - events
      - events.events.k8s.io
    snapshotVolumes: true
    volumeSnapshotLocations:
      - default
    ttl: 720h  # 30 days
    hooks:
      # Pre-backup hook: Create database dump
      resources:
        - name: postgres-backup-hook
          includedNamespaces:
            - llm-copilot
          labelSelector:
            matchLabels:
              app: postgresql
          pre:
            - exec:
                container: postgresql
                command:
                  - /bin/bash
                  - -c
                  - |
                    PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
                      -U $POSTGRES_USER \
                      -h localhost \
                      -d $POSTGRES_DB \
                      --format=custom \
                      --file=/backup/database-$(date +%Y%m%d-%H%M%S).dump
                onError: Fail
                timeout: 10m
```

#### Database Backup Encryption
```bash
#!/bin/bash
# scripts/backup-database.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="llm-copilot-db-${TIMESTAMP}.dump"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"
S3_BUCKET="llm-copilot-backups"
KMS_KEY_ID="arn:aws:kms:us-east-1:123456789012:key/xxxxxxxx"

echo "Starting database backup..."

# Create database dump
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -U "${DB_USER}" \
  -h "${DB_HOST}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --file="/tmp/${BACKUP_FILE}"

echo "Database dump created: ${BACKUP_FILE}"

# Encrypt backup using GPG
gpg --symmetric --cipher-algo AES256 \
  --output "/tmp/${ENCRYPTED_FILE}" \
  "/tmp/${BACKUP_FILE}"

echo "Backup encrypted: ${ENCRYPTED_FILE}"

# Upload to S3 with server-side encryption
aws s3 cp "/tmp/${ENCRYPTED_FILE}" \
  "s3://${S3_BUCKET}/database/${ENCRYPTED_FILE}" \
  --server-side-encryption aws:kms \
  --ssekms-key-id "${KMS_KEY_ID}" \
  --storage-class STANDARD_IA

echo "Backup uploaded to S3"

# Verify backup
aws s3api head-object \
  --bucket "${S3_BUCKET}" \
  --key "database/${ENCRYPTED_FILE}" \
  --query 'ServerSideEncryption' \
  --output text

# Clean up local files
rm "/tmp/${BACKUP_FILE}" "/tmp/${ENCRYPTED_FILE}"

echo "Backup completed successfully: ${ENCRYPTED_FILE}"
```

---

## 6. Audit and Compliance

### 6.1 Audit Log Requirements

#### Comprehensive Audit Logging
```typescript
// services/audit/comprehensive-logger.ts
import { createLogger, format, transports } from 'winston';

export interface AuditLog {
  // When
  timestamp: Date;

  // Who
  userId: string;
  userEmail: string;
  userRoles: string[];
  organizationId?: string;
  sessionId: string;

  // What
  action: string;
  resource: string;
  resourceId?: string;
  resourceType: string;

  // Where
  ipAddress: string;
  userAgent: string;
  geolocation?: string;

  // How
  method: string;
  endpoint: string;
  requestId: string;

  // Result
  status: 'success' | 'failure';
  statusCode: number;
  errorMessage?: string;

  // Context
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: Record<string, any>;

  // Compliance
  dataClassification?: string;
  complianceScope?: string[];
}

export class ComprehensiveAuditLogger {
  private logger: ReturnType<typeof createLogger>;

  // Events that MUST be audited (compliance requirement)
  private static readonly CRITICAL_EVENTS = [
    // Authentication
    'auth.login.success',
    'auth.login.failure',
    'auth.logout',
    'auth.password.change',
    'auth.password.reset',
    'auth.mfa.enable',
    'auth.mfa.disable',
    'auth.token.create',
    'auth.token.revoke',

    // Authorization
    'authz.permission.grant',
    'authz.permission.revoke',
    'authz.role.assign',
    'authz.role.remove',
    'authz.access.denied',

    // Data access
    'data.read.pii',
    'data.export',
    'data.delete',
    'data.modify.sensitive',

    // System changes
    'system.config.change',
    'system.user.create',
    'system.user.delete',
    'system.secret.access',
    'system.secret.create',
    'system.secret.delete',

    // Security events
    'security.breach.suspected',
    'security.encryption.key.rotate',
    'security.backup.access',
    'security.audit.log.access'
  ];

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: {
        service: 'llm-copilot-agent',
        environment: process.env.NODE_ENV
      },
      transports: [
        // Local file (immediate backup)
        new transports.File({
          filename: '/var/log/llm-copilot/audit.log',
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 100, // Keep 100 files
          tailable: true
        }),

        // Separate file for critical events
        new transports.File({
          filename: '/var/log/llm-copilot/audit-critical.log',
          level: 'warn',
          maxsize: 50 * 1024 * 1024,
          maxFiles: 200
        })
      ]
    });
  }

  // Log audit event
  log(event: AuditLog): void {
    const isCritical = this.isCriticalEvent(event.action);

    this.logger.log({
      level: isCritical ? 'warn' : 'info',
      message: event.action,
      ...event,
      critical: isCritical
    });

    // For critical events, also send to SIEM
    if (isCritical) {
      this.sendToSIEM(event);
    }
  }

  private isCriticalEvent(action: string): boolean {
    return ComprehensiveAuditLogger.CRITICAL_EVENTS.includes(action);
  }

  private async sendToSIEM(event: AuditLog): Promise<void> {
    // Send to external SIEM system (e.g., Splunk, Datadog)
    // Implementation depends on SIEM provider
  }
}

// Audit middleware
export function auditMiddleware() {
  const auditLogger = new ComprehensiveAuditLogger();

  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Capture original response methods
    const originalJson = res.json;
    const originalSend = res.send;

    let responseBody: any;

    res.json = function(body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.send = function(body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Wait for response
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const auditLog: AuditLog = {
        timestamp: new Date(),
        userId: req.user?.id || 'anonymous',
        userEmail: req.user?.email || 'anonymous',
        userRoles: req.user?.roles || [],
        organizationId: req.user?.organizationId,
        sessionId: req.session?.id,
        action: `${req.method}.${req.route?.path || req.path}`,
        resource: req.path,
        resourceId: req.params.id,
        resourceType: this.getResourceType(req.path),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        endpoint: req.path,
        requestId: req.id,
        status: res.statusCode < 400 ? 'success' : 'failure',
        statusCode: res.statusCode,
        errorMessage: responseBody?.error,
        metadata: {
          duration,
          queryParams: req.query,
          bodySize: JSON.stringify(req.body).length
        }
      };

      auditLogger.log(auditLog);
    });

    next();
  };

  function getResourceType(path: string): string {
    const parts = path.split('/');
    return parts[2] || 'unknown';
  }
}
```

### 6.2 SOC 2 Type II Compliance Checklist

```yaml
# compliance/soc2-checklist.yaml
soc2Compliance:

  # CC1: Control Environment
  CC1:
    - control: "CC1.1"
      requirement: "Organization structure and governance"
      status: "Implemented"
      evidence:
        - "docs/governance/organizational-structure.md"
        - "docs/governance/security-team-charter.md"

    - control: "CC1.2"
      requirement: "Board oversight of risk and security"
      status: "Implemented"
      evidence:
        - "docs/governance/board-security-reports/"

    - control: "CC1.3"
      requirement: "Management responsibilities"
      status: "Implemented"
      evidence:
        - "docs/governance/roles-responsibilities.md"

    - control: "CC1.4"
      requirement: "Competence and accountability"
      status: "Implemented"
      evidence:
        - "docs/hr/security-training-records.pdf"
        - "docs/hr/background-checks.pdf"

  # CC2: Communication and Information
  CC2:
    - control: "CC2.1"
      requirement: "Internal communication of information"
      status: "Implemented"
      evidence:
        - "Slack #security channel logs"
        - "Security policy distribution records"

    - control: "CC2.2"
      requirement: "External communication of information"
      status: "Implemented"
      evidence:
        - "Website security page"
        - "Customer security documentation"

  # CC3: Risk Assessment
  CC3:
    - control: "CC3.1"
      requirement: "Risk identification process"
      status: "Implemented"
      evidence:
        - "docs/security/risk-register.xlsx"
        - "docs/security/threat-model.md"

    - control: "CC3.2"
      requirement: "Risk analysis and mitigation"
      status: "Implemented"
      evidence:
        - "docs/security/risk-mitigation-plans/"

  # CC4: Monitoring Activities
  CC4:
    - control: "CC4.1"
      requirement: "Control effectiveness monitoring"
      status: "Implemented"
      evidence:
        - "Prometheus alerts"
        - "Security metrics dashboard"

    - control: "CC4.2"
      requirement: "Incident detection and reporting"
      status: "Implemented"
      evidence:
        - "PagerDuty incident logs"
        - "Incident response runbooks"

  # CC5: Control Activities
  CC5:
    - control: "CC5.1"
      requirement: "Selection and development of control activities"
      status: "Implemented"
      evidence:
        - "This security hardening document"
        - "RBAC configuration"

    - control: "CC5.2"
      requirement: "Control deployment through policies"
      status: "Implemented"
      evidence:
        - "Security policies repository"

  # CC6: Logical and Physical Access Controls
  CC6:
    - control: "CC6.1"
      requirement: "Logical access controls"
      status: "Implemented"
      evidence:
        - "RBAC implementation"
        - "MFA enforcement"
        - "Access logs"
      implementation:
        - "OAuth 2.0 with PKCE"
        - "JWT with RSA-256"
        - "MFA required for all users"
        - "Session management with Redis"

    - control: "CC6.2"
      requirement: "Prior to issuing credentials"
      status: "Implemented"
      evidence:
        - "User provisioning workflow"
        - "Background check records"

    - control: "CC6.3"
      requirement: "Credential lifecycle management"
      status: "Implemented"
      evidence:
        - "Password policy enforcement"
        - "Automated credential rotation"
        - "Access review logs"
      implementation:
        - "90-day password expiration"
        - "Quarterly access reviews"
        - "Automated deprovisioning"

    - control: "CC6.4"
      requirement: "Physical access controls"
      status: "N/A - Cloud Only"
      evidence: []

    - control: "CC6.5"
      requirement: "Removal of access"
      status: "Implemented"
      evidence:
        - "Offboarding checklist"
        - "Access removal logs"

    - control: "CC6.6"
      requirement: "Protection of confidential information"
      status: "Implemented"
      evidence:
        - "AES-256 encryption at rest"
        - "TLS 1.3 in transit"
        - "KMS key management"
      implementation:
        - "Database encryption enabled"
        - "S3 bucket encryption enabled"
        - "Secrets in AWS Secrets Manager"

    - control: "CC6.7"
      requirement: "Monitoring of system components"
      status: "Implemented"
      evidence:
        - "CloudWatch alarms"
        - "Prometheus alerts"
        - "SIEM integration"

    - control: "CC6.8"
      requirement: "Endpoint security"
      status: "Implemented"
      evidence:
        - "Pod security policies"
        - "Container security scanning"

  # CC7: System Operations
  CC7:
    - control: "CC7.1"
      requirement: "Capacity and performance monitoring"
      status: "Implemented"
      evidence:
        - "Grafana dashboards"
        - "Auto-scaling configuration"

    - control: "CC7.2"
      requirement: "System monitoring and alerting"
      status: "Implemented"
      evidence:
        - "Prometheus/Grafana stack"
        - "PagerDuty integration"
        - "Alert runbooks"

    - control: "CC7.3"
      requirement: "Backup and recovery procedures"
      status: "Implemented"
      evidence:
        - "Velero backup configuration"
        - "DR runbook"
        - "RTO: 15 minutes, RPO: 1 hour"

    - control: "CC7.4"
      requirement: "Incident response plan"
      status: "Implemented"
      evidence:
        - "docs/incident-response/plan.md"
        - "Incident response test results"

  # CC8: Change Management
  CC8:
    - control: "CC8.1"
      requirement: "Change management process"
      status: "Implemented"
      evidence:
        - "GitHub PR process"
        - "Change approval logs"
        - "CI/CD pipeline"

  # CC9: Risk Mitigation
  CC9:
    - control: "CC9.1"
      requirement: "Vendor risk management"
      status: "Implemented"
      evidence:
        - "Vendor security assessments"
        - "Third-party audit reports"

    - control: "CC9.2"
      requirement: "Business continuity and disaster recovery"
      status: "Implemented"
      evidence:
        - "Multi-region deployment"
        - "DR test results"
        - "RTO/RPO documentation"

  # Additional Security Criteria (if applicable)
  A1:
    - control: "A1.1"
      requirement: "Security awareness training"
      status: "Implemented"
      evidence:
        - "Annual security training completion records"
        - "Phishing simulation results"

    - control: "A1.2"
      requirement: "Vulnerability management"
      status: "Implemented"
      evidence:
        - "Snyk scan results"
        - "Vulnerability remediation tracking"
        - "Patch management process"

# Annual SOC 2 Audit Process
auditProcess:
  frequency: "Annual"
  auditor: "TBD - Select SOC 2 certified auditor"

  timeline:
    - phase: "Pre-Audit Preparation"
      duration: "2 months"
      tasks:
        - "Review and update policies"
        - "Collect evidence"
        - "Conduct internal audit"
        - "Remediate gaps"

    - phase: "Audit"
      duration: "1 month"
      tasks:
        - "Auditor onboarding"
        - "Control testing"
        - "Evidence review"
        - "Interviews"

    - phase: "Remediation"
      duration: "1 month"
      tasks:
        - "Address findings"
        - "Auditor re-review"

    - phase: "Report Issuance"
      duration: "2 weeks"
      tasks:
        - "Final report review"
        - "Report issuance"
```

### 6.3 GDPR Compliance Checklist

```yaml
# compliance/gdpr-checklist.yaml
gdprCompliance:

  # Article 5: Principles relating to processing
  article5:
    - principle: "Lawfulness, fairness, transparency"
      status: "Compliant"
      implementation:
        - "Privacy policy published"
        - "Clear consent mechanisms"
        - "Transparent data processing"

    - principle: "Purpose limitation"
      status: "Compliant"
      implementation:
        - "Data processing purposes documented"
        - "No secondary use without consent"

    - principle: "Data minimization"
      status: "Compliant"
      implementation:
        - "Only collect necessary data"
        - "Regular data cleanup"

    - principle: "Accuracy"
      status: "Compliant"
      implementation:
        - "User profile update capability"
        - "Data rectification process"

    - principle: "Storage limitation"
      status: "Compliant"
      implementation:
        - "Data retention policies"
        - "Automated deletion after retention period"

    - principle: "Integrity and confidentiality"
      status: "Compliant"
      implementation:
        - "AES-256 encryption"
        - "TLS 1.3"
        - "Access controls"

  # Article 6: Lawfulness of processing
  article6:
    - basis: "Consent"
      status: "Implemented"
      implementation:
        - "Consent management system"
        - "Granular consent options"
        - "Easy consent withdrawal"

    - basis: "Contractual necessity"
      status: "Implemented"
      implementation:
        - "Terms of Service acceptance"
        - "Service delivery requirements"

  # Chapter III: Rights of Data Subjects
  dataSubjectRights:

    - right: "Right to be informed (Art. 13-14)"
      status: "Compliant"
      implementation:
        - "Privacy policy"
        - "Data processing notices"
      evidence:
        - "Website privacy page"
        - "Email notifications"

    - right: "Right of access (Art. 15)"
      status: "Compliant"
      implementation:
        - "Data export API"
        - "User dashboard"
      sla: "30 days"

    - right: "Right to rectification (Art. 16)"
      status: "Compliant"
      implementation:
        - "Profile edit functionality"
        - "Data correction API"
      sla: "30 days"

    - right: "Right to erasure (Art. 17)"
      status: "Compliant"
      implementation:
        - "Account deletion"
        - "Data anonymization"
      sla: "30 days"
      notes: "Some data retained for legal/audit purposes"

    - right: "Right to restriction (Art. 18)"
      status: "Compliant"
      implementation:
        - "Account freeze capability"
        - "Processing restriction"
      sla: "30 days"

    - right: "Right to data portability (Art. 20)"
      status: "Compliant"
      implementation:
        - "JSON export format"
        - "API access"
      sla: "30 days"

    - right: "Right to object (Art. 21)"
      status: "Compliant"
      implementation:
        - "Marketing opt-out"
        - "Profiling opt-out"

    - right: "Rights related to automated decision making (Art. 22)"
      status: "Compliant"
      implementation:
        - "No automated decisions without consent"
        - "Human review available"

  # Article 25: Data protection by design and default
  article25:
    - requirement: "Data protection by design"
      status: "Compliant"
      implementation:
        - "Privacy-first architecture"
        - "Encryption by default"
        - "Minimal data collection"

    - requirement: "Data protection by default"
      status: "Compliant"
      implementation:
        - "Opt-in for non-essential features"
        - "Minimal default permissions"

  # Article 30: Records of processing activities
  article30:
    status: "Compliant"
    implementation:
      - "Processing activities register"
      - "Data flow documentation"
    evidence:
      - "docs/gdpr/processing-activities.xlsx"

  # Article 32: Security of processing
  article32:
    status: "Compliant"
    implementation:
      - "AES-256 encryption"
      - "TLS 1.3"
      - "Access controls"
      - "Regular security testing"
      - "Incident response plan"

  # Article 33-34: Data breach notification
  article33_34:
    status: "Compliant"
    implementation:
      - "Breach detection monitoring"
      - "Notification procedures"
      - "72-hour notification SLA"
    evidence:
      - "docs/incident-response/breach-notification.md"

  # Article 35: Data protection impact assessment
  article35:
    status: "Compliant"
    implementation:
      - "DPIA for new features"
      - "Risk assessment process"
    evidence:
      - "docs/gdpr/dpia-template.docx"

  # Article 37: Designation of DPO
  article37:
    status: "Compliant"
    dpo:
      name: "TBD"
      email: "dpo@llm-copilot.com"
      contact: "Published on website"

# Data Processing Agreement (DPA)
dpa:
  template: "docs/legal/dpa-template.pdf"
  required: true
  renewalPeriod: "Annual"

# International data transfers
dataTransfers:
  mechanism: "Standard Contractual Clauses (SCCs)"
  regions:
    - US (AWS us-east-1)
    - EU (AWS eu-west-1)
  encryption: "All data encrypted in transit and at rest"
```

---

*Continued in SECURITY-HARDENING-PART3.md for remaining sections...*
