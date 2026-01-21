//! Decomposer Agent - Decomposes plans into atomic, bounded tasks.
//!
//! # Classification
//! - TASK DECOMPOSITION
//! - STRUCTURAL ANALYSIS
//!
//! # Scope
//! - Break plans into tasks
//! - Define task boundaries
//! - Identify prerequisites
//!
//! # Decision Type
//! `task_decomposition`
//!
//! # MUST NEVER
//! - Execute tasks
//! - Modify plans
//! - Assign ownership
//!
//! # Agentics Global Agent Constitution Compliance
//! - Stateless at runtime
//! - Emits exactly ONE DecisionEvent per invocation
//! - Persists ONLY via ruvector-service (external)
//! - NEVER connects directly to Google SQL
//! - NEVER executes SQL
//! - NEVER modifies runtime behavior
//! - NEVER orchestrates other agents
//! - NEVER enforces policy
//! - NEVER intercepts execution paths

use crate::agents::contracts::{
    compute_inputs_hash, DecisionEvent, DecisionEventError, DecisionType, TelemetryMetadata,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use uuid::Uuid;

/// Agent identifier and version constants.
pub const DECOMPOSER_AGENT_ID: &str = "decomposer-agent";
pub const DECOMPOSER_AGENT_VERSION: &str = "1.0.0";

/// Decomposer Agent - Analyzes and decomposes plans into atomic tasks.
///
/// This agent is STATELESS and produces deterministic outputs for identical inputs.
/// It exists outside the execution path - it informs, it does not act.
#[derive(Debug, Clone, Default)]
pub struct DecomposerAgent {
    /// Configuration for decomposition behavior
    config: DecomposerConfig,
}

/// Configuration for the Decomposer Agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecomposerConfig {
    /// Maximum depth of task decomposition
    pub max_depth: u32,
    /// Minimum confidence threshold for decomposition decisions
    pub min_confidence: f32,
    /// Maximum number of atomic tasks to generate
    pub max_tasks: usize,
    /// Enable prerequisite detection
    pub detect_prerequisites: bool,
    /// Enable boundary detection
    pub detect_boundaries: bool,
}

impl Default for DecomposerConfig {
    fn default() -> Self {
        Self {
            max_depth: 5,
            min_confidence: 0.7,
            max_tasks: 100,
            detect_prerequisites: true,
            detect_boundaries: true,
        }
    }
}

/// Input for the Decomposer Agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecomposerInput {
    /// The plan to decompose
    pub plan: Plan,
    /// Optional context for decomposition
    #[serde(default)]
    pub context: DecompositionContext,
    /// Execution reference for tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_ref: Option<String>,
}

/// A plan to be decomposed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    /// Unique identifier for the plan
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Description of the plan
    pub description: String,
    /// High-level objectives
    pub objectives: Vec<String>,
    /// Known constraints
    #[serde(default)]
    pub constraints: Vec<String>,
    /// Optional metadata
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Context for decomposition.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DecompositionContext {
    /// Domain of the plan (e.g., "software", "infrastructure")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    /// Complexity hint
    #[serde(skip_serializing_if = "Option::is_none")]
    pub complexity: Option<Complexity>,
    /// Additional hints for decomposition
    #[serde(default)]
    pub hints: Vec<String>,
}

/// Complexity levels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Complexity {
    Low,
    Medium,
    High,
    Critical,
}

/// Output of the Decomposer Agent - atomic tasks with boundaries and prerequisites.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecomposerOutput {
    /// The original plan ID
    pub plan_id: String,
    /// Decomposed atomic tasks
    pub tasks: Vec<AtomicTask>,
    /// Task boundaries identified
    pub boundaries: Vec<TaskBoundary>,
    /// Prerequisite relationships
    pub prerequisites: Vec<PrerequisiteRelation>,
    /// Overall decomposition confidence
    pub confidence: f32,
    /// Analysis metadata
    pub analysis: DecompositionAnalysis,
}

/// An atomic, bounded task that cannot be further decomposed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicTask {
    /// Unique task identifier
    pub id: String,
    /// Human-readable task name
    pub name: String,
    /// Task description
    pub description: String,
    /// Estimated complexity
    pub complexity: Complexity,
    /// Tags for categorization
    #[serde(default)]
    pub tags: Vec<String>,
    /// Task inputs (read-only reference)
    #[serde(default)]
    pub inputs: Vec<TaskInput>,
    /// Expected outputs
    #[serde(default)]
    pub outputs: Vec<TaskOutput>,
    /// Acceptance criteria
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    /// Depth in the decomposition tree
    pub depth: u32,
    /// Parent task ID (if nested)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
}

