//! Entity extraction module.
//!
//! This module provides entity extraction capabilities to identify and extract
//! structured information from natural language queries.

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tracing::{debug, trace};

/// Types of entities that can be extracted from queries.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EntityType {
    /// Time range (e.g., "last 5 minutes", "past hour")
    TimeRange,
    /// Service name
    Service,
    /// Metric name (e.g., "cpu", "memory", "latency")
    Metric,
    /// Severity level (e.g., "critical", "high", "medium", "low")
    Severity,
    /// Environment (e.g., "production", "staging")
    Environment,
    /// Namespace or cluster
    Namespace,
    /// HTTP status code
    HttpStatus,
    /// Endpoint or URL path
    Endpoint,
    /// Host or instance name
    Host,
    /// Threshold value (e.g., "> 90%", "< 100ms")
    Threshold,
    /// Aggregation function (e.g., "avg", "sum", "max")
    Aggregation,
}

impl EntityType {
    /// Returns a human-readable description of the entity type.
    pub fn description(&self) -> &'static str {
        match self {
            Self::TimeRange => "Time range specification",
            Self::Service => "Service or application name",
            Self::Metric => "Metric or measurement name",
            Self::Severity => "Log severity or alert level",
            Self::Environment => "Deployment environment",
            Self::Namespace => "Namespace or cluster identifier",
            Self::HttpStatus => "HTTP status code",
            Self::Endpoint => "API endpoint or URL path",
            Self::Host => "Host or instance identifier",
            Self::Threshold => "Threshold or limit value",
            Self::Aggregation => "Aggregation function",
        }
    }
}

/// Represents an extracted entity with type, value, and position.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    /// Type of the entity
    pub entity_type: EntityType,
    /// Extracted value
    pub value: String,
    /// Normalized/canonical value (e.g., "5m" for "last 5 minutes")
    pub normalized_value: String,
    /// Original text that was matched
    pub original_text: String,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f64,
}

impl Entity {
    /// Creates a new Entity.
    pub fn new(
        entity_type: EntityType,
        value: String,
        normalized_value: String,
        original_text: String,
        confidence: f64,
    ) -> Self {
        Self {
            entity_type,
            value,
            normalized_value,
            original_text,
            confidence,
        }
    }

    /// Returns true if the confidence is above the threshold (0.7).
    pub fn is_confident(&self) -> bool {
        self.confidence >= 0.7
    }
}

