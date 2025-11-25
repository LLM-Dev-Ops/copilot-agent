# Authentication Architecture

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-25

## Overview

This document defines the authentication architecture for LLM-CoPilot-Agent, implementing OAuth 2.0 with PKCE, JWT tokens, multi-factor authentication, and service-to-service mTLS authentication to meet SOC 2 Type II compliance requirements.

---

## Table of Contents

1. [Authentication Flows](#authentication-flows)
2. [OAuth 2.0 with PKCE](#oauth-20-with-pkce)
3. [JWT Token Structure](#jwt-token-structure)
4. [Token Management](#token-management)
5. [Multi-Factor Authentication](#multi-factor-authentication)
6. [API Key Management](#api-key-management)
7. [Service-to-Service Authentication](#service-to-service-authentication)
8. [Rust Implementation](#rust-implementation)

---

## Authentication Flows

### 1. Human User Authentication (OAuth 2.0 + PKCE)

```
┌─────────┐                                ┌──────────────┐                           ┌─────────┐
│ Browser │                                │ LLM-CoPilot  │                           │  Auth   │
│ Client  │                                │   Agent API  │                           │ Provider│
└────┬────┘                                └──────┬───────┘                           └────┬────┘
     │                                            │                                        │
     │ 1. Request /auth/login                     │                                        │
     ├───────────────────────────────────────────>│                                        │
     │                                            │                                        │
     │ 2. Generate code_verifier, code_challenge  │                                        │
     │    Redirect to OAuth provider              │                                        │
     │<───────────────────────────────────────────┤                                        │
     │                                            │                                        │
     │ 3. Authorization request + code_challenge  │                                        │
     ├────────────────────────────────────────────┼───────────────────────────────────────>│
     │                                            │                                        │
     │ 4. User authenticates + authorizes         │                                        │
     │<───────────────────────────────────────────┼────────────────────────────────────────┤
     │                                            │                                        │
     │ 5. Redirect with authorization code        │                                        │
     │<───────────────────────────────────────────┼────────────────────────────────────────┤
     │                                            │                                        │
     │ 6. Exchange code + code_verifier for token │                                        │
     ├───────────────────────────────────────────>│                                        │
     │                                            │                                        │
     │                                            │ 7. Validate code + code_verifier       │
     │                                            ├───────────────────────────────────────>│
     │                                            │                                        │
     │                                            │ 8. Return access_token, refresh_token  │
     │                                            │<───────────────────────────────────────┤
     │                                            │                                        │
     │ 9. Issue JWT (access + refresh tokens)     │                                        │
     │<───────────────────────────────────────────┤                                        │
     │                                            │                                        │
     │ 10. API requests with JWT Bearer token     │                                        │
     ├───────────────────────────────────────────>│                                        │
     │                                            │                                        │
```

### 2. Service-to-Service Authentication (mTLS)

```
┌──────────────┐                                 ┌──────────────┐
│   Service A  │                                 │  Service B   │
│ (Test-Bench) │                                 │ (CoPilot API)│
└──────┬───────┘                                 └──────┬───────┘
       │                                                │
       │ 1. TLS Handshake with Client Certificate      │
       ├───────────────────────────────────────────────>│
       │                                                │
       │ 2. Verify Client Certificate (CA chain)       │
       │<───────────────────────────────────────────────┤
       │                                                │
       │ 3. Present Server Certificate                  │
       │<───────────────────────────────────────────────┤
       │                                                │
       │ 4. Verify Server Certificate                   │
       ├───────────────────────────────────────────────>│
       │                                                │
       │ 5. Establish mTLS connection                   │
       │<──────────────────────────────────────────────>│
       │                                                │
       │ 6. gRPC requests with service identity         │
       ├───────────────────────────────────────────────>│
       │                                                │
```

### 3. API Key Authentication (Machine Clients)

```
┌──────────────┐                                 ┌──────────────┐
│   CI/CD      │                                 │  CoPilot API │
│   Pipeline   │                                 │              │
└──────┬───────┘                                 └──────┬───────┘
       │                                                │
       │ 1. API Request + X-API-Key header              │
       ├───────────────────────────────────────────────>│
       │                                                │
       │ 2. Validate API Key (hash lookup)              │
       │                                      ┌─────────┴─────────┐
       │                                      │ API Key Store     │
       │                                      │ (Redis/Postgres)  │
       │                                      └─────────┬─────────┘
       │                                                │
       │ 3. Check rate limits, permissions              │
       │<───────────────────────────────────────────────┤
       │                                                │
       │ 4. Process request                             │
       │<──────────────────────────────────────────────>│
       │                                                │
```

---

## OAuth 2.0 with PKCE

### PKCE Flow Implementation

**PKCE (Proof Key for Code Exchange)** protects against authorization code interception attacks, especially for public clients (SPAs, mobile apps).

#### Step 1: Generate Code Verifier and Challenge

```rust
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};

/// Generate a cryptographically secure code verifier
pub fn generate_code_verifier() -> String {
    let random_bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}

/// Generate code challenge from verifier using SHA256
pub fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(&hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_verifier_length() {
        let verifier = generate_code_verifier();
        assert!(verifier.len() >= 43 && verifier.len() <= 128);
    }

    #[test]
    fn test_code_challenge_deterministic() {
        let verifier = "test_verifier";
        let challenge1 = generate_code_challenge(verifier);
        let challenge2 = generate_code_challenge(verifier);
        assert_eq!(challenge1, challenge2);
    }
}
```

#### Step 2: Authorization Request

```rust
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Debug, Serialize)]
pub struct AuthorizationRequest {
    pub response_type: String,         // "code"
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: String,
    pub state: String,                 // CSRF protection
    pub code_challenge: String,
    pub code_challenge_method: String, // "S256"
}

impl AuthorizationRequest {
    pub fn build_url(&self, auth_endpoint: &str) -> Result<String, url::ParseError> {
        let mut url = Url::parse(auth_endpoint)?;

        url.query_pairs_mut()
            .append_pair("response_type", &self.response_type)
            .append_pair("client_id", &self.client_id)
            .append_pair("redirect_uri", &self.redirect_uri)
            .append_pair("scope", &self.scope)
            .append_pair("state", &self.state)
            .append_pair("code_challenge", &self.code_challenge)
            .append_pair("code_challenge_method", &self.code_challenge_method);

        Ok(url.to_string())
    }
}

/// Generate CSRF state token
pub fn generate_state() -> String {
    let random_bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}
```

#### Step 3: Token Exchange

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct TokenRequest {
    pub grant_type: String,      // "authorization_code"
    pub code: String,
    pub redirect_uri: String,
    pub client_id: String,
    pub code_verifier: String,
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: String,
}

pub async fn exchange_code_for_token(
    token_endpoint: &str,
    request: TokenRequest,
) -> Result<TokenResponse, Box<dyn std::error::Error>> {
    let client = Client::new();

    let response = client
        .post(token_endpoint)
        .form(&request)
        .send()
        .await?
        .json::<TokenResponse>()
        .await?;

    Ok(response)
}
```

---

## JWT Token Structure

### Access Token Claims

```rust
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessTokenClaims {
    // Standard JWT claims
    pub iss: String,              // Issuer: "llm-copilot-agent"
    pub sub: String,              // Subject: user ID
    pub aud: Vec<String>,         // Audience: ["api", "websocket"]
    pub exp: i64,                 // Expiration time (Unix timestamp)
    pub nbf: i64,                 // Not before (Unix timestamp)
    pub iat: i64,                 // Issued at (Unix timestamp)
    pub jti: String,              // JWT ID (unique identifier)

    // Custom claims
    pub user_id: String,          // User UUID
    pub email: String,            // User email
    pub roles: Vec<String>,       // ["admin", "developer"]
    pub permissions: Vec<String>, // ["workflow:execute", "incident:create"]
    pub tenant_id: Option<String>,// Multi-tenancy support
    pub session_id: String,       // Session identifier
    pub mfa_verified: bool,       // MFA completion status
    pub ip_address: String,       // Client IP (for audit)

    // Security metadata
    pub auth_method: String,      // "oauth2", "api_key", "mtls"
    pub device_id: Option<String>,// Device fingerprint
}

impl AccessTokenClaims {
    pub fn new(
        user_id: String,
        email: String,
        roles: Vec<String>,
        permissions: Vec<String>,
        ip_address: String,
    ) -> Self {
        let now = Utc::now();
        let exp = now + Duration::minutes(15); // 15-minute access tokens

        Self {
            iss: "llm-copilot-agent".to_string(),
            sub: user_id.clone(),
            aud: vec!["api".to_string(), "websocket".to_string()],
            exp: exp.timestamp(),
            nbf: now.timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
            user_id,
            email,
            roles,
            permissions,
            tenant_id: None,
            session_id: Uuid::new_v4().to_string(),
            mfa_verified: false,
            ip_address,
            auth_method: "oauth2".to_string(),
            device_id: None,
        }
    }

    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() >= self.exp
    }

    /// Check if user has specific role
    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }

    /// Check if user has specific permission
    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.iter().any(|p| p == permission)
    }
}
```

### Refresh Token Claims

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub iss: String,
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,

    pub user_id: String,
    pub session_id: String,
    pub rotation_count: u32,      // Track token rotation
    pub fingerprint_hash: String, // Device fingerprint hash
}

impl RefreshTokenClaims {
    pub fn new(user_id: String, session_id: String, fingerprint: &str) -> Self {
        let now = Utc::now();
        let exp = now + Duration::days(30); // 30-day refresh tokens

        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(fingerprint.as_bytes());
        let fingerprint_hash = format!("{:x}", hasher.finalize());

        Self {
            iss: "llm-copilot-agent".to_string(),
            sub: user_id.clone(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
            user_id,
            session_id,
            rotation_count: 0,
            fingerprint_hash,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() >= self.exp
    }
}
```

### Token Encoding/Decoding

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TokenError {
    #[error("Token encoding failed: {0}")]
    EncodingError(#[from] jsonwebtoken::errors::Error),

    #[error("Token has expired")]
    Expired,

    #[error("Invalid token signature")]
    InvalidSignature,

    #[error("Token fingerprint mismatch")]
    FingerprintMismatch,
}

pub struct TokenService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    issuer: String,
}

impl TokenService {
    pub fn new(secret: &[u8]) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
            issuer: "llm-copilot-agent".to_string(),
        }
    }

    /// Encode access token
    pub fn encode_access_token(
        &self,
        claims: &AccessTokenClaims,
    ) -> Result<String, TokenError> {
        let header = Header::new(Algorithm::HS256);
        encode(&header, claims, &self.encoding_key).map_err(TokenError::from)
    }

    /// Decode and validate access token
    pub fn decode_access_token(
        &self,
        token: &str,
    ) -> Result<AccessTokenClaims, TokenError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[&self.issuer]);
        validation.set_audience(&["api", "websocket"]);

        let token_data = decode::<AccessTokenClaims>(token, &self.decoding_key, &validation)?;

        if token_data.claims.is_expired() {
            return Err(TokenError::Expired);
        }

        Ok(token_data.claims)
    }

    /// Encode refresh token
    pub fn encode_refresh_token(
        &self,
        claims: &RefreshTokenClaims,
    ) -> Result<String, TokenError> {
        let header = Header::new(Algorithm::HS256);
        encode(&header, claims, &self.encoding_key).map_err(TokenError::from)
    }

    /// Decode and validate refresh token
    pub fn decode_refresh_token(
        &self,
        token: &str,
        fingerprint: &str,
    ) -> Result<RefreshTokenClaims, TokenError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[&self.issuer]);
        validation.validate_aud = false;

        let token_data = decode::<RefreshTokenClaims>(token, &self.decoding_key, &validation)?;

        if token_data.claims.is_expired() {
            return Err(TokenError::Expired);
        }

        // Verify fingerprint
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(fingerprint.as_bytes());
        let fingerprint_hash = format!("{:x}", hasher.finalize());

        if token_data.claims.fingerprint_hash != fingerprint_hash {
            return Err(TokenError::FingerprintMismatch);
        }

        Ok(token_data.claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_roundtrip() {
        let service = TokenService::new(b"test-secret-key-32-bytes-long!!");

        let claims = AccessTokenClaims::new(
            "user123".to_string(),
            "user@example.com".to_string(),
            vec!["developer".to_string()],
            vec!["workflow:execute".to_string()],
            "127.0.0.1".to_string(),
        );

        let token = service.encode_access_token(&claims).unwrap();
        let decoded = service.decode_access_token(&token).unwrap();

        assert_eq!(decoded.user_id, "user123");
        assert_eq!(decoded.email, "user@example.com");
    }
}
```

---

## Token Management

### Token Storage and Revocation

```rust
use async_trait::async_trait;
use redis::AsyncCommands;
use std::sync::Arc;

#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn store_refresh_token(
        &self,
        token_id: &str,
        user_id: &str,
        expires_at: i64,
    ) -> Result<(), Box<dyn std::error::Error>>;

    async fn revoke_token(&self, token_id: &str) -> Result<(), Box<dyn std::error::Error>>;

    async fn is_token_revoked(&self, token_id: &str) -> Result<bool, Box<dyn std::error::Error>>;

    async fn revoke_all_user_tokens(&self, user_id: &str) -> Result<(), Box<dyn std::error::Error>>;
}

