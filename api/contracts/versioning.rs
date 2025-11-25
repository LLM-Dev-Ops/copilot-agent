// API Versioning and Migration Strategy
// Support multiple API versions with graceful deprecation

use serde::{Deserialize, Serialize};
use std::fmt;
use chrono::{DateTime, Utc};

// ==================== API VERSION ====================

/// Supported API versions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ApiVersion {
    #[serde(rename = "v1")]
    V1,

    #[serde(rename = "v2")]
    V2,
}

impl ApiVersion {
    /// Parse version from string (e.g., "v1", "1", "1.0")
    pub fn parse(s: &str) -> Result<Self, VersionError> {
        match s.to_lowercase().as_str() {
            "v1" | "1" | "1.0" => Ok(ApiVersion::V1),
            "v2" | "2" | "2.0" => Ok(ApiVersion::V2),
            _ => Err(VersionError::UnsupportedVersion(s.to_string())),
        }
    }

    /// Get version string
    pub fn as_str(&self) -> &'static str {
        match self {
            ApiVersion::V1 => "v1",
            ApiVersion::V2 => "v2",
        }
    }

    /// Get full version string
    pub fn full_version(&self) -> &'static str {
        match self {
            ApiVersion::V1 => "1.0.0",
            ApiVersion::V2 => "2.0.0",
        }
    }

    /// Check if version is deprecated
    pub fn is_deprecated(&self) -> bool {
        match self {
            ApiVersion::V1 => false,
            ApiVersion::V2 => false,
        }
    }

    /// Get deprecation date if applicable
    pub fn deprecation_date(&self) -> Option<DateTime<Utc>> {
        match self {
            ApiVersion::V1 => None,
            ApiVersion::V2 => None,
        }
    }

    /// Get sunset date (when version will be removed)
    pub fn sunset_date(&self) -> Option<DateTime<Utc>> {
        match self {
            ApiVersion::V1 => None,
            ApiVersion::V2 => None,
        }
    }

    /// Get latest stable version
    pub fn latest() -> Self {
        ApiVersion::V1
    }

    /// Get all supported versions
    pub fn all_supported() -> Vec<Self> {
        vec![ApiVersion::V1]
    }
}

impl fmt::Display for ApiVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Default for ApiVersion {
    fn default() -> Self {
        Self::latest()
    }
}

// ==================== VERSION NEGOTIATION ====================

/// Version negotiation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionNegotiation {
    pub requested_version: Option<String>,
    pub supported_versions: Vec<String>,
}

impl VersionNegotiation {
    pub fn new(requested: Option<String>) -> Self {
        Self {
            requested_version: requested,
            supported_versions: ApiVersion::all_supported()
                .iter()
                .map(|v| v.as_str().to_string())
                .collect(),
        }
    }

    pub fn resolve(&self) -> Result<ApiVersion, VersionError> {
        if let Some(requested) = &self.requested_version {
            let version = ApiVersion::parse(requested)?;

            if !ApiVersion::all_supported().contains(&version) {
                return Err(VersionError::UnsupportedVersion(requested.clone()));
            }

            if version.is_deprecated() {
                // Allow deprecated versions but log warning
                log::warn!("Client using deprecated API version: {}", version);
            }

            Ok(version)
        } else {
            // No version specified, use latest
            Ok(ApiVersion::latest())
        }
    }
}

// ==================== VERSION HEADERS ====================

/// HTTP headers for version negotiation
pub mod headers {
    pub const API_VERSION: &str = "X-API-Version";
    pub const DEPRECATED: &str = "X-API-Deprecated";
    pub const DEPRECATION_DATE: &str = "X-API-Deprecation-Date";
    pub const SUNSET_DATE: &str = "X-API-Sunset-Date";
    pub const SUPPORTED_VERSIONS: &str = "X-API-Supported-Versions";
    pub const MIGRATION_GUIDE: &str = "X-API-Migration-Guide";
}

/// Version headers to include in responses
#[derive(Debug, Clone)]
pub struct VersionHeaders {
    pub version: ApiVersion,
    pub deprecated: bool,
    pub deprecation_date: Option<DateTime<Utc>>,
    pub sunset_date: Option<DateTime<Utc>>,
    pub migration_guide_url: Option<String>,
}

