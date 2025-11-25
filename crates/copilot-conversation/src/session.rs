//! Session management for conversation tracking

use crate::{Result, ConversationError};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, info, warn};
use uuid::Uuid;

/// Session state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionState {
    /// Session is active
    Active,
    /// Session is idle (no recent activity)
    Idle,
    /// Session has expired
    Expired,
}

/// A conversation session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Unique session identifier
    pub id: String,
    /// Current session state
    pub state: SessionState,
    /// When the session was created
    pub created_at: DateTime<Utc>,
    /// When the session was last accessed
    pub last_accessed: DateTime<Utc>,
    /// Total tokens used in this session
    pub total_tokens: usize,
    /// Maximum tokens allowed for this session
    pub max_tokens: usize,
    /// Session metadata
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

impl Session {
    /// Create a new session
    pub fn new(max_tokens: usize) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            state: SessionState::Active,
            created_at: now,
            last_accessed: now,
            total_tokens: 0,
            max_tokens,
            metadata: HashMap::new(),
        }
    }

    /// Create a session with a specific ID
    pub fn with_id(id: String, max_tokens: usize) -> Self {
        let now = Utc::now();
        Self {
            id,
            state: SessionState::Active,
            created_at: now,
            last_accessed: now,
            total_tokens: 0,
            max_tokens,
            metadata: HashMap::new(),
        }
    }

    /// Check if session is expired based on timeout
    pub fn is_expired(&self, timeout: Duration) -> bool {
        Utc::now() - self.last_accessed > timeout
    }

    /// Update session access time
    pub fn touch(&mut self) {
        self.last_accessed = Utc::now();
        if self.state == SessionState::Idle {
            self.state = SessionState::Active;
        }
    }

    /// Add tokens to the session count
    pub fn add_tokens(&mut self, count: usize) -> Result<()> {
        let new_total = self.total_tokens + count;
        if new_total > self.max_tokens {
            return Err(ConversationError::TokenLimitExceeded {
                used: new_total,
                limit: self.max_tokens,
            });
        }
        self.total_tokens = new_total;
        Ok(())
    }

    /// Get remaining tokens
    pub fn remaining_tokens(&self) -> usize {
        self.max_tokens.saturating_sub(self.total_tokens)
    }
}

/// Configuration for session management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Session timeout duration (in seconds)
    pub timeout_seconds: i64,
    /// Idle timeout duration (in seconds)
    pub idle_timeout_seconds: i64,
    /// Default maximum tokens per session
    pub default_max_tokens: usize,
    /// Cleanup interval (in seconds)
    pub cleanup_interval_seconds: u64,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            timeout_seconds: 3600,      // 1 hour
            idle_timeout_seconds: 300,  // 5 minutes
            default_max_tokens: 100_000, // 100k tokens
            cleanup_interval_seconds: 300, // 5 minutes
        }
    }
}

/// Manages conversation sessions
pub struct SessionManager {
    sessions: HashMap<String, Session>,
    config: SessionConfig,
}

impl SessionManager {
    /// Create a new session manager with default configuration
    pub fn new() -> Self {
        Self::with_config(SessionConfig::default())
    }

    /// Create a new session manager with custom configuration
    pub fn with_config(config: SessionConfig) -> Self {
        Self {
            sessions: HashMap::new(),
            config,
        }
    }

    /// Create a new session
    ///
    /// # Arguments
    ///
    /// * `max_tokens` - Optional maximum tokens for this session (uses default if None)
    pub fn create_session(&mut self, max_tokens: Option<usize>) -> Session {
        let session = Session::new(max_tokens.unwrap_or(self.config.default_max_tokens));
        info!("Created new session: {}", session.id);
        self.sessions.insert(session.id.clone(), session.clone());
        session
    }

    /// Create a session with a specific ID
    ///
    /// # Arguments
    ///
    /// * `id` - The session ID to use
    /// * `max_tokens` - Optional maximum tokens for this session
    pub fn create_session_with_id(&mut self, id: String, max_tokens: Option<usize>) -> Result<Session> {
        if self.sessions.contains_key(&id) {
            return Err(ConversationError::InvalidMessage(
                format!("Session {} already exists", id)
            ));
        }

        let session = Session::with_id(id.clone(), max_tokens.unwrap_or(self.config.default_max_tokens));
        info!("Created new session with ID: {}", session.id);
        self.sessions.insert(id, session.clone());
        Ok(session)
    }