/// Input reference for a task (read-only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInput {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// Expected output from a task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOutput {
    pub name: String,
    pub description: String,
}

/// Boundary between task groups.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskBoundary {
    /// Boundary identifier
    pub id: String,
    /// Name of the boundary
    pub name: String,
    /// Type of boundary
    pub boundary_type: BoundaryType,
    /// Tasks within this boundary
    pub task_ids: Vec<String>,
    /// Reason for this boundary
    pub rationale: String,
}

/// Types of task boundaries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BoundaryType {
    /// Domain boundary (different expertise areas)
    Domain,
    /// Phase boundary (sequential phases)
    Phase,
    /// Dependency boundary (dependency clusters)
    Dependency,
    /// Risk boundary (isolation for risk)
    Risk,
    /// Resource boundary (shared resource access)
    Resource,
}

/// Prerequisite relationship between tasks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrerequisiteRelation {
    /// Task that must complete first
    pub prerequisite_task_id: String,
    /// Task that depends on the prerequisite
    pub dependent_task_id: String,
    /// Type of prerequisite relationship
    pub relation_type: PrerequisiteType,
    /// Confidence in this relationship
    pub confidence: f32,
}

/// Types of prerequisite relationships.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrerequisiteType {
    /// Hard dependency - must complete before
    HardDependency,
    /// Soft dependency - recommended order
    SoftDependency,
    /// Data dependency - needs output
    DataDependency,
    /// Resource dependency - needs resource
    ResourceDependency,
}

/// Metadata from the decomposition analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecompositionAnalysis {
    /// Total number of tasks generated
    pub total_tasks: usize,
    /// Maximum decomposition depth reached
    pub max_depth_reached: u32,
    /// Number of boundaries identified
    pub boundary_count: usize,
    /// Number of prerequisites identified
    pub prerequisite_count: usize,
    /// Complexity distribution
    pub complexity_distribution: HashMap<String, usize>,
    /// Processing duration in milliseconds
    pub processing_duration_ms: u64,
}

/// Errors that can occur during decomposition.
#[derive(Debug, Clone, thiserror::Error)]
pub enum DecomposerError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Decomposition depth exceeded maximum of {0}")]
    MaxDepthExceeded(u32),
    #[error("Maximum task limit ({0}) exceeded")]
    MaxTasksExceeded(usize),
    #[error("Failed to serialize output: {0}")]
    SerializationError(String),
    #[error("Decision event error: {0}")]
    DecisionEventError(#[from] DecisionEventError),
}

impl DecomposerAgent {
    /// Create a new Decomposer Agent with default configuration.
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a new Decomposer Agent with custom configuration.
    pub fn with_config(config: DecomposerConfig) -> Self {
        Self { config }
    }

    /// Decompose a plan into atomic tasks.
    ///
    /// This is the main entry point. It:
    /// 1. Validates inputs
    /// 2. Performs deterministic decomposition
    /// 3. Emits exactly ONE DecisionEvent
    ///
    /// # Returns
    /// A single `DecisionEvent` containing the decomposition results.
    ///
    /// # Agent Constitution Compliance
    /// - Stateless: No internal state is modified
    /// - Deterministic: Same input always produces same output
    /// - Read-only: Does not modify the input plan
    /// - Non-executing: Does not execute any tasks
    pub fn decompose(&self, input: &DecomposerInput) -> Result<DecisionEvent, DecomposerError> {
        let start_time = Instant::now();

        // Validate input
        self.validate_input(input)?;

        // Compute inputs hash for determinism verification
        let inputs_hash = compute_inputs_hash(input);

        // Perform decomposition analysis (pure function, no side effects)
        let output = self.analyze_and_decompose(input, start_time)?;

        // Calculate overall confidence
        let confidence = self.calculate_confidence(&output);

        // Create telemetry metadata
        let telemetry = TelemetryMetadata::new()
            .with_duration(output.analysis.processing_duration_ms)
            .with_label("plan_id", &input.plan.id)
            .with_label("task_count", output.tasks.len().to_string());

        // Serialize output for the decision event
        let outputs = serde_json::to_value(&output)
            .map_err(|e| DecomposerError::SerializationError(e.to_string()))?;

        // Build constraints that were applied
        let constraints = self.get_applied_constraints();

        // Create the decision event
        let mut event = DecisionEvent::new(
            DECOMPOSER_AGENT_ID,
            DECOMPOSER_AGENT_VERSION,
            DecisionType::TaskDecomposition,
            inputs_hash,
            outputs,
            confidence,
        )
        .with_constraints(constraints)
        .with_telemetry(telemetry);

        // Set execution reference if provided
        if let Some(ref exec_ref) = input.execution_ref {
            event = event.with_execution_ref(exec_ref.clone());
        }

        // Validate the event before returning
        event.validate()?;

        Ok(event)
    }