impl VersionHeaders {
    pub fn new(version: ApiVersion) -> Self {
        Self {
            version,
            deprecated: version.is_deprecated(),
            deprecation_date: version.deprecation_date(),
            sunset_date: version.sunset_date(),
            migration_guide_url: Self::migration_guide_url(version),
        }
    }

    fn migration_guide_url(version: ApiVersion) -> Option<String> {
        if version.is_deprecated() {
            Some(format!(
                "https://docs.llm-copilot-agent.dev/migration/{}-to-{}",
                version.as_str(),
                ApiVersion::latest().as_str()
            ))
        } else {
            None
        }
    }

    pub fn to_http_headers(&self) -> Vec<(String, String)> {
        let mut headers = vec![
            (headers::API_VERSION.to_string(), self.version.full_version().to_string()),
            (headers::SUPPORTED_VERSIONS.to_string(),
             ApiVersion::all_supported()
                .iter()
                .map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(", ")
            ),
        ];

        if self.deprecated {
            headers.push((headers::DEPRECATED.to_string(), "true".to_string()));
        }

        if let Some(date) = self.deprecation_date {
            headers.push((headers::DEPRECATION_DATE.to_string(), date.to_rfc3339()));
        }

        if let Some(date) = self.sunset_date {
            headers.push((headers::SUNSET_DATE.to_string(), date.to_rfc3339()));
        }

        if let Some(url) = &self.migration_guide_url {
            headers.push((headers::MIGRATION_GUIDE.to_string(), url.clone()));
        }

        headers
    }
}

// ==================== BREAKING CHANGE POLICY ====================

/// Breaking change types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakingChangeType {
    /// Removing an endpoint
    EndpointRemoval,

    /// Removing a field from response
    ResponseFieldRemoval,

    /// Changing field type
    FieldTypeChange,

    /// Adding required field to request
    RequiredFieldAddition,

    /// Changing validation rules (stricter)
    ValidationChange,

    /// Changing error codes
    ErrorCodeChange,

    /// Changing authentication/authorization
    AuthChange,
}

/// Breaking change policy
pub struct BreakingChangePolicy {
    /// Minimum deprecation period (days)
    pub min_deprecation_period: u32,

    /// Minimum sunset period after deprecation (days)
    pub min_sunset_period: u32,

    /// Require migration guide
    pub require_migration_guide: bool,

    /// Require version bump
    pub require_version_bump: bool,
}

impl Default for BreakingChangePolicy {
    fn default() -> Self {
        Self {
            min_deprecation_period: 90,  // 3 months deprecation notice
            min_sunset_period: 180,       // 6 months until removal
            require_migration_guide: true,
            require_version_bump: true,
        }
    }
}

// ==================== VERSION MIGRATION ====================