pub struct RedisTokenStore {
    client: redis::Client,
}

impl RedisTokenStore {
    pub fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        Ok(Self {
            client: redis::Client::open(redis_url)?,
        })
    }
}

#[async_trait]
impl TokenStore for RedisTokenStore {
    async fn store_refresh_token(
        &self,
        token_id: &str,
        user_id: &str,
        expires_at: i64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let key = format!("refresh_token:{}", token_id);
        let ttl = (expires_at - Utc::now().timestamp()) as usize;

        conn.set_ex(&key, user_id, ttl).await?;

        // Also maintain user -> tokens mapping
        let user_tokens_key = format!("user_tokens:{}", user_id);
        conn.sadd(&user_tokens_key, token_id).await?;
        conn.expire(&user_tokens_key, ttl).await?;

        Ok(())
    }

    async fn revoke_token(&self, token_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let key = format!("revoked_token:{}", token_id);
        // Store revocation for 30 days
        conn.set_ex(&key, "1", 30 * 24 * 60 * 60).await?;

        Ok(())
    }

    async fn is_token_revoked(&self, token_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let key = format!("revoked_token:{}", token_id);
        let exists: bool = conn.exists(&key).await?;

        Ok(exists)
    }

    async fn revoke_all_user_tokens(
        &self,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let user_tokens_key = format!("user_tokens:{}", user_id);
        let token_ids: Vec<String> = conn.smembers(&user_tokens_key).await?;

        for token_id in token_ids {
            self.revoke_token(&token_id).await?;
        }

        conn.del(&user_tokens_key).await?;

        Ok(())
    }
}
```

### Token Refresh Flow

```rust
use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
    pub device_fingerprint: String,
}