    /// Validate the input plan.
    fn validate_input(&self, input: &DecomposerInput) -> Result<(), DecomposerError> {
        if input.plan.id.is_empty() {
            return Err(DecomposerError::InvalidInput("Plan ID is required".into()));
        }
        if input.plan.name.is_empty() {
            return Err(DecomposerError::InvalidInput("Plan name is required".into()));
        }
        if input.plan.objectives.is_empty() {
            return Err(DecomposerError::InvalidInput(
                "Plan must have at least one objective".into(),
            ));
        }
        Ok(())
    }

    /// Perform the actual decomposition analysis.
    ///
    /// This is a pure function with no side effects.
    fn analyze_and_decompose(
        &self,
        input: &DecomposerInput,
        start_time: Instant,
    ) -> Result<DecomposerOutput, DecomposerError> {
        let mut tasks = Vec::new();
        let mut boundaries = Vec::new();
        let mut prerequisites = Vec::new();
        let mut complexity_distribution: HashMap<String, usize> = HashMap::new();

        // Decompose each objective into atomic tasks
        for (idx, objective) in input.plan.objectives.iter().enumerate() {
            let objective_tasks = self.decompose_objective(
                objective,
                &input.plan.id,
                idx,
                0, // Initial depth
                &input.context,
            )?;

            // Update complexity distribution
            for task in &objective_tasks {
                let key = format!("{:?}", task.complexity).to_lowercase();
                *complexity_distribution.entry(key).or_insert(0) += 1;
            }

            tasks.extend(objective_tasks);
        }

        // Check task limit
        if tasks.len() > self.config.max_tasks {
            return Err(DecomposerError::MaxTasksExceeded(self.config.max_tasks));
        }

        // Detect boundaries if enabled
        if self.config.detect_boundaries {
            boundaries = self.detect_boundaries(&tasks, input);
        }

        // Detect prerequisites if enabled
        if self.config.detect_prerequisites {
            prerequisites = self.detect_prerequisites(&tasks, input);
        }

        let max_depth = tasks.iter().map(|t| t.depth).max().unwrap_or(0);

        let analysis = DecompositionAnalysis {
            total_tasks: tasks.len(),
            max_depth_reached: max_depth,
            boundary_count: boundaries.len(),
            prerequisite_count: prerequisites.len(),
            complexity_distribution,
            processing_duration_ms: start_time.elapsed().as_millis() as u64,
        };

        // Calculate overall confidence
        let confidence = self.calculate_task_confidence(&tasks, &prerequisites);

        Ok(DecomposerOutput {
            plan_id: input.plan.id.clone(),
            tasks,
            boundaries,
            prerequisites,
            confidence,
            analysis,
        })
    }

    /// Decompose a single objective into atomic tasks.
    fn decompose_objective(
        &self,
        objective: &str,
        plan_id: &str,
        objective_idx: usize,
        current_depth: u32,
        context: &DecompositionContext,
    ) -> Result<Vec<AtomicTask>, DecomposerError> {
        if current_depth > self.config.max_depth {
            return Err(DecomposerError::MaxDepthExceeded(self.config.max_depth));
        }

        let mut tasks = Vec::new();

        // Determine complexity based on objective analysis
        let complexity = self.analyze_objective_complexity(objective, context);

        // Create the main task for this objective
        let main_task_id = format!("{}-obj{}-main", plan_id, objective_idx);
        let main_task = AtomicTask {
            id: main_task_id.clone(),
            name: format!("Objective {}: {}", objective_idx + 1, truncate(objective, 50)),
            description: objective.to_string(),
            complexity,
            tags: self.extract_tags(objective),
            inputs: self.extract_inputs(objective),
            outputs: self.extract_outputs(objective),
            acceptance_criteria: self.extract_acceptance_criteria(objective),
            depth: current_depth,
            parent_id: None,
        };

        tasks.push(main_task);

        // If complexity is high, decompose further
        if matches!(complexity, Complexity::High | Complexity::Critical)
            && current_depth < self.config.max_depth
        {
            let subtasks = self.create_subtasks(
                objective,
                &main_task_id,
                plan_id,
                objective_idx,
                current_depth + 1,
                context,
            )?;
            tasks.extend(subtasks);
        }

        Ok(tasks)
    }