    /// Get an existing session
    ///
    /// # Arguments
    ///
    /// * `id` - The session ID
    pub fn get_session(&mut self, id: &str) -> Option<&Session> {
        if let Some(session) = self.sessions.get_mut(id) {
            // Check if session should be marked as idle or expired
            let idle_duration = Duration::seconds(self.config.idle_timeout_seconds);
            let expire_duration = Duration::seconds(self.config.timeout_seconds);

            if session.is_expired(expire_duration) {
                session.state = SessionState::Expired;
                debug!("Session {} marked as expired", id);
            } else if session.is_expired(idle_duration) && session.state == SessionState::Active {
                session.state = SessionState::Idle;
                debug!("Session {} marked as idle", id);
            }
        }

        self.sessions.get(id)
    }

    /// Get a mutable reference to a session
    pub fn get_session_mut(&mut self, id: &str) -> Option<&mut Session> {
        self.sessions.get_mut(id)
    }

    /// Update session state after message processing
    ///
    /// # Arguments
    ///
    /// * `id` - The session ID
    /// * `tokens_used` - Number of tokens used in this interaction
    pub async fn update_session(&mut self, id: &str, tokens_used: usize) -> Result<()> {
        let session = self.sessions
            .get_mut(id)
            .ok_or_else(|| ConversationError::SessionNotFound(id.to_string()))?;

        session.touch();
        session.add_tokens(tokens_used)?;

        debug!(
            "Updated session {}: {} tokens used, {} total, {} remaining",
            id,
            tokens_used,
            session.total_tokens,
            session.remaining_tokens()
        );

        Ok(())
    }

    /// Delete a session
    ///
    /// # Arguments
    ///
    /// * `id` - The session ID to delete
    pub fn delete_session(&mut self, id: &str) -> Option<Session> {
        info!("Deleting session: {}", id);
        self.sessions.remove(id)
    }

    /// Clean up expired sessions
    ///
    /// Returns the number of sessions removed
    pub fn cleanup_expired(&mut self) -> usize {
        let expire_duration = Duration::seconds(self.config.timeout_seconds);
        let before_count = self.sessions.len();

        self.sessions.retain(|id, session| {
            let expired = session.is_expired(expire_duration);
            if expired {
                info!("Removing expired session: {}", id);
            }
            !expired
        });

        let removed = before_count - self.sessions.len();
        if removed > 0 {
            info!("Cleaned up {} expired sessions", removed);
        }
        removed
    }

    /// Get all active sessions
    pub fn active_sessions(&self) -> Vec<&Session> {
        self.sessions
            .values()
            .filter(|s| s.state == SessionState::Active)
            .collect()
    }

    /// Get total number of sessions
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }

    /// Get session statistics
    pub fn statistics(&self) -> SessionStatistics {
        let mut stats = SessionStatistics::default();

        for session in self.sessions.values() {
            stats.total_sessions += 1;
            stats.total_tokens += session.total_tokens;

            match session.state {
                SessionState::Active => stats.active_sessions += 1,
                SessionState::Idle => stats.idle_sessions += 1,
                SessionState::Expired => stats.expired_sessions += 1,
            }
        }

        stats
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Session statistics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SessionStatistics {
    pub total_sessions: usize,
    pub active_sessions: usize,
    pub idle_sessions: usize,
    pub expired_sessions: usize,
    pub total_tokens: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_creation() {
        let mut manager = SessionManager::new();
        let session = manager.create_session(Some(1000));

        assert_eq!(session.state, SessionState::Active);
        assert_eq!(session.max_tokens, 1000);
        assert_eq!(session.total_tokens, 0);
    }

    #[test]
    fn test_token_tracking() {
        let mut session = Session::new(100);

        assert!(session.add_tokens(50).is_ok());
        assert_eq!(session.total_tokens, 50);
        assert_eq!(session.remaining_tokens(), 50);

        assert!(session.add_tokens(30).is_ok());
        assert_eq!(session.total_tokens, 80);

        // Should fail - exceeds limit
        assert!(session.add_tokens(30).is_err());
    }

    #[tokio::test]
    async fn test_session_update() {
        let mut manager = SessionManager::new();
        let session = manager.create_session(Some(1000));
        let id = session.id.clone();

        assert!(manager.update_session(&id, 100).await.is_ok());

        let updated = manager.get_session(&id).unwrap();
        assert_eq!(updated.total_tokens, 100);
    }

    #[test]
    fn test_cleanup_expired() {
        let mut config = SessionConfig::default();
        config.timeout_seconds = 0; // Expire immediately

        let mut manager = SessionManager::with_config(config);
        manager.create_session(None);

        std::thread::sleep(std::time::Duration::from_millis(100));

        let removed = manager.cleanup_expired();
        assert_eq!(removed, 1);
        assert_eq!(manager.session_count(), 0);
    }
}
