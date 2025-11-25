use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{AdapterResult, HealthStatus, ModuleCapabilities};

#[async_trait]
pub trait ModuleAdapter: Send + Sync {
    async fn health_check(&self) -> AdapterResult<HealthStatus>;
    async fn execute(&self, request: serde_json::Value) -> AdapterResult<serde_json::Value>;
    async fn get_capabilities(&self) -> AdapterResult<ModuleCapabilities>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestGenerationRequest {
    pub source_code: String,
    pub language: String,
    pub test_framework: String,
    pub coverage_target: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestGenerationResponse {
    pub test_code: String,
    pub test_count: usize,
    pub coverage_estimate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestExecutionRequest {
    pub test_code: String,
    pub language: String,
    pub test_framework: String,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestExecutionResponse {
    pub success: bool,
    pub total_tests: usize,
    pub passed_tests: usize,
    pub failed_tests: usize,
    pub skipped_tests: usize,
    pub duration_ms: u64,
    pub failures: Vec<TestFailure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestFailure {
    pub test_name: String,
    pub error_message: String,
    pub stack_trace: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageRequest {
    pub source_code: String,
    pub test_code: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageResponse {
    pub line_coverage: f64,
    pub branch_coverage: f64,
    pub function_coverage: f64,
    pub uncovered_lines: Vec<usize>,
    pub report_url: Option<String>,
}

#[async_trait]
pub trait TestBenchAdapter: Send + Sync {
    async fn generate_tests(&self, request: TestGenerationRequest) -> AdapterResult<TestGenerationResponse>;
    async fn run_tests(&self, request: TestExecutionRequest) -> AdapterResult<TestExecutionResponse>;
    async fn get_coverage(&self, request: CoverageRequest) -> AdapterResult<CoverageResponse>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsQuery {
    pub query: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub step: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsResponse {
    pub status: String,
    pub data: MetricsData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsData {
    pub result_type: String,
    pub result: Vec<MetricResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricResult {
    pub metric: HashMap<String, String>,
    pub values: Vec<(f64, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogsQuery {
    pub query: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogsResponse {
    pub logs: Vec<LogEntry>,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub level: String,
    pub message: String,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TracesQuery {
    pub service_name: Option<String>,
    pub operation_name: Option<String>,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub tags: Option<HashMap<String, String>>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TracesResponse {
    pub traces: Vec<Trace>,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trace {
    pub trace_id: String,
    pub spans: Vec<Span>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Span {
    pub span_id: String,
    pub parent_span_id: Option<String>,
    pub operation_name: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub duration_ms: u64,
    pub tags: HashMap<String, String>,
}

#[async_trait]
pub trait ObservatoryAdapter: Send + Sync {
    async fn query_metrics(&self, query: MetricsQuery) -> AdapterResult<MetricsResponse>;
    async fn query_logs(&self, query: LogsQuery) -> AdapterResult<LogsResponse>;
    async fn query_traces(&self, query: TracesQuery) -> AdapterResult<TracesResponse>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIncidentRequest {
    pub title: String,
    pub description: String,
    pub severity: IncidentSeverity,
    pub affected_services: Vec<String>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IncidentSeverity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: IncidentSeverity,
    pub status: IncidentStatus,
    pub affected_services: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IncidentStatus {
    Open,
    Investigating,
    Identified,
    Monitoring,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateIncidentRequest {
    pub incident_id: String,
    pub status: Option<IncidentStatus>,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunbookExecutionRequest {
    pub incident_id: String,
    pub runbook_id: String,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunbookExecutionResponse {
    pub execution_id: String,
    pub status: RunbookStatus,
    pub steps_completed: usize,
    pub steps_total: usize,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RunbookStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[async_trait]
pub trait IncidentAdapter: Send + Sync {
    async fn create_incident(&self, request: CreateIncidentRequest) -> AdapterResult<Incident>;
    async fn update_incident(&self, request: UpdateIncidentRequest) -> AdapterResult<Incident>;
    async fn execute_runbook(&self, request: RunbookExecutionRequest) -> AdapterResult<RunbookExecutionResponse>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerWorkflowRequest {
    pub workflow_id: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub priority: Option<WorkflowPriority>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowPriority {
    Critical,
    High,
    Normal,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub execution_id: String,
    pub workflow_id: String,
    pub status: WorkflowStatus,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub current_step: Option<String>,
    pub steps_completed: usize,
    pub steps_total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStatusRequest {
    pub execution_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelWorkflowRequest {
    pub execution_id: String,
    pub reason: Option<String>,
}

#[async_trait]
pub trait OrchestratorAdapter: Send + Sync {
    async fn trigger_workflow(&self, request: TriggerWorkflowRequest) -> AdapterResult<WorkflowExecution>;
    async fn get_workflow_status(&self, request: WorkflowStatusRequest) -> AdapterResult<WorkflowExecution>;
    async fn cancel_workflow(&self, request: CancelWorkflowRequest) -> AdapterResult<WorkflowExecution>;
}