lazy_static! {
    /// Time range patterns
    static ref TIME_PATTERNS: Vec<(Regex, fn(&str) -> Option<String>)> = vec![
        (
            Regex::new(r"(?i)last\s+(\d+)\s+(second|sec|s)s?").unwrap(),
            |caps: &str| {
                let re = Regex::new(r"(?i)last\s+(\d+)\s+(second|sec|s)s?").unwrap();
                re.captures(caps).and_then(|c| c.get(1))
                    .map(|m| format!("{}s", m.as_str()))
            }
        ),
        (
            Regex::new(r"(?i)last\s+(\d+)\s+(minute|min|m)s?").unwrap(),
            |caps: &str| {
                let re = Regex::new(r"(?i)last\s+(\d+)\s+(minute|min|m)s?").unwrap();
                re.captures(caps).and_then(|c| c.get(1))
                    .map(|m| format!("{}m", m.as_str()))
            }
        ),
        (
            Regex::new(r"(?i)last\s+(\d+)\s+(hour|hr|h)s?").unwrap(),
            |caps: &str| {
                let re = Regex::new(r"(?i)last\s+(\d+)\s+(hour|hr|h)s?").unwrap();
                re.captures(caps).and_then(|c| c.get(1))
                    .map(|m| format!("{}h", m.as_str()))
            }
        ),
        (
            Regex::new(r"(?i)last\s+(\d+)\s+(day|d)s?").unwrap(),
            |caps: &str| {
                let re = Regex::new(r"(?i)last\s+(\d+)\s+(day|d)s?").unwrap();
                re.captures(caps).and_then(|c| c.get(1))
                    .map(|m| format!("{}d", m.as_str()))
            }
        ),
        (
            Regex::new(r"(?i)past\s+(hour|minute|day|week)").unwrap(),
            |caps: &str| {
                if caps.to_lowercase().contains("hour") {
                    Some("1h".to_string())
                } else if caps.to_lowercase().contains("minute") {
                    Some("1m".to_string())
                } else if caps.to_lowercase().contains("day") {
                    Some("1d".to_string())
                } else if caps.to_lowercase().contains("week") {
                    Some("7d".to_string())
                } else {
                    None
                }
            }
        ),
    ];

    /// Metric name patterns
    static ref METRIC_PATTERNS: Vec<(Regex, &'static str)> = vec![
        (Regex::new(r"(?i)\bcpu\b").unwrap(), "cpu"),
        (Regex::new(r"(?i)\bmemory\b").unwrap(), "memory"),
        (Regex::new(r"(?i)\bdisk\b").unwrap(), "disk"),
        (Regex::new(r"(?i)\bnetwork\b").unwrap(), "network"),
        (Regex::new(r"(?i)\blatency\b").unwrap(), "latency"),
        (Regex::new(r"(?i)\bresponse\s+time\b").unwrap(), "response_time"),
        (Regex::new(r"(?i)\bthroughput\b").unwrap(), "throughput"),
        (Regex::new(r"(?i)\berror\s+rate\b").unwrap(), "error_rate"),
        (Regex::new(r"(?i)\brequest\s+rate\b").unwrap(), "request_rate"),
        (Regex::new(r"(?i)\bqps\b").unwrap(), "qps"),
        (Regex::new(r"(?i)\brps\b").unwrap(), "rps"),
        (Regex::new(r"(?i)\bbandwidth\b").unwrap(), "bandwidth"),
    ];

    /// Severity patterns
    static ref SEVERITY_PATTERNS: Vec<(Regex, &'static str)> = vec![
        (Regex::new(r"(?i)\bcritical\b").unwrap(), "critical"),
        (Regex::new(r"(?i)\bhigh\b").unwrap(), "high"),
        (Regex::new(r"(?i)\bmedium\b").unwrap(), "medium"),
        (Regex::new(r"(?i)\blow\b").unwrap(), "low"),
        (Regex::new(r"(?i)\berror\b").unwrap(), "error"),
        (Regex::new(r"(?i)\bwarning\b").unwrap(), "warning"),
        (Regex::new(r"(?i)\binfo\b").unwrap(), "info"),
        (Regex::new(r"(?i)\bdebug\b").unwrap(), "debug"),
    ];

    /// Service name patterns (common patterns)
    static ref SERVICE_PATTERN: Regex = Regex::new(r"(?i)\b([a-z0-9]+[-_](?:service|svc|api|app|server))\b").unwrap();

    /// HTTP status patterns
    static ref HTTP_STATUS_PATTERN: Regex = Regex::new(r"\b([2-5][0-9]{2})\b").unwrap();

    /// Endpoint patterns
    static ref ENDPOINT_PATTERN: Regex = Regex::new(r"/[a-zA-Z0-9/_\-\.]+").unwrap();

    /// Threshold patterns
    static ref THRESHOLD_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"(?i)>\s*(\d+\.?\d*)\s*(%|percent|ms|gb|mb)?").unwrap(),
        Regex::new(r"(?i)<\s*(\d+\.?\d*)\s*(%|percent|ms|gb|mb)?").unwrap(),
        Regex::new(r"(?i)above\s+(\d+\.?\d*)\s*(%|percent|ms|gb|mb)?").unwrap(),
        Regex::new(r"(?i)below\s+(\d+\.?\d*)\s*(%|percent|ms|gb|mb)?").unwrap(),
    ];

    /// Aggregation function patterns
    static ref AGGREGATION_PATTERNS: Vec<(Regex, &'static str)> = vec![
        (Regex::new(r"(?i)\b(average|avg)\b").unwrap(), "avg"),
        (Regex::new(r"(?i)\b(sum|total)\b").unwrap(), "sum"),
        (Regex::new(r"(?i)\b(max|maximum)\b").unwrap(), "max"),
        (Regex::new(r"(?i)\b(min|minimum)\b").unwrap(), "min"),
        (Regex::new(r"(?i)\b(count)\b").unwrap(), "count"),
        (Regex::new(r"(?i)\b(rate)\b").unwrap(), "rate"),
        (Regex::new(r"(?i)\b(percentile|p95|p99)\b").unwrap(), "percentile"),
    ];

    /// Environment patterns
    static ref ENVIRONMENT_PATTERNS: Vec<(Regex, &'static str)> = vec![
        (Regex::new(r"(?i)\b(production|prod)\b").unwrap(), "production"),
        (Regex::new(r"(?i)\b(staging|stage)\b").unwrap(), "staging"),
        (Regex::new(r"(?i)\b(development|dev)\b").unwrap(), "development"),
        (Regex::new(r"(?i)\b(test|testing)\b").unwrap(), "test"),
    ];
}

