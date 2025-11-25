//! Query translation module.
//!
//! This module provides translation from natural language queries and extracted
//! entities into structured query languages like PromQL, LogQL, and SQL.

use crate::entity::{Entity, EntityType};
use crate::intent::{Intent, IntentType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, trace};

/// Supported query languages for translation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum QueryLanguage {
    /// Prometheus Query Language
    PromQL,
    /// Loki Query Language
    LogQL,
    /// Structured Query Language
    SQL,
    /// TraceQL (for distributed tracing)
    TraceQL,
}

impl QueryLanguage {
    /// Returns a human-readable description of the query language.
    pub fn description(&self) -> &'static str {
        match self {
            Self::PromQL => "Prometheus Query Language for metrics",
            Self::LogQL => "Loki Query Language for logs",
            Self::SQL => "Structured Query Language for databases",
            Self::TraceQL => "Trace Query Language for distributed traces",
        }
    }
}

/// Query translator that converts natural language to structured queries.
pub struct QueryTranslator {
    /// Default time range if none specified
    default_time_range: String,
    /// Custom metric mappings
    metric_mappings: HashMap<String, String>,
    /// Custom label mappings
    label_mappings: HashMap<String, String>,
}

impl QueryTranslator {
    /// Creates a new QueryTranslator with default settings.
    pub fn new() -> Self {
        Self {
            default_time_range: "5m".to_string(),
            metric_mappings: Self::default_metric_mappings(),
            label_mappings: HashMap::new(),
        }
    }

    /// Creates a new QueryTranslator with custom mappings.
    pub fn with_mappings(
        metric_mappings: HashMap<String, String>,
        label_mappings: HashMap<String, String>,
    ) -> Self {
        Self {
            default_time_range: "5m".to_string(),
            metric_mappings,
            label_mappings,
        }
    }

    /// Returns default metric name mappings.
    fn default_metric_mappings() -> HashMap<String, String> {
        let mut mappings = HashMap::new();
        mappings.insert("cpu".to_string(), "node_cpu_seconds_total".to_string());
        mappings.insert(
            "memory".to_string(),
            "node_memory_MemAvailable_bytes".to_string(),
        );
        mappings.insert("disk".to_string(), "node_disk_io_time_seconds_total".to_string());
        mappings.insert(
            "network".to_string(),
            "node_network_receive_bytes_total".to_string(),
        );
        mappings.insert(
            "latency".to_string(),
            "http_request_duration_seconds".to_string(),
        );
        mappings.insert(
            "response_time".to_string(),
            "http_request_duration_seconds".to_string(),
        );
        mappings.insert(
            "error_rate".to_string(),
            "http_requests_total".to_string(),
        );
        mappings.insert(
            "request_rate".to_string(),
            "http_requests_total".to_string(),
        );
        mappings.insert("qps".to_string(), "http_requests_total".to_string());
        mappings.insert("rps".to_string(), "http_requests_total".to_string());
        mappings
    }

    /// Translates a query to PromQL.
    ///
    /// # Arguments
    ///
    /// * `intent` - The classified intent
    /// * `entities` - Extracted entities
    ///
    /// # Returns
    ///
    /// A PromQL query string
    pub fn to_promql(&self, intent: &Intent, entities: &[Entity]) -> String {
        trace!("Translating to PromQL: intent={:?}", intent.intent_type);

        let time_range = self.get_entity_value(entities, EntityType::TimeRange)
            .unwrap_or(&self.default_time_range);

        let metric = self.get_entity_value(entities, EntityType::Metric);
        let service = self.get_entity_value(entities, EntityType::Service);
        let aggregation = self.get_entity_value(entities, EntityType::Aggregation);

        match intent.intent_type {
            IntentType::QueryMetrics | IntentType::PerformanceAnalysis => {
                self.build_promql_metrics_query(metric, service, aggregation, time_range)
            }
            IntentType::ErrorAnalysis => {
                self.build_promql_error_query(service, time_range)
            }
            IntentType::CompareMetrics => {
                self.build_promql_compare_query(metric, time_range)
            }
            IntentType::TrendAnalysis => {
                self.build_promql_trend_query(metric, service, time_range)
            }
            IntentType::ServiceHealth => {
                self.build_promql_health_query(service)
            }
            _ => {
                // Default: simple metric query
                let metric_name = metric
                    .and_then(|m| self.metric_mappings.get(m))
                    .map(|s| s.as_str())
                    .unwrap_or("up");

                format!("{}[{}]", metric_name, time_range)
            }
        }
    }