    /// Analyze the complexity of an objective.
    fn analyze_objective_complexity(
        &self,
        objective: &str,
        context: &DecompositionContext,
    ) -> Complexity {
        // Use context hint if available
        if let Some(ref ctx_complexity) = context.complexity {
            return *ctx_complexity;
        }

        // Heuristic-based complexity analysis
        let word_count = objective.split_whitespace().count();
        let has_multiple_parts = objective.contains(" and ") || objective.contains(", ");
        let has_technical_terms = objective.contains("integrate")
            || objective.contains("migrate")
            || objective.contains("refactor")
            || objective.contains("security")
            || objective.contains("performance");

        match (word_count, has_multiple_parts, has_technical_terms) {
            (_, _, true) if has_multiple_parts => Complexity::Critical,
            (w, true, _) if w > 20 => Complexity::High,
            (w, _, true) if w > 10 => Complexity::High,
            (w, true, _) if w > 10 => Complexity::Medium,
            (w, _, _) if w > 15 => Complexity::Medium,
            _ => Complexity::Low,
        }
    }

    /// Create subtasks for a complex objective.
    fn create_subtasks(
        &self,
        objective: &str,
        parent_id: &str,
        plan_id: &str,
        objective_idx: usize,
        depth: u32,
        context: &DecompositionContext,
    ) -> Result<Vec<AtomicTask>, DecomposerError> {
        let mut subtasks = Vec::new();

        // Split objective into logical parts
        let parts: Vec<&str> = objective
            .split(|c| c == ',' || c == ';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("and"))
            .collect();

        for (sub_idx, part) in parts.iter().enumerate() {
            // Skip very short parts
            if part.split_whitespace().count() < 3 {
                continue;
            }

            let task_id = format!("{}-obj{}-sub{}", plan_id, objective_idx, sub_idx);
            let complexity = self.analyze_objective_complexity(part, context);

            let subtask = AtomicTask {
                id: task_id,
                name: format!("Subtask {}.{}: {}", objective_idx + 1, sub_idx + 1, truncate(part, 40)),
                description: part.to_string(),
                complexity,
                tags: self.extract_tags(part),
                inputs: self.extract_inputs(part),
                outputs: self.extract_outputs(part),
                acceptance_criteria: vec![format!("Complete: {}", truncate(part, 100))],
                depth,
                parent_id: Some(parent_id.to_string()),
            };

            subtasks.push(subtask);
        }

        Ok(subtasks)
    }

    /// Extract tags from text content.
    fn extract_tags(&self, text: &str) -> Vec<String> {
        let mut tags = Vec::new();
        let text_lower = text.to_lowercase();

        // Technical domain tags
        if text_lower.contains("api") || text_lower.contains("endpoint") {
            tags.push("api".to_string());
        }
        if text_lower.contains("database") || text_lower.contains("sql") || text_lower.contains("data") {
            tags.push("data".to_string());
        }
        if text_lower.contains("test") {
            tags.push("testing".to_string());
        }
        if text_lower.contains("security") || text_lower.contains("auth") {
            tags.push("security".to_string());
        }
        if text_lower.contains("ui") || text_lower.contains("frontend") || text_lower.contains("user interface") {
            tags.push("frontend".to_string());
        }
        if text_lower.contains("backend") || text_lower.contains("server") {
            tags.push("backend".to_string());
        }
        if text_lower.contains("deploy") || text_lower.contains("ci") || text_lower.contains("cd") {
            tags.push("devops".to_string());
        }
        if text_lower.contains("document") || text_lower.contains("readme") {
            tags.push("documentation".to_string());
        }

        tags
    }

    /// Extract potential inputs from text.
    fn extract_inputs(&self, text: &str) -> Vec<TaskInput> {
        let mut inputs = Vec::new();
        let text_lower = text.to_lowercase();

        // Look for common input patterns
        if text_lower.contains("using") || text_lower.contains("from") {
            inputs.push(TaskInput {
                name: "source_data".to_string(),
                description: "Input data or configuration required".to_string(),
                source: None,
            });
        }

        if text_lower.contains("based on") || text_lower.contains("according to") {
            inputs.push(TaskInput {
                name: "requirements".to_string(),
                description: "Requirements or specifications".to_string(),
                source: None,
            });
        }

        inputs
    }

    /// Extract expected outputs from text.
    fn extract_outputs(&self, text: &str) -> Vec<TaskOutput> {
        let mut outputs = Vec::new();
        let text_lower = text.to_lowercase();

        if text_lower.contains("create") || text_lower.contains("implement") || text_lower.contains("build") {
            outputs.push(TaskOutput {
                name: "deliverable".to_string(),
                description: "Created artifact or implementation".to_string(),
            });
        }

        if text_lower.contains("document") || text_lower.contains("report") {
            outputs.push(TaskOutput {
                name: "documentation".to_string(),
                description: "Documentation or report".to_string(),
            });
        }

        if text_lower.contains("test") || text_lower.contains("verify") {
            outputs.push(TaskOutput {
                name: "validation_results".to_string(),
                description: "Test or validation results".to_string(),
            });
        }

        outputs
    }

    /// Extract acceptance criteria from text.
    fn extract_acceptance_criteria(&self, text: &str) -> Vec<String> {
        vec![
            format!("Task completed as described: {}", truncate(text, 100)),
            "All outputs are produced".to_string(),
            "No blocking issues remain".to_string(),
        ]
    }

    /// Detect task boundaries.
    fn detect_boundaries(&self, tasks: &[AtomicTask], input: &DecomposerInput) -> Vec<TaskBoundary> {
        let mut boundaries = Vec::new();

        // Group tasks by tags for domain boundaries
        let mut tag_groups: HashMap<String, Vec<String>> = HashMap::new();
        for task in tasks {
            for tag in &task.tags {
                tag_groups
                    .entry(tag.clone())
                    .or_default()
                    .push(task.id.clone());
            }
        }

        for (tag, task_ids) in tag_groups {
            if task_ids.len() > 1 {
                boundaries.push(TaskBoundary {
                    id: format!("boundary-{}", tag),
                    name: format!("{} tasks", tag),
                    boundary_type: BoundaryType::Domain,
                    task_ids,
                    rationale: format!("Tasks related to {}", tag),
                });
            }
        }

        // Group by depth for phase boundaries
        let mut depth_groups: HashMap<u32, Vec<String>> = HashMap::new();
        for task in tasks {
            depth_groups
                .entry(task.depth)
                .or_default()
                .push(task.id.clone());
        }

        for (depth, task_ids) in depth_groups {
            if task_ids.len() > 1 {
                boundaries.push(TaskBoundary {
                    id: format!("boundary-depth{}", depth),
                    name: format!("Level {} tasks", depth),
                    boundary_type: BoundaryType::Phase,
                    task_ids,
                    rationale: format!("Tasks at decomposition depth {}", depth),
                });
            }
        }

        boundaries
    }

    /// Detect prerequisite relationships between tasks.
    fn detect_prerequisites(
        &self,
        tasks: &[AtomicTask],
        _input: &DecomposerInput,
    ) -> Vec<PrerequisiteRelation> {
        let mut prerequisites = Vec::new();

        // Parent-child relationships are hard dependencies
        for task in tasks {
            if let Some(ref parent_id) = task.parent_id {
                // Parent must complete before child can be considered complete
                prerequisites.push(PrerequisiteRelation {
                    prerequisite_task_id: task.id.clone(),
                    dependent_task_id: parent_id.clone(),
                    relation_type: PrerequisiteType::HardDependency,
                    confidence: 0.95,
                });
            }
        }

        // Detect data dependencies based on inputs/outputs
        for (i, task) in tasks.iter().enumerate() {
            for output in &task.outputs {
                for other_task in tasks.iter().skip(i + 1) {
                    for input in &other_task.inputs {
                        // Simple heuristic: if names are similar, there might be a dependency
                        if output.name.to_lowercase().contains(&input.name.to_lowercase())
                            || input.name.to_lowercase().contains(&output.name.to_lowercase())
                        {
                            prerequisites.push(PrerequisiteRelation {
                                prerequisite_task_id: task.id.clone(),
                                dependent_task_id: other_task.id.clone(),
                                relation_type: PrerequisiteType::DataDependency,
                                confidence: 0.7,
                            });
                        }
                    }
                }
            }
        }

        prerequisites
    }

    /// Calculate confidence score for the decomposition.
    fn calculate_confidence(&self, output: &DecomposerOutput) -> f32 {
        output.confidence
    }

    /// Calculate confidence based on tasks and prerequisites.
    fn calculate_task_confidence(
        &self,
        tasks: &[AtomicTask],
        prerequisites: &[PrerequisiteRelation],
    ) -> f32 {
        if tasks.is_empty() {
            return 0.0;
        }

        let mut confidence = 0.9; // Base confidence

        // Reduce confidence if too many tasks
        if tasks.len() > 50 {
            confidence -= 0.1;
        }

        // Increase confidence if prerequisites are well-defined
        if !prerequisites.is_empty() {
            let avg_prereq_confidence: f32 =
                prerequisites.iter().map(|p| p.confidence).sum::<f32>() / prerequisites.len() as f32;
            confidence = (confidence + avg_prereq_confidence) / 2.0;
        }

        // Reduce confidence if tasks are too uniform (might be over-simplified)
        let unique_complexities: std::collections::HashSet<_> =
            tasks.iter().map(|t| format!("{:?}", t.complexity)).collect();
        if unique_complexities.len() == 1 && tasks.len() > 5 {
            confidence -= 0.05;
        }

        confidence.clamp(0.0, 1.0)
    }

    /// Get the constraints that were applied during decomposition.
    fn get_applied_constraints(&self) -> Vec<String> {
        let mut constraints = vec![
            format!("max_depth:{}", self.config.max_depth),
            format!("max_tasks:{}", self.config.max_tasks),
            format!("min_confidence:{}", self.config.min_confidence),
        ];

        if self.config.detect_prerequisites {
            constraints.push("prerequisite_detection:enabled".to_string());
        }
        if self.config.detect_boundaries {
            constraints.push("boundary_detection:enabled".to_string());
        }

        // Constitution constraints (always applied)
        constraints.push("stateless:true".to_string());
        constraints.push("read_only:true".to_string());
        constraints.push("non_executing:true".to_string());

        constraints
    }
}

/// Helper function to truncate strings.
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_plan() -> Plan {
        Plan {
            id: "plan-001".to_string(),
            name: "Test Plan".to_string(),
            description: "A test plan for decomposition".to_string(),
            objectives: vec![
                "Implement user authentication with JWT tokens".to_string(),
                "Create API endpoints for user management".to_string(),
                "Write integration tests for the auth module".to_string(),
            ],
            constraints: vec!["Must be completed within 2 sprints".to_string()],
            metadata: HashMap::new(),
        }
    }