/// Migration guide entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationGuide {
    pub from_version: String,
    pub to_version: String,
    pub breaking_changes: Vec<BreakingChange>,
    pub new_features: Vec<String>,
    pub deprecations: Vec<Deprecation>,
    pub migration_steps: Vec<MigrationStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakingChange {
    pub change_type: String,
    pub description: String,
    pub endpoint: Option<String>,
    pub field: Option<String>,
    pub old_behavior: String,
    pub new_behavior: String,
    pub migration_example: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deprecation {
    pub feature: String,
    pub deprecated_in: String,
    pub removed_in: String,
    pub replacement: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStep {
    pub step: u32,
    pub title: String,
    pub description: String,
    pub code_example: Option<String>,
    pub estimated_effort: String,
}

// ==================== BACKWARD COMPATIBILITY ====================

/// Backward compatibility layer
pub trait BackwardCompatible {
    /// Convert from newer version to older version
    fn downgrade(&self, target_version: ApiVersion) -> Result<Self, VersionError>
    where
        Self: Sized;

    /// Convert from older version to newer version
    fn upgrade(&self, target_version: ApiVersion) -> Result<Self, VersionError>
    where
        Self: Sized;
}

// ==================== ERROR TYPES ====================

#[derive(Debug, Clone, thiserror::Error)]
pub enum VersionError {
    #[error("Unsupported API version: {0}")]
    UnsupportedVersion(String),

    #[error("API version {0} is deprecated")]
    DeprecatedVersion(String),

    #[error("API version {0} has been sunset")]
    SunsetVersion(String),

    #[error("Cannot convert between versions: {0}")]
    ConversionError(String),

    #[error("Missing required version header")]
    MissingVersionHeader,

    #[error("Invalid version format: {0}")]
    InvalidFormat(String),
}

// ==================== CHANGELOG ====================

/// Structured changelog entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangelogEntry {
    pub version: String,
    pub release_date: DateTime<Utc>,
    pub changes: ChangelogChanges,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangelogChanges {
    pub breaking: Vec<String>,
    pub added: Vec<String>,
    pub changed: Vec<String>,
    pub deprecated: Vec<String>,
    pub removed: Vec<String>,
    pub fixed: Vec<String>,
    pub security: Vec<String>,
}

impl ChangelogEntry {
    pub fn new(version: impl Into<String>) -> Self {
        Self {
            version: version.into(),
            release_date: Utc::now(),
            changes: ChangelogChanges {
                breaking: Vec::new(),
                added: Vec::new(),
                changed: Vec::new(),
                deprecated: Vec::new(),
                removed: Vec::new(),
                fixed: Vec::new(),
                security: Vec::new(),
            },
        }
    }

    pub fn to_markdown(&self) -> String {
        let mut md = format!("## [{}] - {}\n\n", self.version, self.release_date.format("%Y-%m-%d"));

        if !self.changes.breaking.is_empty() {
            md.push_str("### BREAKING CHANGES\n");
            for item in &self.changes.breaking {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        if !self.changes.added.is_empty() {
            md.push_str("### Added\n");
            for item in &self.changes.added {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        if !self.changes.changed.is_empty() {
            md.push_str("### Changed\n");
            for item in &self.changes.changed {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        if !self.changes.deprecated.is_empty() {
            md.push_str("### Deprecated\n");
            for item in &self.changes.deprecated {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        if !self.changes.removed.is_empty() {
            md.push_str("### Removed\n");
            for item in &self.changes.removed {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        if !self.changes.fixed.is_empty() {
            md.push_str("### Fixed\n");
            for item in &self.changes.fixed {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        if !self.changes.security.is_empty() {
            md.push_str("### Security\n");
            for item in &self.changes.security {
                md.push_str(&format!("- {}\n", item));
            }
            md.push('\n');
        }

        md
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_parsing() {
        assert_eq!(ApiVersion::parse("v1").unwrap(), ApiVersion::V1);
        assert_eq!(ApiVersion::parse("1").unwrap(), ApiVersion::V1);
        assert_eq!(ApiVersion::parse("1.0").unwrap(), ApiVersion::V1);
        assert!(ApiVersion::parse("v99").is_err());
    }

    #[test]
    fn test_version_negotiation() {
        let negotiation = VersionNegotiation::new(Some("v1".to_string()));
        assert_eq!(negotiation.resolve().unwrap(), ApiVersion::V1);

        let negotiation = VersionNegotiation::new(None);
        assert_eq!(negotiation.resolve().unwrap(), ApiVersion::latest());
    }

    #[test]
    fn test_version_headers() {
        let headers = VersionHeaders::new(ApiVersion::V1);
        let http_headers = headers.to_http_headers();

        assert!(http_headers.iter().any(|(k, _)| k == headers::API_VERSION));
        assert!(http_headers.iter().any(|(k, _)| k == headers::SUPPORTED_VERSIONS));
    }

    #[test]
    fn test_changelog_markdown() {
        let mut entry = ChangelogEntry::new("1.0.0");
        entry.changes.added.push("New feature X".to_string());
        entry.changes.fixed.push("Bug fix Y".to_string());

        let md = entry.to_markdown();
        assert!(md.contains("## [1.0.0]"));
        assert!(md.contains("### Added"));
        assert!(md.contains("New feature X"));
        assert!(md.contains("### Fixed"));
        assert!(md.contains("Bug fix Y"));
    }
}
