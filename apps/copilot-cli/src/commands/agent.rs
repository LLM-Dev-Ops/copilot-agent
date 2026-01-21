//! Agent CLI commands for the Agentics platform.
//!
//! Provides CLI-invokable endpoints for agents following the Agentics Global Agent Constitution:
//! - Each agent is stateless and deterministic
//! - Emits exactly ONE DecisionEvent per invocation
//! - Produces machine-readable output only

use anyhow::{Context, Result};
use clap::Subcommand;
use colored::Colorize;
use copilot_core::{
    Complexity, DecomposerAgent, DecomposerConfig, DecomposerInput, DecomposerOutput,
    DecompositionContext, Plan, DECOMPOSER_AGENT_ID, DECOMPOSER_AGENT_VERSION,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};

/// Agent subcommands.
#[derive(Subcommand)]
pub enum AgentCommands {
    /// List available agents
    List,

    /// Show agent information
    Info {
        /// Agent ID
        agent_id: String,
    },

    /// Decompose a plan into atomic tasks
    #[command(name = "decompose")]
    Decompose(DecomposeArgs),
}

/// Arguments for the decompose command.
#[derive(clap::Args)]
pub struct DecomposeArgs {
    /// Input file (JSON) containing the plan to decompose
    /// Use "-" to read from stdin
    #[arg(short, long)]
    input: Option<String>,

    /// Plan ID (for inline specification)
    #[arg(long)]
    plan_id: Option<String>,

    /// Plan name (for inline specification)
    #[arg(long)]
    plan_name: Option<String>,

    /// Plan description (for inline specification)
    #[arg(long)]
    plan_description: Option<String>,

    /// Plan objectives (can be specified multiple times)
    #[arg(short, long)]
    objective: Vec<String>,

    /// Maximum decomposition depth
    #[arg(long, default_value = "5")]
    max_depth: u32,

    /// Maximum number of tasks to generate
    #[arg(long, default_value = "100")]
    max_tasks: usize,

    /// Minimum confidence threshold (0.0-1.0)
    #[arg(long, default_value = "0.7")]
    min_confidence: f32,

    /// Enable prerequisite detection
    #[arg(long, default_value = "true")]
    detect_prerequisites: bool,

    /// Enable boundary detection
    #[arg(long, default_value = "true")]
    detect_boundaries: bool,

    /// Execution reference for tracing
    #[arg(long)]
    execution_ref: Option<String>,

    /// Domain context (e.g., "software", "infrastructure")
    #[arg(long)]
    domain: Option<String>,

    /// Complexity hint (low, medium, high, critical)
    #[arg(long)]
    complexity: Option<String>,
}

/// Agent registry entry for listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentInfo {
    id: String,
    version: String,
    classification: Vec<String>,
    decision_type: String,
    description: String,
    capabilities: Vec<String>,
    restrictions: Vec<String>,
}

/// Run the agent command.
pub async fn run(cmd: AgentCommands, format: &str) -> Result<()> {
    match cmd {
        AgentCommands::List => list_agents(format).await,
        AgentCommands::Info { agent_id } => show_agent_info(&agent_id, format).await,
        AgentCommands::Decompose(args) => run_decompose(args, format).await,
    }
}