/// Entity extractor that identifies and extracts entities from text.
pub struct EntityExtractor {
    /// Custom service names known to the system
    known_services: Vec<String>,
    /// Custom metric names
    known_metrics: Vec<String>,
}

impl EntityExtractor {
    /// Creates a new EntityExtractor.
    pub fn new() -> Self {
        Self {
            known_services: Vec::new(),
            known_metrics: Vec::new(),
        }
    }

    /// Creates a new EntityExtractor with known services and metrics.
    pub fn with_context(known_services: Vec<String>, known_metrics: Vec<String>) -> Self {
        Self {
            known_services,
            known_metrics,
        }
    }

    /// Extracts all entities from a query.
    ///
    /// # Arguments
    ///
    /// * `query` - The natural language query
    ///
    /// # Returns
    ///
    /// A vector of extracted entities
    pub fn extract(&self, query: &str) -> Vec<Entity> {
        trace!("Extracting entities from query: {}", query);

        let mut entities = Vec::new();

        // Extract time ranges
        entities.extend(self.extract_time_ranges(query));

        // Extract metrics
        entities.extend(self.extract_metrics(query));

        // Extract severity levels
        entities.extend(self.extract_severity(query));

        // Extract services
        entities.extend(self.extract_services(query));

        // Extract HTTP status codes
        entities.extend(self.extract_http_status(query));

        // Extract endpoints
        entities.extend(self.extract_endpoints(query));

        // Extract thresholds
        entities.extend(self.extract_thresholds(query));

        // Extract aggregations
        entities.extend(self.extract_aggregations(query));

        // Extract environments
        entities.extend(self.extract_environments(query));

        debug!("Extracted {} entities", entities.len());
        entities
    }

    /// Extracts time range entities.
    fn extract_time_ranges(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for (pattern, normalizer) in TIME_PATTERNS.iter() {
            if let Some(mat) = pattern.find(query) {
                if let Some(normalized) = normalizer(mat.as_str()) {
                    entities.push(Entity::new(
                        EntityType::TimeRange,
                        mat.as_str().to_string(),
                        normalized,
                        mat.as_str().to_string(),
                        0.95,
                    ));
                }
            }
        }

        entities
    }

    /// Extracts metric entities.
    fn extract_metrics(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        // Check known metrics first
        for metric in &self.known_metrics {
            if query.to_lowercase().contains(&metric.to_lowercase()) {
                entities.push(Entity::new(
                    EntityType::Metric,
                    metric.clone(),
                    metric.clone(),
                    metric.clone(),
                    0.9,
                ));
            }
        }

        // Check pattern-based metrics
        for (pattern, normalized) in METRIC_PATTERNS.iter() {
            if let Some(mat) = pattern.find(query) {
                entities.push(Entity::new(
                    EntityType::Metric,
                    mat.as_str().to_string(),
                    normalized.to_string(),
                    mat.as_str().to_string(),
                    0.85,
                ));
            }
        }

        entities
    }

    /// Extracts severity entities.
    fn extract_severity(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for (pattern, normalized) in SEVERITY_PATTERNS.iter() {
            if let Some(mat) = pattern.find(query) {
                entities.push(Entity::new(
                    EntityType::Severity,
                    mat.as_str().to_string(),
                    normalized.to_string(),
                    mat.as_str().to_string(),
                    0.9,
                ));
            }
        }

        entities
    }

    /// Extracts service entities.
    fn extract_services(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        // Check known services first
        for service in &self.known_services {
            if query.to_lowercase().contains(&service.to_lowercase()) {
                entities.push(Entity::new(
                    EntityType::Service,
                    service.clone(),
                    service.clone(),
                    service.clone(),
                    0.95,
                ));
            }
        }

        // Check pattern-based services
        for mat in SERVICE_PATTERN.find_iter(query) {
            entities.push(Entity::new(
                EntityType::Service,
                mat.as_str().to_string(),
                mat.as_str().to_lowercase(),
                mat.as_str().to_string(),
                0.8,
            ));
        }

        entities
    }

