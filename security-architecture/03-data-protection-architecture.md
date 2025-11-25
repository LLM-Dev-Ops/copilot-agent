# Data Protection Architecture

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-25

## Overview

This document defines the data protection architecture for LLM-CoPilot-Agent, implementing encryption at rest and in transit, key management, secret rotation, and PII handling to meet SOC 2 Type II and GDPR compliance requirements.

---

## Table of Contents

1. [Encryption at Rest](#encryption-at-rest)
2. [Encryption in Transit](#encryption-in-transit)
3. [Key Management](#key-management)
4. [Secret Rotation](#secret-rotation)
5. [PII Handling and Redaction](#pii-handling-and-redaction)
6. [Rust Implementation](#rust-implementation)

---

## Encryption at Rest

### Database Encryption

```rust
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    /// Create new encryption service with key from environment/vault
    pub fn new(key: &[u8; 32]) -> Self {
        Self {
            cipher: Aes256Gcm::new(key.into()),
        }
    }

    /// Encrypt data and return ciphertext with nonce prepended
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        // Generate random nonce (12 bytes for GCM)
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt data
        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        // Prepend nonce to ciphertext for storage
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Decrypt data (expects nonce prepended to ciphertext)
    pub fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        if encrypted_data.len() < 12 {
            return Err(EncryptionError::InvalidCiphertext);
        }

        // Extract nonce from first 12 bytes
        let (nonce_bytes, ciphertext) = encrypted_data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt data
        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        Ok(plaintext)
    }

    /// Encrypt string data
    pub fn encrypt_string(&self, plaintext: &str) -> Result<String, EncryptionError> {
        let encrypted = self.encrypt(plaintext.as_bytes())?;
        Ok(base64::engine::general_purpose::STANDARD.encode(encrypted))
    }

    /// Decrypt string data
    pub fn decrypt_string(&self, ciphertext: &str) -> Result<String, EncryptionError> {
        let encrypted = base64::engine::general_purpose::STANDARD
            .decode(ciphertext)
            .map_err(|_| EncryptionError::InvalidCiphertext)?;

        let decrypted = self.decrypt(&encrypted)?;
        String::from_utf8(decrypted).map_err(|_| EncryptionError::InvalidUtf8)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EncryptionError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid ciphertext format")]
    InvalidCiphertext,

    #[error("Invalid UTF-8 in decrypted data")]
    InvalidUtf8,

    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = [0u8; 32]; // In production, use proper key from vault
        let service = EncryptionService::new(&key);

        let plaintext = "sensitive data";
        let ciphertext = service.encrypt_string(plaintext).unwrap();
        let decrypted = service.decrypt_string(&ciphertext).unwrap();

        assert_eq!(plaintext, decrypted);
    }
}
```

### Encrypted Database Fields

```rust
use sqlx::{Postgres, Type};

/// Wrapper type for encrypted database fields
#[derive(Debug, Clone)]
pub struct EncryptedString {
    ciphertext: String,
}

impl EncryptedString {
    pub fn new(plaintext: &str, encryption_service: &EncryptionService) -> Result<Self, EncryptionError> {
        Ok(Self {
            ciphertext: encryption_service.encrypt_string(plaintext)?,
        })
    }

    pub fn decrypt(&self, encryption_service: &EncryptionService) -> Result<String, EncryptionError> {
        encryption_service.decrypt_string(&self.ciphertext)
    }

    pub fn ciphertext(&self) -> &str {
        &self.ciphertext
    }
}

// Implement SQLx encoding/decoding
impl Type<Postgres> for EncryptedString {
    fn type_info() -> <Postgres as sqlx::Database>::TypeInfo {
        <String as Type<Postgres>>::type_info()
    }
}

impl sqlx::Encode<'_, Postgres> for EncryptedString {
    fn encode_by_ref(
        &self,
        buf: &mut <Postgres as sqlx::database::HasArguments<'_>>::ArgumentBuffer,
    ) -> sqlx::encode::IsNull {
        self.ciphertext.encode_by_ref(buf)
    }
}

impl sqlx::Decode<'_, Postgres> for EncryptedString {
    fn decode(
        value: <Postgres as sqlx::database::HasValueRef<'_>>::ValueRef,
    ) -> Result<Self, sqlx::error::BoxDynError> {
        let ciphertext = String::decode(value)?;
        Ok(EncryptedString { ciphertext })
    }
}

/// Example: User model with encrypted fields
#[derive(Debug, sqlx::FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub encrypted_ssn: EncryptedString,        // Encrypted SSN
    pub encrypted_api_token: EncryptedString,  // Encrypted API token
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl User {
    pub fn get_ssn(&self, encryption_service: &EncryptionService) -> Result<String, EncryptionError> {
        self.encrypted_ssn.decrypt(encryption_service)
    }

    pub fn get_api_token(&self, encryption_service: &EncryptionService) -> Result<String, EncryptionError> {
        self.encrypted_api_token.decrypt(encryption_service)
    }
}
```

### File Encryption

```rust
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

pub struct FileEncryptionService {
    encryption_service: EncryptionService,
}

impl FileEncryptionService {
    pub fn new(encryption_service: EncryptionService) -> Self {
        Self { encryption_service }
    }

    /// Encrypt file and write to destination
    pub fn encrypt_file(
        &self,
        source_path: &Path,
        dest_path: &Path,
    ) -> Result<(), EncryptionError> {
        // Read source file
        let mut source_file = File::open(source_path)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        let mut plaintext = Vec::new();
        source_file
            .read_to_end(&mut plaintext)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        // Encrypt data
        let ciphertext = self.encryption_service.encrypt(&plaintext)?;

        // Write encrypted file
        let mut dest_file = File::create(dest_path)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        dest_file
            .write_all(&ciphertext)
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        Ok(())
    }

    /// Decrypt file and write to destination
    pub fn decrypt_file(
        &self,
        source_path: &Path,
        dest_path: &Path,
    ) -> Result<(), EncryptionError> {
        // Read encrypted file
        let mut source_file = File::open(source_path)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        let mut ciphertext = Vec::new();
        source_file
            .read_to_end(&mut ciphertext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        // Decrypt data
        let plaintext = self.encryption_service.decrypt(&ciphertext)?;

        // Write decrypted file
        let mut dest_file = File::create(dest_path)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        dest_file
            .write_all(&plaintext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        Ok(())
    }

    /// Encrypt data stream (for large files)
    pub fn encrypt_stream<R: Read, W: Write>(
        &self,
        reader: &mut R,
        writer: &mut W,
    ) -> Result<(), EncryptionError> {
        const CHUNK_SIZE: usize = 64 * 1024; // 64KB chunks

        let mut buffer = vec![0u8; CHUNK_SIZE];

        loop {
            let bytes_read = reader
                .read(&mut buffer)
                .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

            if bytes_read == 0 {
                break;
            }

            let chunk = &buffer[..bytes_read];
            let encrypted_chunk = self.encryption_service.encrypt(chunk)?;

            // Write chunk size and encrypted data
            let size_bytes = (encrypted_chunk.len() as u32).to_le_bytes();
            writer
                .write_all(&size_bytes)
                .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;
            writer
                .write_all(&encrypted_chunk)
                .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;
        }

        Ok(())
    }
}
```

---

## Encryption in Transit

### TLS 1.3 Configuration

```rust
use rustls::{ClientConfig, ServerConfig, RootCertStore};
use rustls::version::TLS13;

pub fn create_tls_server_config(
    cert_path: &str,
    key_path: &str,
) -> Result<ServerConfig, Box<dyn std::error::Error>> {
    use std::fs::File;
    use std::io::BufReader;

    let cert_file = File::open(cert_path)?;
    let key_file = File::open(key_path)?;

    let mut cert_reader = BufReader::new(cert_file);
    let mut key_reader = BufReader::new(key_file);

    let certs = rustls_pemfile::certs(&mut cert_reader)?
        .into_iter()
        .map(rustls::Certificate)
        .collect();

    let keys = rustls_pemfile::pkcs8_private_keys(&mut key_reader)?;
    let key = rustls::PrivateKey(keys[0].clone());

    let mut config = ServerConfig::builder()
        .with_safe_default_cipher_suites()
        .with_safe_default_kx_groups()
        .with_protocol_versions(&[&TLS13])?  // TLS 1.3 only
        .with_no_client_auth()
        .with_single_cert(certs, key)?;

    // Configure cipher suites (TLS 1.3)
    // These are secure by default with rustls

    // Enable ALPN for HTTP/2
    config.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];

    Ok(config)
}

pub fn create_tls_client_config() -> Result<ClientConfig, Box<dyn std::error::Error>> {
    let mut root_store = RootCertStore::empty();

    // Add system root certificates
    root_store.add_server_trust_anchors(
        webpki_roots::TLS_SERVER_ROOTS.0.iter().map(|ta| {
            rustls::OwnedTrustAnchor::from_subject_spki_name_constraints(
                ta.subject,
                ta.spki,
                ta.name_constraints,
            )
        })
    );

    let config = ClientConfig::builder()
        .with_safe_default_cipher_suites()
        .with_safe_default_kx_groups()
        .with_protocol_versions(&[&TLS13])?  // TLS 1.3 only
        .with_root_certificates(root_store)
        .with_no_client_auth();

    Ok(config)
}
```

### HTTP Security Headers

```rust
use axum::{
    http::{HeaderMap, HeaderValue},
    middleware::Next,
    response::Response,
};

pub async fn security_headers_middleware(
    mut response: Response,
    next: Next,
) -> Response {
    let headers = response.headers_mut();

    // HSTS (HTTP Strict Transport Security)
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
    );

    // Content Security Policy
    headers.insert(
        "Content-Security-Policy",
        HeaderValue::from_static(
            "default-src 'self'; \
             script-src 'self' 'unsafe-inline' 'unsafe-eval'; \
             style-src 'self' 'unsafe-inline'; \
             img-src 'self' data: https:; \
             font-src 'self' data:; \
             connect-src 'self' wss: https:; \
             frame-ancestors 'none'; \
             base-uri 'self'; \
             form-action 'self'"
        ),
    );

    // X-Content-Type-Options
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );

    // X-Frame-Options
    headers.insert(
        "X-Frame-Options",
        HeaderValue::from_static("DENY"),
    );

    // X-XSS-Protection
    headers.insert(
        "X-XSS-Protection",
        HeaderValue::from_static("1; mode=block"),
    );

    // Referrer-Policy
    headers.insert(
        "Referrer-Policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    // Permissions-Policy
    headers.insert(
        "Permissions-Policy",
        HeaderValue::from_static(
            "geolocation=(), microphone=(), camera=(), payment=()"
        ),
    );

    response
}
```

---

## Key Management

### Vault Integration

```rust
use vaultrs::{client::{VaultClient, VaultClientSettingsBuilder}, kv2};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct VaultKeyManager {
    client: VaultClient,
    mount: String,
}

impl VaultKeyManager {
    pub async fn new(
        vault_addr: &str,
        vault_token: &str,
        mount: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let settings = VaultClientSettingsBuilder::default()
            .address(vault_addr)
            .token(vault_token)
            .build()?;

        let client = VaultClient::new(settings)?;

        Ok(Self {
            client,
            mount: mount.to_string(),
        })
    }

    /// Get encryption key from Vault
    pub async fn get_encryption_key(
        &self,
        key_name: &str,
    ) -> Result<[u8; 32], Box<dyn std::error::Error>> {
        let secret: VaultSecret = kv2::read(&self.client, &self.mount, key_name).await?;

        let key_str = secret
            .key
            .ok_or("Key not found in vault")?;

        let key_bytes = base64::engine::general_purpose::STANDARD.decode(key_str)?;

        if key_bytes.len() != 32 {
            return Err("Invalid key length".into());
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);

        Ok(key)
    }

    /// Store encryption key in Vault
    pub async fn store_encryption_key(
        &self,
        key_name: &str,
        key: &[u8; 32],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let key_str = base64::engine::general_purpose::STANDARD.encode(key);

        let secret = VaultSecret {
            key: Some(key_str),
        };

        kv2::set(&self.client, &self.mount, key_name, &secret).await?;

        Ok(())
    }

    /// Rotate encryption key
    pub async fn rotate_key(
        &self,
        key_name: &str,
    ) -> Result<[u8; 32], Box<dyn std::error::Error>> {
        // Generate new key
        let mut new_key = [0u8; 32];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut new_key);

        // Store old key with version suffix
        let old_key = self.get_encryption_key(key_name).await?;
        let version = chrono::Utc::now().timestamp();
        self.store_encryption_key(
            &format!("{}_v{}", key_name, version),
            &old_key,
        ).await?;

        // Store new key
        self.store_encryption_key(key_name, &new_key).await?;

        Ok(new_key)
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct VaultSecret {
    key: Option<String>,
}
```

### Key Derivation (for password-based encryption)

```rust
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::{SaltString, rand_core::OsRng};

pub struct KeyDerivation {
    argon2: Argon2<'static>,
}

impl KeyDerivation {
    pub fn new() -> Self {
        Self {
            argon2: Argon2::default(),
        }
    }

    /// Derive encryption key from password
    pub fn derive_key(
        &self,
        password: &str,
        salt: &[u8],
    ) -> Result<[u8; 32], EncryptionError> {
        use argon2::password_hash::PasswordHash;

        let salt_string = SaltString::b64_encode(salt)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;

        let password_hash = self
            .argon2
            .hash_password(password.as_bytes(), &salt_string)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;

        let hash = password_hash.hash.unwrap();
        let mut key = [0u8; 32];
        key.copy_from_slice(&hash.as_bytes()[..32]);

        Ok(key)
    }

    /// Generate random salt
    pub fn generate_salt() -> [u8; 16] {
        let mut salt = [0u8; 16];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut salt);
        salt
    }
}
```

---

## Secret Rotation

### Automated Secret Rotation

```rust
use tokio::time::{interval, Duration};

pub struct SecretRotationService {
    vault_manager: Arc<VaultKeyManager>,
    encryption_service: Arc<RwLock<EncryptionService>>,
    database_pool: Arc<sqlx::PgPool>,
}

impl SecretRotationService {
    pub fn new(
        vault_manager: Arc<VaultKeyManager>,
        encryption_service: Arc<RwLock<EncryptionService>>,
        database_pool: Arc<sqlx::PgPool>,
    ) -> Self {
        Self {
            vault_manager,
            encryption_service,
            database_pool,
        }
    }

    /// Start automatic rotation schedule (every 90 days)
    pub async fn start_rotation_schedule(self: Arc<Self>) {
        let mut interval = interval(Duration::from_secs(90 * 24 * 60 * 60)); // 90 days

        loop {
            interval.tick().await;

            if let Err(e) = self.rotate_all_secrets().await {
                tracing::error!("Secret rotation failed: {}", e);
            }
        }
    }

    /// Rotate all secrets
    async fn rotate_all_secrets(&self) -> Result<(), Box<dyn std::error::Error>> {
        tracing::info!("Starting secret rotation");

        // 1. Rotate encryption key
        let new_key = self.vault_manager.rotate_key("database_encryption_key").await?;

        // 2. Re-encrypt all encrypted fields with new key
        self.re_encrypt_database_fields(&new_key).await?;

        // 3. Update encryption service with new key
        {
            let mut service = self.encryption_service.write().await;
            *service = EncryptionService::new(&new_key);
        }

        // 4. Rotate JWT secret
        self.rotate_jwt_secret().await?;

        // 5. Rotate API keys (mark for rotation, users will get new keys on next use)
        self.mark_api_keys_for_rotation().await?;

        tracing::info!("Secret rotation completed successfully");

        Ok(())
    }

    async fn re_encrypt_database_fields(
        &self,
        new_key: &[u8; 32],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let old_service = self.encryption_service.read().await.clone();
        let new_service = EncryptionService::new(new_key);

        // Re-encrypt user SSNs
        let users: Vec<User> = sqlx::query_as("SELECT * FROM users")
            .fetch_all(&*self.database_pool)
            .await?;

        for user in users {
            // Decrypt with old key
            let ssn = user.encrypted_ssn.decrypt(&old_service)?;
            let api_token = user.encrypted_api_token.decrypt(&old_service)?;

            // Encrypt with new key
            let new_encrypted_ssn = EncryptedString::new(&ssn, &new_service)?;
            let new_encrypted_api_token = EncryptedString::new(&api_token, &new_service)?;

            // Update database
            sqlx::query(
                "UPDATE users SET encrypted_ssn = $1, encrypted_api_token = $2 WHERE id = $3"
            )
            .bind(new_encrypted_ssn.ciphertext())
            .bind(new_encrypted_api_token.ciphertext())
            .bind(&user.id)
            .execute(&*self.database_pool)
            .await?;
        }

        Ok(())
    }

    async fn rotate_jwt_secret(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Generate new JWT secret
        let mut new_secret = [0u8; 32];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut new_secret);

        // Store in Vault
        self.vault_manager
            .store_encryption_key("jwt_secret", &new_secret)
            .await?;

        // Invalidate all existing tokens (users will need to re-authenticate)
        sqlx::query("UPDATE sessions SET invalidated = true")
            .execute(&*self.database_pool)
            .await?;

        Ok(())
    }

    async fn mark_api_keys_for_rotation(&self) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query("UPDATE api_keys SET rotation_required = true WHERE rotation_required = false")
            .execute(&*self.database_pool)
            .await?;

        Ok(())
    }
}
```

---

## PII Handling and Redaction

### PII Detection and Classification

```rust
use regex::Regex;

#[derive(Debug, Clone, PartialEq)]
pub enum PiiType {
    Email,
    Phone,
    Ssn,
    CreditCard,
    IpAddress,
    Name,
    Address,
}

pub struct PiiDetector {
    email_regex: Regex,
    phone_regex: Regex,
    ssn_regex: Regex,
    credit_card_regex: Regex,
    ip_regex: Regex,
}

impl PiiDetector {
    pub fn new() -> Self {
        Self {
            email_regex: Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap(),
            phone_regex: Regex::new(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b").unwrap(),
            ssn_regex: Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").unwrap(),
            credit_card_regex: Regex::new(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b").unwrap(),
            ip_regex: Regex::new(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b").unwrap(),
        }
    }

    /// Detect all PII in text
    pub fn detect(&self, text: &str) -> Vec<PiiMatch> {
        let mut matches = Vec::new();

        for capture in self.email_regex.find_iter(text) {
            matches.push(PiiMatch {
                pii_type: PiiType::Email,
                value: capture.as_str().to_string(),
                start: capture.start(),
                end: capture.end(),
            });
        }

        for capture in self.phone_regex.find_iter(text) {
            matches.push(PiiMatch {
                pii_type: PiiType::Phone,
                value: capture.as_str().to_string(),
                start: capture.start(),
                end: capture.end(),
            });
        }

        for capture in self.ssn_regex.find_iter(text) {
            matches.push(PiiMatch {
                pii_type: PiiType::Ssn,
                value: capture.as_str().to_string(),
                start: capture.start(),
                end: capture.end(),
            });
        }

        for capture in self.credit_card_regex.find_iter(text) {
            if self.is_valid_credit_card(capture.as_str()) {
                matches.push(PiiMatch {
                    pii_type: PiiType::CreditCard,
                    value: capture.as_str().to_string(),
                    start: capture.start(),
                    end: capture.end(),
                });
            }
        }

        for capture in self.ip_regex.find_iter(text) {
            matches.push(PiiMatch {
                pii_type: PiiType::IpAddress,
                value: capture.as_str().to_string(),
                start: capture.start(),
                end: capture.end(),
            });
        }

        matches
    }

    fn is_valid_credit_card(&self, number: &str) -> bool {
        // Luhn algorithm for credit card validation
        let digits: Vec<u32> = number
            .chars()
            .filter(|c| c.is_numeric())
            .map(|c| c.to_digit(10).unwrap())
            .collect();

        if digits.len() < 13 || digits.len() > 19 {
            return false;
        }

        let sum: u32 = digits
            .iter()
            .rev()
            .enumerate()
            .map(|(i, &d)| {
                if i % 2 == 1 {
                    let doubled = d * 2;
                    if doubled > 9 {
                        doubled - 9
                    } else {
                        doubled
                    }
                } else {
                    d
                }
            })
            .sum();

        sum % 10 == 0
    }
}

#[derive(Debug, Clone)]
pub struct PiiMatch {
    pub pii_type: PiiType,
    pub value: String,
    pub start: usize,
    pub end: usize,
}
```

### PII Redaction

```rust
pub struct PiiRedactor {
    detector: PiiDetector,
}

impl PiiRedactor {
    pub fn new() -> Self {
        Self {
            detector: PiiDetector::new(),
        }
    }

    /// Redact all PII in text
    pub fn redact(&self, text: &str) -> String {
        let matches = self.detector.detect(text);

        if matches.is_empty() {
            return text.to_string();
        }

        let mut result = text.to_string();

        // Sort matches by start position in reverse order
        let mut sorted_matches = matches;
        sorted_matches.sort_by(|a, b| b.start.cmp(&a.start));

        // Replace from end to start to maintain indices
        for pii_match in sorted_matches {
            let redacted = self.redact_value(&pii_match);
            result.replace_range(pii_match.start..pii_match.end, &redacted);
        }

        result
    }

    fn redact_value(&self, pii_match: &PiiMatch) -> String {
        match pii_match.pii_type {
            PiiType::Email => {
                let parts: Vec<&str> = pii_match.value.split('@').collect();
                if parts.len() == 2 {
                    let local = parts[0];
                    let domain = parts[1];
                    if local.len() > 2 {
                        format!("{}***@{}", &local[..2], domain)
                    } else {
                        format!("***@{}", domain)
                    }
                } else {
                    "[EMAIL REDACTED]".to_string()
                }
            }
            PiiType::Phone => {
                let digits: String = pii_match.value.chars().filter(|c| c.is_numeric()).collect();
                if digits.len() >= 4 {
                    format!("***-***-{}", &digits[digits.len() - 4..])
                } else {
                    "[PHONE REDACTED]".to_string()
                }
            }
            PiiType::Ssn => "***-**-****".to_string(),
            PiiType::CreditCard => {
                let digits: String = pii_match.value.chars().filter(|c| c.is_numeric()).collect();
                if digits.len() >= 4 {
                    format!("****-****-****-{}", &digits[digits.len() - 4..])
                } else {
                    "[CARD REDACTED]".to_string()
                }
            }
            PiiType::IpAddress => "[IP REDACTED]".to_string(),
            PiiType::Name => "[NAME REDACTED]".to_string(),
            PiiType::Address => "[ADDRESS REDACTED]".to_string(),
        }
    }

    /// Hash PII for audit logs (one-way, preserves uniqueness)
    pub fn hash_pii(&self, text: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_redaction() {
        let redactor = PiiRedactor::new();
        let text = "Contact me at john.doe@example.com";
        let redacted = redactor.redact(text);
        assert!(redacted.contains("jo***@example.com"));
    }

    #[test]
    fn test_ssn_redaction() {
        let redactor = PiiRedactor::new();
        let text = "SSN: 123-45-6789";
        let redacted = redactor.redact(text);
        assert!(redacted.contains("***-**-****"));
    }
}
```

### Logging with PII Redaction

```rust
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::{Context, Layer};

pub struct PiiRedactionLayer {
    redactor: Arc<PiiRedactor>,
}

impl PiiRedactionLayer {
    pub fn new() -> Self {
        Self {
            redactor: Arc::new(PiiRedactor::new()),
        }
    }
}

impl<S: Subscriber> Layer<S> for PiiRedactionLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        // Intercept log events and redact PII before writing
        // This is a simplified example - full implementation would need
        // to process all fields in the event

        event.record(&mut PiiRedactingVisitor {
            redactor: self.redactor.clone(),
        });
    }
}

struct PiiRedactingVisitor {
    redactor: Arc<PiiRedactor>,
}

impl tracing::field::Visit for PiiRedactingVisitor {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        let redacted = self.redactor.redact(value);
        // Record redacted value
        tracing::info!(field = field.name(), value = %redacted);
    }

    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let text = format!("{:?}", value);
        let redacted = self.redactor.redact(&text);
        tracing::info!(field = field.name(), value = %redacted);
    }
}
```

---

## GDPR Compliance

### Data Subject Rights

```rust
use async_trait::async_trait;

#[async_trait]
pub trait GdprService: Send + Sync {
    /// Right to access - export all user data
    async fn export_user_data(
        &self,
        user_id: &str,
    ) -> Result<UserDataExport, Box<dyn std::error::Error>>;

    /// Right to erasure - delete all user data
    async fn delete_user_data(
        &self,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>>;

    /// Right to rectification - update user data
    async fn update_user_data(
        &self,
        user_id: &str,
        updates: UserDataUpdates,
    ) -> Result<(), Box<dyn std::error::Error>>;

    /// Right to data portability - export in machine-readable format
    async fn export_user_data_json(
        &self,
        user_id: &str,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>>;
}

#[derive(Debug, Serialize)]
pub struct UserDataExport {
    pub personal_info: PersonalInfo,
    pub workflows: Vec<WorkflowData>,
    pub incidents: Vec<IncidentData>,
    pub audit_logs: Vec<AuditLogEntry>,
    pub api_keys: Vec<ApiKeyData>,
}

#[derive(Debug, Deserialize)]
pub struct UserDataUpdates {
    pub email: Option<String>,
    pub name: Option<String>,
    pub preferences: Option<serde_json::Value>,
}
```

---

## Summary

This data protection architecture provides:

1. **Encryption at Rest**: AES-256-GCM for database and file encryption
2. **Encryption in Transit**: TLS 1.3 with strong cipher suites
3. **Key Management**: HashiCorp Vault integration with automated rotation
4. **Secret Rotation**: Automated 90-day rotation with re-encryption
5. **PII Protection**: Detection, redaction, and hashing for compliance
6. **GDPR Compliance**: Data export, deletion, and portability

---

**Next Document:** [04-input-validation-architecture.md](./04-input-validation-architecture.md)