    /// Translates a query to LogQL.
    ///
    /// # Arguments
    ///
    /// * `intent` - The classified intent
    /// * `entities` - Extracted entities
    ///
    /// # Returns
    ///
    /// A LogQL query string
    pub fn to_logql(&self, intent: &Intent, entities: &[Entity]) -> String {
        trace!("Translating to LogQL: intent={:?}", intent.intent_type);

        let time_range = self.get_entity_value(entities, EntityType::TimeRange)
            .unwrap_or(&self.default_time_range);

        let service = self.get_entity_value(entities, EntityType::Service);
        let severity = self.get_entity_value(entities, EntityType::Severity);
        let endpoint = self.get_entity_value(entities, EntityType::Endpoint);

        match intent.intent_type {
            IntentType::SearchLogs | IntentType::ErrorAnalysis => {
                self.build_logql_search_query(service, severity, endpoint, time_range)
            }
            IntentType::RootCauseAnalysis | IntentType::AlertInvestigation => {
                self.build_logql_analysis_query(service, severity, time_range)
            }
            IntentType::TrendAnalysis => {
                self.build_logql_trend_query(service, severity, time_range)
            }
            _ => {
                // Default: simple log stream
                let mut labels = Vec::new();

                if let Some(svc) = service {
                    labels.push(format!("service=\"{}\"", svc));
                }

                if let Some(sev) = severity {
                    labels.push(format!("level=\"{}\"", sev));
                }

                let label_selector = if labels.is_empty() {
                    String::new()
                } else {
                    labels.join(", ")
                };

                format!("{{{}}}[{}]", label_selector, time_range)
            }
        }
    }

    /// Translates a query to SQL.
    ///
    /// # Arguments
    ///
    /// * `intent` - The classified intent
    /// * `entities` - Extracted entities
    ///
    /// # Returns
    ///
    /// A SQL query string
    pub fn to_sql(&self, intent: &Intent, entities: &[Entity]) -> String {
        trace!("Translating to SQL: intent={:?}", intent.intent_type);

        let service = self.get_entity_value(entities, EntityType::Service);
        let severity = self.get_entity_value(entities, EntityType::Severity);
        let metric = self.get_entity_value(entities, EntityType::Metric);
        let aggregation = self.get_entity_value(entities, EntityType::Aggregation)
            .unwrap_or("avg");

        match intent.intent_type {
            IntentType::QueryMetrics | IntentType::PerformanceAnalysis => {
                self.build_sql_metrics_query(metric, service, aggregation)
            }
            IntentType::SearchLogs | IntentType::ErrorAnalysis => {
                self.build_sql_logs_query(service, severity)
            }
            IntentType::TrendAnalysis => {
                self.build_sql_trend_query(metric, service, aggregation)
            }
            _ => {
                // Default: simple select
                let mut conditions = Vec::new();

                if let Some(svc) = service {
                    conditions.push(format!("service = '{}'", svc));
                }

                let where_clause = if conditions.is_empty() {
                    String::new()
                } else {
                    format!(" WHERE {}", conditions.join(" AND "))
                };

                format!("SELECT * FROM metrics{} ORDER BY timestamp DESC LIMIT 100", where_clause)
            }
        }
    }