    /// Extracts HTTP status code entities.
    fn extract_http_status(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for mat in HTTP_STATUS_PATTERN.find_iter(query) {
            entities.push(Entity::new(
                EntityType::HttpStatus,
                mat.as_str().to_string(),
                mat.as_str().to_string(),
                mat.as_str().to_string(),
                0.9,
            ));
        }

        entities
    }

    /// Extracts endpoint entities.
    fn extract_endpoints(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for mat in ENDPOINT_PATTERN.find_iter(query) {
            entities.push(Entity::new(
                EntityType::Endpoint,
                mat.as_str().to_string(),
                mat.as_str().to_string(),
                mat.as_str().to_string(),
                0.85,
            ));
        }

        entities
    }

    /// Extracts threshold entities.
    fn extract_thresholds(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for pattern in THRESHOLD_PATTERNS.iter() {
            if let Some(mat) = pattern.find(query) {
                entities.push(Entity::new(
                    EntityType::Threshold,
                    mat.as_str().to_string(),
                    mat.as_str().trim().to_string(),
                    mat.as_str().to_string(),
                    0.85,
                ));
            }
        }

        entities
    }

    /// Extracts aggregation function entities.
    fn extract_aggregations(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for (pattern, normalized) in AGGREGATION_PATTERNS.iter() {
            if let Some(mat) = pattern.find(query) {
                entities.push(Entity::new(
                    EntityType::Aggregation,
                    mat.as_str().to_string(),
                    normalized.to_string(),
                    mat.as_str().to_string(),
                    0.9,
                ));
            }
        }

        entities
    }

    /// Extracts environment entities.
    fn extract_environments(&self, query: &str) -> Vec<Entity> {
        let mut entities = Vec::new();

        for (pattern, normalized) in ENVIRONMENT_PATTERNS.iter() {
            if let Some(mat) = pattern.find(query) {
                entities.push(Entity::new(
                    EntityType::Environment,
                    mat.as_str().to_string(),
                    normalized.to_string(),
                    mat.as_str().to_string(),
                    0.9,
                ));
            }
        }

        entities
    }
}

impl Default for EntityExtractor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_time_range() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show errors in the last 5 minutes");
        let time_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::TimeRange)
            .collect();
        assert!(!time_entities.is_empty());
        assert_eq!(time_entities[0].normalized_value, "5m");
    }

    #[test]
    fn test_extract_metric() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show CPU usage");
        let metric_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Metric)
            .collect();
        assert!(!metric_entities.is_empty());
        assert_eq!(metric_entities[0].normalized_value, "cpu");
    }

    #[test]
    fn test_extract_severity() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show critical errors");
        let severity_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Severity)
            .collect();
        assert!(!severity_entities.is_empty());
    }

    #[test]
    fn test_extract_service() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show errors from auth-service");
        let service_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Service)
            .collect();
        assert!(!service_entities.is_empty());
    }

    #[test]
    fn test_extract_http_status() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show 500 errors");
        let status_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::HttpStatus)
            .collect();
        assert!(!status_entities.is_empty());
        assert_eq!(status_entities[0].value, "500");
    }

    #[test]
    fn test_extract_endpoint() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show errors for /api/users");
        let endpoint_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Endpoint)
            .collect();
        assert!(!endpoint_entities.is_empty());
        assert_eq!(endpoint_entities[0].value, "/api/users");
    }

    #[test]
    fn test_extract_aggregation() {
        let extractor = EntityExtractor::new();
        let entities = extractor.extract("Show average response time");
        let agg_entities: Vec<_> = entities
            .iter()
            .filter(|e| e.entity_type == EntityType::Aggregation)
            .collect();
        assert!(!agg_entities.is_empty());
        assert_eq!(agg_entities[0].normalized_value, "avg");
    }

    #[test]
    fn test_extract_with_context() {
        let extractor = EntityExtractor::with_context(
            vec!["payment-service".to_string()],
            vec!["checkout_duration".to_string()],
        );
        let entities = extractor.extract("Show checkout_duration for payment-service");
        assert!(entities.iter().any(|e| e.entity_type == EntityType::Service));
        assert!(entities.iter().any(|e| e.entity_type == EntityType::Metric));
    }
}