#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub token_type: String,
}

pub async fn refresh_token_handler(
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<RefreshResponse>, StatusCode> {
    // 1. Decode and validate refresh token
    let refresh_claims = app_state
        .token_service
        .decode_refresh_token(&payload.refresh_token, &payload.device_fingerprint)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // 2. Check if token is revoked
    let is_revoked = app_state
        .token_store
        .is_token_revoked(&refresh_claims.jti)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if is_revoked {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 3. Revoke old refresh token
    app_state
        .token_store
        .revoke_token(&refresh_claims.jti)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. Load user data (roles, permissions)
    let user = app_state
        .user_repository
        .get_user(&refresh_claims.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Create new access token
    let access_claims = AccessTokenClaims::new(
        user.id.clone(),
        user.email.clone(),
        user.roles.clone(),
        user.permissions.clone(),
        "0.0.0.0".to_string(), // IP not available in refresh flow
    );

    let access_token = app_state
        .token_service
        .encode_access_token(&access_claims)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 6. Create new refresh token (rotation)
    let mut new_refresh_claims = RefreshTokenClaims::new(
        user.id.clone(),
        refresh_claims.session_id.clone(),
        &payload.device_fingerprint,
    );
    new_refresh_claims.rotation_count = refresh_claims.rotation_count + 1;

    let new_refresh_token = app_state
        .token_service
        .encode_refresh_token(&new_refresh_claims)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 7. Store new refresh token
    app_state
        .token_store
        .store_refresh_token(
            &new_refresh_claims.jti,
            &user.id,
            new_refresh_claims.exp,
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RefreshResponse {
        access_token,
        refresh_token: new_refresh_token,
        expires_in: 900, // 15 minutes
        token_type: "Bearer".to_string(),
    }))
}
```

---

## Multi-Factor Authentication

### TOTP (Time-based One-Time Password)

```rust
use totp_rs::{Algorithm, Secret, TOTP};

pub struct MfaService {
    issuer: String,
}

impl MfaService {
    pub fn new(issuer: String) -> Self {
        Self { issuer }
    }

    /// Generate TOTP secret for user enrollment
    pub fn generate_secret(&self, user_email: &str) -> Result<(String, String), Box<dyn std::error::Error>> {
        let secret = Secret::generate_secret();
        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            secret.to_bytes().unwrap(),
            Some(self.issuer.clone()),
            user_email.to_string(),
        )?;

        let qr_code_url = totp.get_qr_base64()?;
        let secret_string = secret.to_encoded().to_string();

        Ok((secret_string, qr_code_url))
    }

    /// Verify TOTP code
    pub fn verify_totp(
        &self,
        secret: &str,
        code: &str,
        user_email: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            Secret::Encoded(secret.to_string()).to_bytes().unwrap(),
            Some(self.issuer.clone()),
            user_email.to_string(),
        )?;

        Ok(totp.check_current(code)?)
    }
}
```

### MFA Enrollment Flow

```rust
#[derive(Debug, Serialize)]
pub struct MfaEnrollmentResponse {
    pub secret: String,
    pub qr_code: String,
    pub backup_codes: Vec<String>,
}