/// List all available agents.
async fn list_agents(format: &str) -> Result<()> {
    let agents = vec![AgentInfo {
        id: DECOMPOSER_AGENT_ID.to_string(),
        version: DECOMPOSER_AGENT_VERSION.to_string(),
        classification: vec!["TASK_DECOMPOSITION".to_string(), "STRUCTURAL_ANALYSIS".to_string()],
        decision_type: "task_decomposition".to_string(),
        description: "Decompose plans into atomic, bounded tasks".to_string(),
        capabilities: vec![
            "Break plans into tasks".to_string(),
            "Define task boundaries".to_string(),
            "Identify prerequisites".to_string(),
        ],
        restrictions: vec![
            "MUST NOT execute tasks".to_string(),
            "MUST NOT modify plans".to_string(),
            "MUST NOT assign ownership".to_string(),
        ],
    }];

    match format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&agents)?);
        }
        "yaml" => {
            println!("{}", serde_yaml::to_string(&agents)?);
        }
        _ => {
            println!("{}", "Available Agents".bold().green());
            println!("{}", "=".repeat(50));
            for agent in &agents {
                println!();
                println!("  {} v{}", agent.id.bold(), agent.version);
                println!("  Classification: {}", agent.classification.join(", ").cyan());
                println!("  Decision Type:  {}", agent.decision_type.yellow());
                println!("  Description:    {}", agent.description);
                println!("  Capabilities:");
                for cap in &agent.capabilities {
                    println!("    • {}", cap);
                }
                println!("  Restrictions:");
                for restriction in &agent.restrictions {
                    println!("    ⚠ {}", restriction.red());
                }
            }
            println!();
        }
    }

    Ok(())
}

/// Show detailed agent information.
async fn show_agent_info(agent_id: &str, format: &str) -> Result<()> {
    let agent_info = match agent_id {
        "decomposer-agent" => AgentInfo {
            id: DECOMPOSER_AGENT_ID.to_string(),
            version: DECOMPOSER_AGENT_VERSION.to_string(),
            classification: vec!["TASK_DECOMPOSITION".to_string(), "STRUCTURAL_ANALYSIS".to_string()],
            decision_type: "task_decomposition".to_string(),
            description: "Decompose plans into atomic, bounded tasks. \
                This agent analyzes plans and breaks them into the smallest possible \
                independent units of work while identifying dependencies and boundaries."
                .to_string(),
            capabilities: vec![
                "Break plans into atomic tasks".to_string(),
                "Define task boundaries (domain, phase, dependency, risk, resource)".to_string(),
                "Identify prerequisites (hard, soft, data, resource dependencies)".to_string(),
                "Complexity analysis".to_string(),
                "Tag extraction".to_string(),
                "Input/output identification".to_string(),
            ],
            restrictions: vec![
                "MUST NOT execute tasks".to_string(),
                "MUST NOT modify plans".to_string(),
                "MUST NOT assign ownership".to_string(),
                "MUST NOT connect to databases".to_string(),
                "MUST NOT orchestrate other agents".to_string(),
                "MUST NOT enforce policy".to_string(),
            ],
        },
        _ => {
            anyhow::bail!("Unknown agent: {}. Use 'agent list' to see available agents.", agent_id);
        }
    };

    match format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&agent_info)?);
        }
        "yaml" => {
            println!("{}", serde_yaml::to_string(&agent_info)?);
        }
        _ => {
            println!("{}", format!("Agent: {}", agent_info.id).bold().green());
            println!("{}", "=".repeat(50));
            println!();
            println!("Version:        {}", agent_info.version);
            println!("Classification: {}", agent_info.classification.join(", ").cyan());
            println!("Decision Type:  {}", agent_info.decision_type.yellow());
            println!();
            println!("{}", "Description:".bold());
            println!("  {}", agent_info.description);
            println!();
            println!("{}", "Capabilities:".bold());
            for cap in &agent_info.capabilities {
                println!("  ✓ {}", cap.green());
            }
            println!();
            println!("{}", "Restrictions (Constitution):".bold());
            for restriction in &agent_info.restrictions {
                println!("  ⚠ {}", restriction.red());
            }
            println!();
        }
    }

    Ok(())
}

/// Run the decompose command.
async fn run_decompose(args: DecomposeArgs, format: &str) -> Result<()> {
    // Build input from file or arguments
    let input = build_decomposer_input(&args)?;

    // Validate input
    if input.plan.objectives.is_empty() {
        anyhow::bail!("Plan must have at least one objective. Use --objective or provide input file.");
    }

    // Build config
    let config = DecomposerConfig {
        max_depth: args.max_depth,
        min_confidence: args.min_confidence,
        max_tasks: args.max_tasks,
        detect_prerequisites: args.detect_prerequisites,
        detect_boundaries: args.detect_boundaries,
    };

    // Create agent (stateless)
    let agent = DecomposerAgent::with_config(config);

    // Execute decomposition
    let decision_event = agent
        .decompose(&input)
        .context("Failed to decompose plan")?;

    // Output the decision event (machine-readable)
    match format {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&decision_event)?);
        }
        "yaml" => {
            println!("{}", serde_yaml::to_string(&decision_event)?);
        }
        _ => {
            // Human-readable output
            print_decision_event_human(&decision_event)?;
        }
    }

    Ok(())
}