    fn sample_input() -> DecomposerInput {
        DecomposerInput {
            plan: sample_plan(),
            context: DecompositionContext::default(),
            execution_ref: Some("test-execution-001".to_string()),
        }
    }

    #[test]
    fn test_decomposer_creation() {
        let agent = DecomposerAgent::new();
        assert_eq!(agent.config.max_depth, 5);
        assert_eq!(agent.config.min_confidence, 0.7);
    }

    #[test]
    fn test_decomposer_with_config() {
        let config = DecomposerConfig {
            max_depth: 3,
            min_confidence: 0.8,
            max_tasks: 50,
            detect_prerequisites: true,
            detect_boundaries: false,
        };
        let agent = DecomposerAgent::with_config(config);
        assert_eq!(agent.config.max_depth, 3);
        assert!(!agent.config.detect_boundaries);
    }

    #[test]
    fn test_decompose_returns_decision_event() {
        let agent = DecomposerAgent::new();
        let input = sample_input();

        let result = agent.decompose(&input);
        assert!(result.is_ok());

        let event = result.unwrap();
        assert_eq!(event.agent_id, DECOMPOSER_AGENT_ID);
        assert_eq!(event.agent_version, DECOMPOSER_AGENT_VERSION);
        assert_eq!(event.decision_type, DecisionType::TaskDecomposition);
        assert!(event.confidence > 0.0);
        assert!(event.confidence <= 1.0);
    }