pub async fn mfa_enrollment_handler(
    State(app_state): State<Arc<AppState>>,
    claims: AccessTokenClaims, // From JWT middleware
) -> Result<Json<MfaEnrollmentResponse>, StatusCode> {
    // 1. Generate TOTP secret
    let (secret, qr_code) = app_state
        .mfa_service
        .generate_secret(&claims.email)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. Generate backup codes
    let backup_codes = generate_backup_codes(10);

    // 3. Store secret (hashed) and backup codes in database
    app_state
        .user_repository
        .store_mfa_secret(&claims.user_id, &secret, &backup_codes)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(MfaEnrollmentResponse {
        secret,
        qr_code,
        backup_codes,
    }))
}

fn generate_backup_codes(count: usize) -> Vec<String> {
    (0..count)
        .map(|_| {
            let random_bytes: Vec<u8> = (0..4).map(|_| rand::thread_rng().gen()).collect();
            format!("{:08x}", u32::from_be_bytes(random_bytes.try_into().unwrap()))
        })
        .collect()
}
```

### MFA Verification Flow

```rust
#[derive(Debug, Deserialize)]
pub struct MfaVerifyRequest {
    pub code: String,
}

pub async fn mfa_verify_handler(
    State(app_state): State<Arc<AppState>>,
    mut claims: AccessTokenClaims,
    Json(payload): Json<MfaVerifyRequest>,
) -> Result<Json<RefreshResponse>, StatusCode> {
    // 1. Get user's MFA secret
    let mfa_data = app_state
        .user_repository
        .get_mfa_secret(&claims.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. Verify TOTP code
    let is_valid = app_state
        .mfa_service
        .verify_totp(&mfa_data.secret, &payload.code, &claims.email)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !is_valid {
        // Check if it's a backup code
        if !mfa_data.backup_codes.contains(&payload.code) {
            return Err(StatusCode::UNAUTHORIZED);
        }

        // Consume backup code
        app_state
            .user_repository
            .consume_backup_code(&claims.user_id, &payload.code)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // 3. Update token claims to mark MFA as verified
    claims.mfa_verified = true;

    // 4. Issue new tokens with MFA verified
    let access_token = app_state
        .token_service
        .encode_access_token(&claims)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_claims = RefreshTokenClaims::new(
        claims.user_id.clone(),
        claims.session_id.clone(),
        "fingerprint", // Should come from request
    );

    let refresh_token = app_state
        .token_service
        .encode_refresh_token(&refresh_claims)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RefreshResponse {
        access_token,
        refresh_token,
        expires_in: 900,
        token_type: "Bearer".to_string(),
    }))
}
```

---

## API Key Management

### API Key Generation and Storage

```rust
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