/// Build DecomposerInput from command arguments.
fn build_decomposer_input(args: &DecomposeArgs) -> Result<DecomposerInput> {
    // If input file is provided, read from it
    if let Some(ref input_path) = args.input {
        let content = if input_path == "-" {
            // Read from stdin
            let mut buffer = String::new();
            io::stdin()
                .read_to_string(&mut buffer)
                .context("Failed to read from stdin")?;
            buffer
        } else {
            fs::read_to_string(input_path)
                .with_context(|| format!("Failed to read input file: {}", input_path))?
        };

        let input: DecomposerInput =
            serde_json::from_str(&content).context("Failed to parse input JSON")?;
        return Ok(input);
    }

    // Build from command-line arguments
    let plan_id = args
        .plan_id
        .clone()
        .unwrap_or_else(|| format!("cli-plan-{}", uuid::Uuid::new_v4()));

    let plan_name = args
        .plan_name
        .clone()
        .unwrap_or_else(|| "CLI Plan".to_string());

    let plan_description = args
        .plan_description
        .clone()
        .unwrap_or_else(|| "Plan created from CLI arguments".to_string());

    let plan = Plan {
        id: plan_id,
        name: plan_name,
        description: plan_description,
        objectives: args.objective.clone(),
        constraints: vec![],
        metadata: HashMap::new(),
    };

    let complexity = args.complexity.as_ref().and_then(|c| match c.to_lowercase().as_str() {
        "low" => Some(Complexity::Low),
        "medium" => Some(Complexity::Medium),
        "high" => Some(Complexity::High),
        "critical" => Some(Complexity::Critical),
        _ => None,
    });

    let context = DecompositionContext {
        domain: args.domain.clone(),
        complexity,
        hints: vec![],
    };

    Ok(DecomposerInput {
        plan,
        context,
        execution_ref: args.execution_ref.clone(),
    })
}