    #[test]
    fn test_decompose_outputs_tasks() {
        let agent = DecomposerAgent::new();
        let input = sample_input();

        let event = agent.decompose(&input).unwrap();
        let output: DecomposerOutput = serde_json::from_value(event.outputs).unwrap();

        assert!(!output.tasks.is_empty());
        assert_eq!(output.plan_id, "plan-001");
        assert!(output.analysis.total_tasks > 0);
    }

    #[test]
    fn test_deterministic_output() {
        let agent = DecomposerAgent::new();
        let input = sample_input();

        let event1 = agent.decompose(&input).unwrap();
        let event2 = agent.decompose(&input).unwrap();

        // Same inputs should produce same hash
        assert_eq!(event1.inputs_hash, event2.inputs_hash);

        // Outputs should be equivalent (excluding timestamps and IDs)
        let output1: DecomposerOutput = serde_json::from_value(event1.outputs).unwrap();
        let output2: DecomposerOutput = serde_json::from_value(event2.outputs).unwrap();
        assert_eq!(output1.tasks.len(), output2.tasks.len());
    }

    #[test]
    fn test_invalid_input_empty_plan_id() {
        let agent = DecomposerAgent::new();
        let input = DecomposerInput {
            plan: Plan {
                id: "".to_string(),
                name: "Test".to_string(),
                description: "Test".to_string(),
                objectives: vec!["Objective".to_string()],
                constraints: vec![],
                metadata: HashMap::new(),
            },
            context: DecompositionContext::default(),
            execution_ref: None,
        };

        let result = agent.decompose(&input);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DecomposerError::InvalidInput(_)));
    }

    #[test]
    fn test_invalid_input_no_objectives() {
        let agent = DecomposerAgent::new();
        let input = DecomposerInput {
            plan: Plan {
                id: "plan-001".to_string(),
                name: "Test".to_string(),
                description: "Test".to_string(),
                objectives: vec![],
                constraints: vec![],
                metadata: HashMap::new(),
            },
            context: DecompositionContext::default(),
            execution_ref: None,
        };

        let result = agent.decompose(&input);
        assert!(result.is_err());
    }

    #[test]
    fn test_constraints_applied() {
        let agent = DecomposerAgent::new();
        let input = sample_input();

        let event = agent.decompose(&input).unwrap();

        assert!(!event.constraints_applied.is_empty());
        assert!(event.constraints_applied.iter().any(|c| c.contains("stateless")));
        assert!(event.constraints_applied.iter().any(|c| c.contains("read_only")));
        assert!(event.constraints_applied.iter().any(|c| c.contains("non_executing")));
    }

    #[test]
    fn test_complexity_analysis() {
        let agent = DecomposerAgent::new();
        let context = DecompositionContext::default();

        let simple = "Create a button";
        let complex = "Implement user authentication with JWT tokens, OAuth2 integration, and session management";

        let simple_complexity = agent.analyze_objective_complexity(simple, &context);
        let complex_complexity = agent.analyze_objective_complexity(complex, &context);

        assert!(matches!(simple_complexity, Complexity::Low));
        assert!(matches!(complex_complexity, Complexity::High | Complexity::Critical));
    }

    #[test]
    fn test_tag_extraction() {
        let agent = DecomposerAgent::new();

        let tags = agent.extract_tags("Create API endpoints for authentication");
        assert!(tags.contains(&"api".to_string()));
        assert!(tags.contains(&"security".to_string()));

        let tags = agent.extract_tags("Write unit tests for database operations");
        assert!(tags.contains(&"testing".to_string()));
        assert!(tags.contains(&"data".to_string()));
    }

    #[test]
    fn test_telemetry_included() {
        let agent = DecomposerAgent::new();
        let input = sample_input();

        let event = agent.decompose(&input).unwrap();

        assert!(event.telemetry.duration_ms.is_some());
        assert!(event.telemetry.labels.contains_key("plan_id"));
        assert!(event.telemetry.labels.contains_key("task_count"));
    }

    #[test]
    fn test_execution_ref_preserved() {
        let agent = DecomposerAgent::new();
        let input = sample_input();

        let event = agent.decompose(&input).unwrap();

        assert_eq!(event.execution_ref, "test-execution-001");
    }
}