    /// Helper function to get entity value by type.
    fn get_entity_value<'a>(&self, entities: &'a [Entity], entity_type: EntityType) -> Option<&'a str> {
        entities
            .iter()
            .find(|e| e.entity_type == entity_type)
            .map(|e| e.normalized_value.as_str())
    }

    // PromQL query builders

    fn build_promql_metrics_query(
        &self,
        metric: Option<&str>,
        service: Option<&str>,
        aggregation: Option<&str>,
        time_range: &str,
    ) -> String {
        let metric_name = metric
            .and_then(|m| self.metric_mappings.get(m))
            .map(|s| s.as_str())
            .unwrap_or("up");

        let mut labels = Vec::new();
        if let Some(svc) = service {
            labels.push(format!("service=\"{}\"", svc));
        }

        let label_selector = if labels.is_empty() {
            String::new()
        } else {
            format!("{{{}}}", labels.join(", "))
        };

        let base_query = format!("{}{}[{}]", metric_name, label_selector, time_range);

        match aggregation {
            Some("avg") => format!("avg(rate({}))", base_query),
            Some("sum") => format!("sum(rate({}))", base_query),
            Some("max") => format!("max({})", base_query),
            Some("min") => format!("min({})", base_query),
            Some("rate") => format!("rate({})", base_query),
            _ => format!("rate({})", base_query),
        }
    }

    fn build_promql_error_query(&self, service: Option<&str>, time_range: &str) -> String {
        let mut labels = vec!["code=~\"5..\"".to_string()];

        if let Some(svc) = service {
            labels.push(format!("service=\"{}\"", svc));
        }

        format!(
            "sum(rate(http_requests_total{{{}}}[{}]))",
            labels.join(", "),
            time_range
        )
    }

    fn build_promql_compare_query(&self, metric: Option<&str>, time_range: &str) -> String {
        let metric_name = metric
            .and_then(|m| self.metric_mappings.get(m))
            .map(|s| s.as_str())
            .unwrap_or("up");

        format!(
            "sum(rate({}[{}])) by (service)",
            metric_name, time_range
        )
    }

    fn build_promql_trend_query(
        &self,
        metric: Option<&str>,
        service: Option<&str>,
        time_range: &str,
    ) -> String {
        let metric_name = metric
            .and_then(|m| self.metric_mappings.get(m))
            .map(|s| s.as_str())
            .unwrap_or("up");

        let mut labels = Vec::new();
        if let Some(svc) = service {
            labels.push(format!("service=\"{}\"", svc));
        }

        let label_selector = if labels.is_empty() {
            String::new()
        } else {
            format!("{{{}}}", labels.join(", "))
        };

        format!(
            "avg_over_time({}{}[{}])",
            metric_name, label_selector, time_range
        )
    }

    fn build_promql_health_query(&self, service: Option<&str>) -> String {
        if let Some(svc) = service {
            format!("up{{service=\"{}\"}}", svc)
        } else {
            "up".to_string()
        }
    }

    // LogQL query builders

    fn build_logql_search_query(
        &self,
        service: Option<&str>,
        severity: Option<&str>,
        endpoint: Option<&str>,
        time_range: &str,
    ) -> String {
        let mut labels = Vec::new();
        let mut filters = Vec::new();

        if let Some(svc) = service {
            labels.push(format!("service=\"{}\"", svc));
        }

        if let Some(sev) = severity {
            labels.push(format!("level=\"{}\"", sev));
        }

        if let Some(ep) = endpoint {
            filters.push(format!("|~ `{}`", ep));
        }

        let label_selector = labels.join(", ");
        let filter_chain = filters.join(" ");

        format!(
            "{{{}}}{}[{}]",
            label_selector, filter_chain, time_range
        )
    }

    fn build_logql_analysis_query(
        &self,
        service: Option<&str>,
        severity: Option<&str>,
        time_range: &str,
    ) -> String {
        let mut labels = Vec::new();

        if let Some(svc) = service {
            labels.push(format!("service=\"{}\"", svc));
        }

        if let Some(sev) = severity {
            labels.push(format!("level=\"{}\"", sev));
        } else {
            labels.push("level=\"error\"".to_string());
        }

        let label_selector = labels.join(", ");

        format!(
            "sum(count_over_time({{{}}}[{}])) by (service)",
            label_selector, time_range
        )
    }

    fn build_logql_trend_query(
        &self,
        service: Option<&str>,
        severity: Option<&str>,
        time_range: &str,
    ) -> String {
        let mut labels = Vec::new();

        if let Some(svc) = service {
            labels.push(format!("service=\"{}\"", svc));
        }

        if let Some(sev) = severity {
            labels.push(format!("level=\"{}\"", sev));
        }

        let label_selector = labels.join(", ");

        format!(
            "rate({{{}}}[{}])",
            label_selector, time_range
        )
    }

    // SQL query builders

    fn build_sql_metrics_query(
        &self,
        metric: Option<&str>,
        service: Option<&str>,
        aggregation: &str,
    ) -> String {
        let metric_col = metric.unwrap_or("value");
        let mut conditions = Vec::new();

        if let Some(svc) = service {
            conditions.push(format!("service = '{}'", svc));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        };

        format!(
            "SELECT timestamp, service, {}({}) as value FROM metrics{} GROUP BY timestamp, service ORDER BY timestamp DESC",
            aggregation.to_uppercase(),
            metric_col,
            where_clause
        )
    }

    fn build_sql_logs_query(&self, service: Option<&str>, severity: Option<&str>) -> String {
        let mut conditions = Vec::new();

        if let Some(svc) = service {
            conditions.push(format!("service = '{}'", svc));
        }

        if let Some(sev) = severity {
            conditions.push(format!("level = '{}'", sev));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        };

        format!(
            "SELECT timestamp, service, level, message FROM logs{} ORDER BY timestamp DESC LIMIT 100",
            where_clause
        )
    }

    fn build_sql_trend_query(
        &self,
        metric: Option<&str>,
        service: Option<&str>,
        aggregation: &str,
    ) -> String {
        let metric_col = metric.unwrap_or("value");
        let mut conditions = Vec::new();

        if let Some(svc) = service {
            conditions.push(format!("service = '{}'", svc));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        };

        format!(
            "SELECT DATE_TRUNC('hour', timestamp) as hour, {}({}) as value FROM metrics{} GROUP BY hour ORDER BY hour DESC",
            aggregation.to_uppercase(),
            metric_col,
            where_clause
        )
    }
}