/// Print DecisionEvent in human-readable format.
fn print_decision_event_human(event: &copilot_core::DecisionEvent) -> Result<()> {
    println!("{}", "╔══════════════════════════════════════════════════════════════╗".cyan());
    println!("{}", "║              DECISION EVENT - TASK DECOMPOSITION             ║".cyan().bold());
    println!("{}", "╚══════════════════════════════════════════════════════════════╝".cyan());
    println!();

    // Event metadata
    println!("{}", "Event Metadata".bold().underline());
    println!("  Event ID:      {}", event.id.to_string().dimmed());
    println!("  Agent:         {} v{}", event.agent_id.green(), event.agent_version);
    println!("  Decision Type: {}", format!("{:?}", event.decision_type).yellow());
    println!("  Timestamp:     {}", event.timestamp);
    println!("  Confidence:    {}", format_confidence(event.confidence));
    println!("  Execution Ref: {}", event.execution_ref.dimmed());
    println!("  Inputs Hash:   {}", &event.inputs_hash[..16].dimmed());
    println!();

    // Constraints applied
    println!("{}", "Constraints Applied".bold().underline());
    for constraint in &event.constraints_applied {
        println!("  • {}", constraint);
    }
    println!();

    // Telemetry
    if let Some(duration) = event.telemetry.duration_ms {
        println!("{}", "Telemetry".bold().underline());
        println!("  Duration: {}ms", duration);
        for (key, value) in &event.telemetry.labels {
            println!("  {}: {}", key, value);
        }
        println!();
    }

    // Parse and display output
    let output: DecomposerOutput = serde_json::from_value(event.outputs.clone())
        .context("Failed to parse decomposition output")?;

    println!("{}", "Decomposition Results".bold().underline());
    println!("  Plan ID:      {}", output.plan_id);
    println!("  Total Tasks:  {}", output.analysis.total_tasks.to_string().green());
    println!("  Max Depth:    {}", output.analysis.max_depth_reached);
    println!("  Boundaries:   {}", output.analysis.boundary_count);
    println!("  Prerequisites: {}", output.analysis.prerequisite_count);
    println!("  Confidence:   {}", format_confidence(output.confidence));
    println!();

    // Complexity distribution
    if !output.analysis.complexity_distribution.is_empty() {
        println!("{}", "Complexity Distribution".bold().underline());
        for (complexity, count) in &output.analysis.complexity_distribution {
            let bar = "█".repeat(*count);
            let color_bar = match complexity.as_str() {
                "low" => bar.green(),
                "medium" => bar.yellow(),
                "high" => bar.red(),
                "critical" => bar.bright_red(),
                _ => bar.white(),
            };
            println!("  {:10} {} ({})", complexity, color_bar, count);
        }
        println!();
    }

    // Tasks
    println!("{}", "Atomic Tasks".bold().underline());
    for (i, task) in output.tasks.iter().enumerate() {
        let complexity_color = match task.complexity {
            Complexity::Low => "LOW".green(),
            Complexity::Medium => "MED".yellow(),
            Complexity::High => "HIGH".red(),
            Complexity::Critical => "CRIT".bright_red().bold(),
        };

        println!();
        println!(
            "  {}. {} [{}]",
            (i + 1).to_string().bold(),
            task.name.bold(),
            complexity_color
        );
        println!("     ID: {}", task.id.dimmed());

        if task.depth > 0 {
            println!("     Depth: {}", task.depth);
        }
        if let Some(ref parent) = task.parent_id {
            println!("     Parent: {}", parent.dimmed());
        }
        if !task.tags.is_empty() {
            println!("     Tags: {}", task.tags.join(", ").cyan());
        }

        // Show truncated description
        let desc = if task.description.len() > 80 {
            format!("{}...", &task.description[..77])
        } else {
            task.description.clone()
        };
        println!("     Description: {}", desc);
    }
    println!();

    // Boundaries
    if !output.boundaries.is_empty() {
        println!("{}", "Task Boundaries".bold().underline());
        for boundary in &output.boundaries {
            println!(
                "  • {} ({:?})",
                boundary.name.bold(),
                boundary.boundary_type
            );
            println!("    Tasks: {}", boundary.task_ids.len());
            println!("    Reason: {}", boundary.rationale.dimmed());
        }
        println!();
    }

    // Prerequisites
    if !output.prerequisites.is_empty() {
        println!("{}", "Prerequisites".bold().underline());
        for prereq in &output.prerequisites {
            let arrow = match prereq.relation_type {
                copilot_core::PrerequisiteType::HardDependency => "══>".red(),
                copilot_core::PrerequisiteType::SoftDependency => "──>".yellow(),
                copilot_core::PrerequisiteType::DataDependency => "··>".blue(),
                copilot_core::PrerequisiteType::ResourceDependency => "~~>".magenta(),
            };
            println!(
                "  {} {} {} ({})",
                &prereq.prerequisite_task_id[..20.min(prereq.prerequisite_task_id.len())],
                arrow,
                &prereq.dependent_task_id[..20.min(prereq.dependent_task_id.len())],
                format!("{:.0}%", prereq.confidence * 100.0)
            );
        }
        println!();
    }

    println!("{}", "═".repeat(65).cyan());
    println!(
        "{}",
        "Agent completed. Emitted exactly ONE DecisionEvent.".green()
    );

    Ok(())
}

/// Format confidence as a colored percentage.
fn format_confidence(confidence: f32) -> colored::ColoredString {
    let pct = format!("{:.1}%", confidence * 100.0);
    if confidence >= 0.9 {
        pct.green()
    } else if confidence >= 0.7 {
        pct.yellow()
    } else {
        pct.red()
    }
}