#[derive(Debug, Clone)]
pub struct ApiKey {
    pub id: String,
    pub key_hash: String,
    pub user_id: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub rate_limit: u32,
    pub created_at: chrono::DateTime<Utc>,
    pub expires_at: Option<chrono::DateTime<Utc>>,
    pub last_used_at: Option<chrono::DateTime<Utc>>,
}

pub struct ApiKeyService {
    argon2: Argon2<'static>,
}

impl ApiKeyService {
    pub fn new() -> Self {
        Self {
            argon2: Argon2::default(),
        }
    }

    /// Generate new API key
    pub fn generate_api_key(&self) -> (String, String) {
        // Generate random key: prefix_randomsecret
        let random_bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen()).collect();
        let random_part = URL_SAFE_NO_PAD.encode(&random_bytes);
        let key = format!("llm_copilot_{}", random_part);

        // Hash the key for storage
        let salt = SaltString::generate(&mut OsRng);
        let key_hash = self
            .argon2
            .hash_password(key.as_bytes(), &salt)
            .unwrap()
            .to_string();

        (key, key_hash)
    }

    /// Verify API key against hash
    pub fn verify_api_key(&self, key: &str, key_hash: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let parsed_hash = PasswordHash::new(key_hash)?;
        Ok(self.argon2.verify_password(key.as_bytes(), &parsed_hash).is_ok())
    }
}