impl Default for QueryTranslator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::Entity;
    use crate::intent::Intent;

    fn create_test_intent(intent_type: IntentType) -> Intent {
        Intent::new(intent_type, 0.9)
    }

    fn create_test_entity(entity_type: EntityType, value: &str) -> Entity {
        Entity::new(
            entity_type,
            value.to_string(),
            value.to_string(),
            value.to_string(),
            0.9,
        )
    }

    #[test]
    fn test_promql_metrics_query() {
        let translator = QueryTranslator::new();
        let intent = create_test_intent(IntentType::QueryMetrics);
        let entities = vec![
            create_test_entity(EntityType::Metric, "cpu"),
            create_test_entity(EntityType::TimeRange, "5m"),
        ];

        let query = translator.to_promql(&intent, &entities);
        assert!(query.contains("node_cpu_seconds_total"));
        assert!(query.contains("[5m]"));
    }

    #[test]
    fn test_promql_error_query() {
        let translator = QueryTranslator::new();
        let intent = create_test_intent(IntentType::ErrorAnalysis);
        let entities = vec![
            create_test_entity(EntityType::Service, "auth-service"),
            create_test_entity(EntityType::TimeRange, "10m"),
        ];

        let query = translator.to_promql(&intent, &entities);
        assert!(query.contains("http_requests_total"));
        assert!(query.contains("code=~\"5..\""));
        assert!(query.contains("auth-service"));
    }

    #[test]
    fn test_logql_search_query() {
        let translator = QueryTranslator::new();
        let intent = create_test_intent(IntentType::SearchLogs);
        let entities = vec![
            create_test_entity(EntityType::Service, "api-service"),
            create_test_entity(EntityType::Severity, "error"),
            create_test_entity(EntityType::TimeRange, "15m"),
        ];

        let query = translator.to_logql(&intent, &entities);
        assert!(query.contains("service=\"api-service\""));
        assert!(query.contains("level=\"error\""));
        assert!(query.contains("[15m]"));
    }

    #[test]
    fn test_sql_metrics_query() {
        let translator = QueryTranslator::new();
        let intent = create_test_intent(IntentType::QueryMetrics);
        let entities = vec![
            create_test_entity(EntityType::Metric, "latency"),
            create_test_entity(EntityType::Service, "web-service"),
            create_test_entity(EntityType::Aggregation, "avg"),
        ];

        let query = translator.to_sql(&intent, &entities);
        assert!(query.contains("SELECT"));
        assert!(query.contains("AVG"));
        assert!(query.contains("web-service"));
    }

    #[test]
    fn test_query_language_description() {
        assert!(!QueryLanguage::PromQL.description().is_empty());
        assert!(!QueryLanguage::LogQL.description().is_empty());
        assert!(!QueryLanguage::SQL.description().is_empty());
    }
}