#[async_trait]
pub trait ApiKeyRepository: Send + Sync {
    async fn create_api_key(&self, api_key: &ApiKey) -> Result<(), Box<dyn std::error::Error>>;
    async fn get_api_key_by_id(&self, key_id: &str) -> Result<Option<ApiKey>, Box<dyn std::error::Error>>;
    async fn list_user_api_keys(&self, user_id: &str) -> Result<Vec<ApiKey>, Box<dyn std::error::Error>>;
    async fn revoke_api_key(&self, key_id: &str) -> Result<(), Box<dyn std::error::Error>>;
    async fn update_last_used(&self, key_id: &str) -> Result<(), Box<dyn std::error::Error>>;
}
```

### API Key Middleware

```rust
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};

pub async fn api_key_auth_middleware(
    State(app_state): State<Arc<AppState>>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. Extract API key from X-API-Key header
    let api_key = headers
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 2. Parse key to get key ID (first part before random)
    let key_id = extract_key_id(api_key)?;

    // 3. Retrieve key data from database
    let key_data = app_state
        .api_key_repository
        .get_api_key_by_id(&key_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 4. Verify key hash
    let is_valid = app_state
        .api_key_service
        .verify_api_key(api_key, &key_data.key_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 5. Check expiration
    if let Some(expires_at) = key_data.expires_at {
        if Utc::now() > expires_at {
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    // 6. Check rate limits
    let rate_limit_ok = app_state
        .rate_limiter
        .check_api_key_rate_limit(&key_data.id, key_data.rate_limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !rate_limit_ok {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // 7. Update last used timestamp (async, don't wait)
    let repo = app_state.api_key_repository.clone();
    let key_id = key_data.id.clone();
    tokio::spawn(async move {
        let _ = repo.update_last_used(&key_id).await;
    });

    // 8. Attach key metadata to request extensions
    request.extensions_mut().insert(key_data);

    Ok(next.run(request).await)
}

fn extract_key_id(api_key: &str) -> Result<String, StatusCode> {
    // Hash the full API key to use as ID
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(api_key.as_bytes());
    Ok(format!("{:x}", hasher.finalize())[..16].to_string())
}
```

---

## Service-to-Service Authentication

### mTLS Configuration

```rust
use rustls::{Certificate, PrivateKey, RootCertStore, ServerConfig};
use std::fs::File;
use std::io::BufReader;
use std::sync::Arc;

pub struct MtlsConfig {
    pub ca_cert_path: String,
    pub server_cert_path: String,
    pub server_key_path: String,
    pub client_cert_path: String,
    pub client_key_path: String,
}

pub fn load_rustls_server_config(config: &MtlsConfig) -> Result<ServerConfig, Box<dyn std::error::Error>> {
    // Load server certificate and key
    let cert_file = File::open(&config.server_cert_path)?;
    let key_file = File::open(&config.server_key_path)?;

    let mut cert_reader = BufReader::new(cert_file);
    let mut key_reader = BufReader::new(key_file);

    let certs = rustls_pemfile::certs(&mut cert_reader)?
        .into_iter()
        .map(Certificate)
        .collect();

    let keys = rustls_pemfile::pkcs8_private_keys(&mut key_reader)?;
    let key = PrivateKey(keys[0].clone());

    // Load CA certificate for client verification
    let ca_file = File::open(&config.ca_cert_path)?;
    let mut ca_reader = BufReader::new(ca_file);
    let ca_certs = rustls_pemfile::certs(&mut ca_reader)?;

    let mut root_store = RootCertStore::empty();
    for cert in ca_certs {
        root_store.add(&Certificate(cert))?;
    }

    // Build server config with client authentication
    let mut server_config = ServerConfig::builder()
        .with_safe_defaults()
        .with_client_cert_verifier(Arc::new(
            rustls::server::AllowAnyAuthenticatedClient::new(root_store)
        ))
        .with_single_cert(certs, key)?;

    server_config.alpn_protocols = vec![b"h2".to_vec()]; // HTTP/2 for gRPC

    Ok(server_config)
}
```

### gRPC Service Authentication

```rust
use tonic::{Request, Status};

pub fn extract_service_identity<T>(request: &Request<T>) -> Result<String, Status> {
    // Extract CN (Common Name) from client certificate
    let peer_certs = request
        .peer_certs()
        .ok_or_else(|| Status::unauthenticated("No client certificate provided"))?;

    if peer_certs.is_empty() {
        return Err(Status::unauthenticated("Empty certificate chain"));
    }

    // Parse certificate to extract service identity
    let cert = &peer_certs[0];
    let service_name = extract_cn_from_cert(cert)?;

    Ok(service_name)
}

fn extract_cn_from_cert(cert_der: &[u8]) -> Result<String, Status> {
    use x509_parser::prelude::*;

    let (_, cert) = X509Certificate::from_der(cert_der)
        .map_err(|_| Status::unauthenticated("Invalid certificate"))?;

    let subject = cert.subject();
    let cn = subject
        .iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .ok_or_else(|| Status::unauthenticated("No CN in certificate"))?;

    Ok(cn.to_string())
}

/// gRPC interceptor for service authentication
pub fn service_auth_interceptor(mut req: Request<()>) -> Result<Request<()>, Status> {
    let service_identity = extract_service_identity(&req)?;

    // Validate service is allowed
    let allowed_services = vec![
        "llm-test-bench",
        "llm-observatory",
        "llm-incident-manager",
        "llm-orchestrator",
    ];

    if !allowed_services.contains(&service_identity.as_str()) {
        return Err(Status::permission_denied(format!(
            "Service '{}' not authorized",
            service_identity
        )));
    }

    // Attach service identity to request metadata
    req.metadata_mut().insert(
        "x-service-identity",
        service_identity.parse().unwrap(),
    );

    Ok(req)
}
```

---

## Complete Implementation Example

```rust
// src/security/mod.rs
pub mod authentication;
pub mod authorization;
pub mod tokens;
pub mod mfa;
pub mod api_keys;
pub mod mtls;

use axum::{
    Router,
    routing::{get, post},
};
use std::sync::Arc;

pub struct AppState {
    pub token_service: Arc<tokens::TokenService>,
    pub token_store: Arc<dyn tokens::TokenStore>,
    pub mfa_service: Arc<mfa::MfaService>,
    pub api_key_service: Arc<api_keys::ApiKeyService>,
    pub api_key_repository: Arc<dyn api_keys::ApiKeyRepository>,
    pub user_repository: Arc<dyn UserRepository>,
    pub rate_limiter: Arc<RateLimiter>,
}

pub fn create_auth_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/auth/login", get(authentication::login_handler))
        .route("/auth/callback", get(authentication::callback_handler))
        .route("/auth/refresh", post(tokens::refresh_token_handler))
        .route("/auth/logout", post(authentication::logout_handler))
        .route("/auth/mfa/enroll", post(mfa::mfa_enrollment_handler))
        .route("/auth/mfa/verify", post(mfa::mfa_verify_handler))
        .route("/api-keys", post(api_keys::create_api_key_handler))
        .route("/api-keys", get(api_keys::list_api_keys_handler))
        .route("/api-keys/:key_id", delete(api_keys::revoke_api_key_handler))
}
```

---

## Security Best Practices

### 1. Token Security
- Access tokens: 15-minute expiration
- Refresh tokens: 30-day expiration with rotation
- All tokens stored hashed in database
- Immediate revocation support
- Device fingerprinting for refresh tokens

### 2. Password Security
- Argon2id for password hashing
- Minimum password length: 12 characters
- Password complexity requirements enforced
- Rate limiting on authentication endpoints
- Account lockout after failed attempts

### 3. MFA Security
- TOTP with 30-second window
- Backup codes generated and hashed
- MFA required for privileged operations
- Recovery process with identity verification

### 4. API Key Security
- Cryptographically secure generation
- Argon2 hashing for storage
- Per-key rate limiting
- Scope-based permissions
- Automatic expiration support

### 5. Certificate Security
- TLS 1.3 minimum
- mTLS for service-to-service
- Certificate rotation every 90 days
- OCSP stapling for revocation
- Certificate pinning for critical services

---

**Next Document:** [02-authorization-architecture.md](./02-authorization-architecture.md)
