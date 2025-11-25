# Authorization Architecture

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-25

## Overview

This document defines the authorization architecture for LLM-CoPilot-Agent, implementing Role-Based Access Control (RBAC), Attribute-Based Access Control (ABAC), policy-based authorization, and fine-grained permission management.

---

## Table of Contents

1. [Authorization Model](#authorization-model)
2. [Role Definitions](#role-definitions)
3. [Permission Model](#permission-model)
4. [RBAC Implementation](#rbac-implementation)
5. [ABAC Implementation](#abac-implementation)
6. [Policy Engine](#policy-engine)
7. [Enforcement Points](#enforcement-points)
8. [Rust Implementation](#rust-implementation)

---

## Authorization Model

### Three-Layer Authorization

```
┌─────────────────────────────────────────────────────────────┐
│                    Authorization Layers                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: RBAC (Role-Based Access Control)                   │
│  ├─ User → Roles → Permissions                               │
│  ├─ Static role assignments                                  │
│  └─ Coarse-grained access control                            │
│                                                               │
│  Layer 2: ABAC (Attribute-Based Access Control)              │
│  ├─ Context-aware decisions                                  │
│  ├─ Resource attributes (owner, environment, sensitivity)    │
│  ├─ User attributes (department, clearance level)            │
│  └─ Environmental attributes (time, location, IP)            │
│                                                               │
│  Layer 3: Policy-Based Authorization                         │
│  ├─ Custom business rules                                    │
│  ├─ Dynamic policy evaluation                                │
│  ├─ Compliance requirements (GDPR, SOC2)                     │
│  └─ Audit and approval workflows                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Authorization Flow

```
Request → Extract Identity → Load User Context → Policy Decision → Enforce → Audit

         ┌──────────────┐
         │   Request    │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │   Extract    │──────> JWT Claims / API Key / mTLS Cert
         │   Identity   │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │  Load User   │──────> Roles, Permissions, Attributes
         │   Context    │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │   Policy     │──────> Evaluate RBAC + ABAC + Custom Policies
         │  Decision    │
         │   Point      │
         └──────┬───────┘
                │
                ├─── ALLOW ───────> Execute Request
                │
                └─── DENY ────────> Return 403 Forbidden
                         │
                         └─────────> Audit Log
```

---

## Role Definitions

### Role Hierarchy

```
                    ┌──────────────┐
                    │   SuperAdmin │ (System Owner)
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
      ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐
      │   Admin   │  │ Security│  │  Auditor  │
      │           │  │  Admin  │  │           │
      └─────┬─────┘  └─────────┘  └───────────┘
            │
     ┌──────┴──────┐
     │             │
┌────▼────┐  ┌────▼────────┐
│Developer│  │  Operator   │
│         │  │             │
└────┬────┘  └─────────────┘
     │
┌────▼────┐
│ Viewer  │
│         │
└─────────┘
```

### Role Definitions (Rust)

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    SuperAdmin,
    Admin,
    SecurityAdmin,
    Auditor,
    Developer,
    Operator,
    Viewer,
}

impl Role {
    /// Get role hierarchy level (higher = more privileged)
    pub fn hierarchy_level(&self) -> u8 {
        match self {
            Role::SuperAdmin => 100,
            Role::Admin => 80,
            Role::SecurityAdmin => 75,
            Role::Auditor => 70,
            Role::Developer => 50,
            Role::Operator => 40,
            Role::Viewer => 10,
        }
    }

    /// Check if this role has at least the privilege of another role
    pub fn has_privilege_of(&self, other: &Role) -> bool {
        self.hierarchy_level() >= other.hierarchy_level()
    }

    /// Get default permissions for this role
    pub fn default_permissions(&self) -> HashSet<Permission> {
        match self {
            Role::SuperAdmin => Permission::all(),
            Role::Admin => {
                let mut perms = HashSet::new();
                perms.extend(vec![
                    Permission::UserManage,
                    Permission::RoleManage,
                    Permission::WorkflowExecute,
                    Permission::WorkflowManage,
                    Permission::IncidentView,
                    Permission::IncidentManage,
                    Permission::ObservabilityView,
                    Permission::TestView,
                    Permission::TestExecute,
                ]);
                perms
            }
            Role::SecurityAdmin => {
                let mut perms = HashSet::new();
                perms.extend(vec![
                    Permission::AuditView,
                    Permission::SecurityPolicyManage,
                    Permission::ApiKeyManage,
                    Permission::UserView,
                    Permission::IncidentView,
                ]);
                perms
            }
            Role::Auditor => {
                let mut perms = HashSet::new();
                perms.extend(vec![
                    Permission::AuditView,
                    Permission::UserView,
                    Permission::WorkflowView,
                    Permission::IncidentView,
                    Permission::ObservabilityView,
                ]);
                perms
            }
            Role::Developer => {
                let mut perms = HashSet::new();
                perms.extend(vec![
                    Permission::WorkflowExecute,
                    Permission::WorkflowView,
                    Permission::TestExecute,
                    Permission::TestView,
                    Permission::TestManage,
                    Permission::ObservabilityView,
                    Permission::ObservabilityQuery,
                    Permission::IncidentView,
                    Permission::IncidentCreate,
                ]);
                perms
            }
            Role::Operator => {
                let mut perms = HashSet::new();
                perms.extend(vec![
                    Permission::WorkflowExecute,
                    Permission::WorkflowView,
                    Permission::IncidentView,
                    Permission::IncidentManage,
                    Permission::IncidentCreate,
                    Permission::ObservabilityView,
                    Permission::ObservabilityQuery,
                ]);
                perms
            }
            Role::Viewer => {
                let mut perms = HashSet::new();
                perms.extend(vec![
                    Permission::WorkflowView,
                    Permission::TestView,
                    Permission::ObservabilityView,
                    Permission::IncidentView,
                ]);
                perms
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_hierarchy() {
        assert!(Role::SuperAdmin.has_privilege_of(&Role::Admin));
        assert!(Role::Admin.has_privilege_of(&Role::Developer));
        assert!(!Role::Developer.has_privilege_of(&Role::Admin));
    }
}
```

---

## Permission Model

### Permission Categories

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // User Management
    UserView,
    UserCreate,
    UserUpdate,
    UserDelete,
    UserManage, // Combines all user permissions

    // Role Management
    RoleView,
    RoleAssign,
    RoleRevoke,
    RoleManage, // Combines all role permissions

    // Workflow Permissions
    WorkflowView,
    WorkflowCreate,
    WorkflowExecute,
    WorkflowApprove,
    WorkflowCancel,
    WorkflowManage, // Combines all workflow permissions

    // Test Permissions
    TestView,
    TestExecute,
    TestCreate,
    TestDelete,
    TestManage,

    // Observability Permissions
    ObservabilityView,
    ObservabilityQuery,
    ObservabilityDashboardCreate,
    ObservabilityAlertManage,

    // Incident Permissions
    IncidentView,
    IncidentCreate,
    IncidentUpdate,
    IncidentResolve,
    IncidentManage,

    // Security Permissions
    ApiKeyCreate,
    ApiKeyRevoke,
    ApiKeyManage,
    SecurityPolicyManage,

    // Audit Permissions
    AuditView,
    AuditExport,

    // System Permissions
    SystemConfigView,
    SystemConfigUpdate,
}

impl Permission {
    /// Get all permissions
    pub fn all() -> HashSet<Permission> {
        vec![
            Permission::UserView,
            Permission::UserCreate,
            Permission::UserUpdate,
            Permission::UserDelete,
            Permission::UserManage,
            Permission::RoleView,
            Permission::RoleAssign,
            Permission::RoleRevoke,
            Permission::RoleManage,
            Permission::WorkflowView,
            Permission::WorkflowCreate,
            Permission::WorkflowExecute,
            Permission::WorkflowApprove,
            Permission::WorkflowCancel,
            Permission::WorkflowManage,
            Permission::TestView,
            Permission::TestExecute,
            Permission::TestCreate,
            Permission::TestDelete,
            Permission::TestManage,
            Permission::ObservabilityView,
            Permission::ObservabilityQuery,
            Permission::ObservabilityDashboardCreate,
            Permission::ObservabilityAlertManage,
            Permission::IncidentView,
            Permission::IncidentCreate,
            Permission::IncidentUpdate,
            Permission::IncidentResolve,
            Permission::IncidentManage,
            Permission::ApiKeyCreate,
            Permission::ApiKeyRevoke,
            Permission::ApiKeyManage,
            Permission::SecurityPolicyManage,
            Permission::AuditView,
            Permission::AuditExport,
            Permission::SystemConfigView,
            Permission::SystemConfigUpdate,
        ]
        .into_iter()
        .collect()
    }

    /// Parse permission from string (e.g., "workflow:execute")
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "user:view" => Some(Permission::UserView),
            "user:create" => Some(Permission::UserCreate),
            "user:update" => Some(Permission::UserUpdate),
            "user:delete" => Some(Permission::UserDelete),
            "user:manage" => Some(Permission::UserManage),
            "workflow:view" => Some(Permission::WorkflowView),
            "workflow:create" => Some(Permission::WorkflowCreate),
            "workflow:execute" => Some(Permission::WorkflowExecute),
            "workflow:approve" => Some(Permission::WorkflowApprove),
            "workflow:cancel" => Some(Permission::WorkflowCancel),
            "workflow:manage" => Some(Permission::WorkflowManage),
            "test:view" => Some(Permission::TestView),
            "test:execute" => Some(Permission::TestExecute),
            "incident:view" => Some(Permission::IncidentView),
            "incident:create" => Some(Permission::IncidentCreate),
            "incident:manage" => Some(Permission::IncidentManage),
            "observability:view" => Some(Permission::ObservabilityView),
            "observability:query" => Some(Permission::ObservabilityQuery),
            "audit:view" => Some(Permission::AuditView),
            "audit:export" => Some(Permission::AuditExport),
            _ => None,
        }
    }

    /// Convert permission to string representation
    pub fn to_str(&self) -> &'static str {
        match self {
            Permission::UserView => "user:view",
            Permission::UserCreate => "user:create",
            Permission::UserUpdate => "user:update",
            Permission::UserDelete => "user:delete",
            Permission::UserManage => "user:manage",
            Permission::WorkflowView => "workflow:view",
            Permission::WorkflowCreate => "workflow:create",
            Permission::WorkflowExecute => "workflow:execute",
            Permission::WorkflowApprove => "workflow:approve",
            Permission::WorkflowCancel => "workflow:cancel",
            Permission::WorkflowManage => "workflow:manage",
            Permission::TestView => "test:view",
            Permission::TestExecute => "test:execute",
            Permission::TestCreate => "test:create",
            Permission::TestDelete => "test:delete",
            Permission::TestManage => "test:manage",
            Permission::IncidentView => "incident:view",
            Permission::IncidentCreate => "incident:create",
            Permission::IncidentManage => "incident:manage",
            Permission::ObservabilityView => "observability:view",
            Permission::ObservabilityQuery => "observability:query",
            Permission::AuditView => "audit:view",
            Permission::AuditExport => "audit:export",
            _ => "unknown",
        }
    }
}
```

---

## RBAC Implementation

### User Authorization Context

```rust
#[derive(Debug, Clone)]
pub struct AuthorizationContext {
    pub user_id: String,
    pub email: String,
    pub roles: HashSet<Role>,
    pub permissions: HashSet<Permission>,
    pub tenant_id: Option<String>,
    pub session_id: String,
    pub ip_address: String,
    pub mfa_verified: bool,
}

impl AuthorizationContext {
    /// Create from JWT claims
    pub fn from_jwt_claims(claims: &AccessTokenClaims) -> Self {
        let roles: HashSet<Role> = claims
            .roles
            .iter()
            .filter_map(|r| serde_json::from_str(&format!("\"{}\"", r)).ok())
            .collect();

        let permissions: HashSet<Permission> = claims
            .permissions
            .iter()
            .filter_map(|p| Permission::from_str(p))
            .collect();

        Self {
            user_id: claims.user_id.clone(),
            email: claims.email.clone(),
            roles,
            permissions,
            tenant_id: claims.tenant_id.clone(),
            session_id: claims.session_id.clone(),
            ip_address: claims.ip_address.clone(),
            mfa_verified: claims.mfa_verified,
        }
    }

    /// Check if user has specific role
    pub fn has_role(&self, role: &Role) -> bool {
        self.roles.contains(role)
    }

    /// Check if user has any of the specified roles
    pub fn has_any_role(&self, roles: &[Role]) -> bool {
        roles.iter().any(|r| self.has_role(r))
    }

    /// Check if user has specific permission
    pub fn has_permission(&self, permission: &Permission) -> bool {
        self.permissions.contains(permission)
    }

    /// Check if user has any of the specified permissions
    pub fn has_any_permission(&self, permissions: &[Permission]) -> bool {
        permissions.iter().any(|p| self.has_permission(p))
    }

    /// Check if user has all specified permissions
    pub fn has_all_permissions(&self, permissions: &[Permission]) -> bool {
        permissions.iter().all(|p| self.has_permission(p))
    }

    /// Check if user has at least the privilege level of a role
    pub fn has_privilege_level(&self, required_role: &Role) -> bool {
        self.roles
            .iter()
            .any(|r| r.has_privilege_of(required_role))
    }
}
```

### RBAC Service

```rust
use async_trait::async_trait;
use std::sync::Arc;

#[async_trait]
pub trait RbacService: Send + Sync {
    async fn check_permission(
        &self,
        context: &AuthorizationContext,
        permission: Permission,
    ) -> Result<bool, AuthorizationError>;

    async fn check_role(
        &self,
        context: &AuthorizationContext,
        role: Role,
    ) -> Result<bool, AuthorizationError>;

    async fn get_user_permissions(
        &self,
        user_id: &str,
    ) -> Result<HashSet<Permission>, AuthorizationError>;

    async fn grant_role(
        &self,
        user_id: &str,
        role: Role,
    ) -> Result<(), AuthorizationError>;

    async fn revoke_role(
        &self,
        user_id: &str,
        role: Role,
    ) -> Result<(), AuthorizationError>;
}

#[derive(Debug)]
pub enum AuthorizationError {
    PermissionDenied,
    RoleNotFound,
    UserNotFound,
    DatabaseError(String),
}

pub struct RbacServiceImpl {
    user_repository: Arc<dyn UserRepository>,
    policy_cache: Arc<PolicyCache>,
}

#[async_trait]
impl RbacService for RbacServiceImpl {
    async fn check_permission(
        &self,
        context: &AuthorizationContext,
        permission: Permission,
    ) -> Result<bool, AuthorizationError> {
        // 1. Check direct permission
        if context.has_permission(&permission) {
            return Ok(true);
        }

        // 2. Check if any role grants this permission
        for role in &context.roles {
            if role.default_permissions().contains(&permission) {
                return Ok(true);
            }
        }

        Ok(false)
    }

    async fn check_role(
        &self,
        context: &AuthorizationContext,
        role: Role,
    ) -> Result<bool, AuthorizationError> {
        Ok(context.has_role(&role))
    }

    async fn get_user_permissions(
        &self,
        user_id: &str,
    ) -> Result<HashSet<Permission>, AuthorizationError> {
        let user = self
            .user_repository
            .get_user(user_id)
            .await
            .map_err(|e| AuthorizationError::DatabaseError(e.to_string()))?;

        let mut permissions = HashSet::new();

        // Collect permissions from all roles
        for role_str in &user.roles {
            if let Ok(role) = serde_json::from_str::<Role>(&format!("\"{}\"", role_str)) {
                permissions.extend(role.default_permissions());
            }
        }

        // Add explicit permissions
        for perm_str in &user.permissions {
            if let Some(perm) = Permission::from_str(perm_str) {
                permissions.insert(perm);
            }
        }

        Ok(permissions)
    }

    async fn grant_role(
        &self,
        user_id: &str,
        role: Role,
    ) -> Result<(), AuthorizationError> {
        self.user_repository
            .add_role(user_id, role)
            .await
            .map_err(|e| AuthorizationError::DatabaseError(e.to_string()))?;

        // Invalidate cache
        self.policy_cache.invalidate(user_id).await;

        Ok(())
    }

    async fn revoke_role(
        &self,
        user_id: &str,
        role: Role,
    ) -> Result<(), AuthorizationError> {
        self.user_repository
            .remove_role(user_id, role)
            .await
            .map_err(|e| AuthorizationError::DatabaseError(e.to_string()))?;

        // Invalidate cache
        self.policy_cache.invalidate(user_id).await;

        Ok(())
    }
}
```

---

## ABAC Implementation

### Resource Attributes

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAttributes {
    pub resource_type: ResourceType,
    pub resource_id: String,
    pub owner_id: Option<String>,
    pub tenant_id: Option<String>,
    pub environment: Environment,
    pub sensitivity_level: SensitivityLevel,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Workflow,
    Incident,
    Test,
    Dashboard,
    Alert,
    User,
    ApiKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Environment {
    Production,
    Staging,
    Development,
    Testing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Ord, PartialOrd, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SensitivityLevel {
    Public = 0,
    Internal = 1,
    Confidential = 2,
    Restricted = 3,
}
```

### ABAC Evaluation

```rust
#[derive(Debug, Clone)]
pub struct AbacContext {
    pub subject: AuthorizationContext,
    pub resource: ResourceAttributes,
    pub action: Action,
    pub environment: EnvironmentAttributes,
}

#[derive(Debug, Clone)]
pub struct EnvironmentAttributes {
    pub time: chrono::DateTime<chrono::Utc>,
    pub ip_address: String,
    pub location: Option<String>,
    pub network_zone: NetworkZone,
}

#[derive(Debug, Clone, PartialEq)]
pub enum NetworkZone {
    Internal,
    External,
    Vpn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Read,
    Write,
    Execute,
    Delete,
    Approve,
}

pub struct AbacEngine {
    rules: Vec<AbacRule>,
}

pub struct AbacRule {
    pub name: String,
    pub priority: u32,
    pub condition: Box<dyn AbacCondition>,
    pub effect: Effect,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    Allow,
    Deny,
}

pub trait AbacCondition: Send + Sync {
    fn evaluate(&self, context: &AbacContext) -> bool;
}

impl AbacEngine {
    pub fn new() -> Self {
        Self {
            rules: Self::default_rules(),
        }
    }

    pub fn evaluate(&self, context: &AbacContext) -> Effect {
        // Sort rules by priority (higher first)
        let mut sorted_rules = self.rules.clone();
        sorted_rules.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Evaluate rules in priority order
        for rule in sorted_rules {
            if rule.condition.evaluate(context) {
                return rule.effect;
            }
        }

        // Default deny
        Effect::Deny
    }

    fn default_rules() -> Vec<AbacRule> {
        vec![
            // Rule 1: Owner can access their resources
            AbacRule {
                name: "owner_access".to_string(),
                priority: 100,
                condition: Box::new(OwnerAccessCondition),
                effect: Effect::Allow,
            },
            // Rule 2: Production requires elevated privileges
            AbacRule {
                name: "production_protection".to_string(),
                priority: 90,
                condition: Box::new(ProductionProtectionCondition),
                effect: Effect::Deny,
            },
            // Rule 3: Restricted resources require security admin
            AbacRule {
                name: "restricted_access".to_string(),
                priority: 85,
                condition: Box::new(RestrictedAccessCondition),
                effect: Effect::Deny,
            },
            // Rule 4: External network restrictions
            AbacRule {
                name: "external_network".to_string(),
                priority: 80,
                condition: Box::new(ExternalNetworkCondition),
                effect: Effect::Deny,
            },
        ]
    }
}

// Example ABAC Conditions

struct OwnerAccessCondition;

impl AbacCondition for OwnerAccessCondition {
    fn evaluate(&self, context: &AbacContext) -> bool {
        if let Some(owner_id) = &context.resource.owner_id {
            return owner_id == &context.subject.user_id;
        }
        false
    }
}

struct ProductionProtectionCondition;

impl AbacCondition for ProductionProtectionCondition {
    fn evaluate(&self, context: &AbacContext) -> bool {
        // Deny write/execute/delete actions in production without proper role
        if context.resource.environment == Environment::Production {
            if matches!(
                context.action,
                Action::Write | Action::Execute | Action::Delete
            ) {
                return !context.subject.has_any_role(&[
                    Role::SuperAdmin,
                    Role::Admin,
                    Role::Operator,
                ]);
            }
        }
        false
    }
}

struct RestrictedAccessCondition;

impl AbacCondition for RestrictedAccessCondition {
    fn evaluate(&self, context: &AbacContext) -> bool {
        // Deny access to restricted resources without security admin role
        if context.resource.sensitivity_level == SensitivityLevel::Restricted {
            return !context.subject.has_any_role(&[
                Role::SuperAdmin,
                Role::SecurityAdmin,
            ]);
        }
        false
    }
}

struct ExternalNetworkCondition;

impl AbacCondition for ExternalNetworkCondition {
    fn evaluate(&self, context: &AbacContext) -> bool {
        // Deny external network access to sensitive resources
        if context.environment.network_zone == NetworkZone::External {
            if context.resource.sensitivity_level >= SensitivityLevel::Confidential {
                return true; // Deny
            }
        }
        false
    }
}
```

---

## Policy Engine

### Policy Decision Point (PDP)

```rust
pub struct PolicyDecisionPoint {
    rbac_service: Arc<dyn RbacService>,
    abac_engine: Arc<AbacEngine>,
    custom_policies: Arc<CustomPolicyEngine>,
}

impl PolicyDecisionPoint {
    pub async fn authorize(
        &self,
        context: &AuthorizationContext,
        resource: &ResourceAttributes,
        action: Action,
    ) -> Result<AuthorizationDecision, AuthorizationError> {
        let mut decision = AuthorizationDecision::new();

        // 1. RBAC Check
        let required_permission = self.map_action_to_permission(&resource.resource_type, &action);
        let rbac_allowed = self
            .rbac_service
            .check_permission(context, required_permission)
            .await?;

        decision.add_evaluation("rbac", rbac_allowed);

        if !rbac_allowed {
            decision.set_final_decision(false);
            decision.set_reason("RBAC check failed: insufficient permissions");
            return Ok(decision);
        }

        // 2. ABAC Check
        let abac_context = AbacContext {
            subject: context.clone(),
            resource: resource.clone(),
            action: action.clone(),
            environment: EnvironmentAttributes {
                time: chrono::Utc::now(),
                ip_address: context.ip_address.clone(),
                location: None,
                network_zone: NetworkZone::Internal, // Should be determined from IP
            },
        };

        let abac_effect = self.abac_engine.evaluate(&abac_context);
        let abac_allowed = abac_effect == Effect::Allow || rbac_allowed;

        decision.add_evaluation("abac", abac_allowed);

        if abac_effect == Effect::Deny {
            decision.set_final_decision(false);
            decision.set_reason("ABAC policy denied access");
            return Ok(decision);
        }

        // 3. Custom Policy Check
        let custom_allowed = self
            .custom_policies
            .evaluate(context, resource, &action)
            .await?;

        decision.add_evaluation("custom_policy", custom_allowed);

        if !custom_allowed {
            decision.set_final_decision(false);
            decision.set_reason("Custom policy denied access");
            return Ok(decision);
        }

        // All checks passed
        decision.set_final_decision(true);
        decision.set_reason("Access granted");

        Ok(decision)
    }

    fn map_action_to_permission(
        &self,
        resource_type: &ResourceType,
        action: &Action,
    ) -> Permission {
        match (resource_type, action) {
            (ResourceType::Workflow, Action::Read) => Permission::WorkflowView,
            (ResourceType::Workflow, Action::Write) => Permission::WorkflowCreate,
            (ResourceType::Workflow, Action::Execute) => Permission::WorkflowExecute,
            (ResourceType::Workflow, Action::Delete) => Permission::WorkflowManage,
            (ResourceType::Incident, Action::Read) => Permission::IncidentView,
            (ResourceType::Incident, Action::Write) => Permission::IncidentCreate,
            (ResourceType::Incident, Action::Execute) => Permission::IncidentManage,
            (ResourceType::Test, Action::Read) => Permission::TestView,
            (ResourceType::Test, Action::Execute) => Permission::TestExecute,
            // ... other mappings
            _ => Permission::UserView, // Default fallback
        }
    }
}

#[derive(Debug, Clone)]
pub struct AuthorizationDecision {
    allowed: bool,
    reason: String,
    evaluations: HashMap<String, bool>,
}

impl AuthorizationDecision {
    pub fn new() -> Self {
        Self {
            allowed: false,
            reason: String::new(),
            evaluations: HashMap::new(),
        }
    }

    pub fn add_evaluation(&mut self, name: &str, result: bool) {
        self.evaluations.insert(name.to_string(), result);
    }

    pub fn set_final_decision(&mut self, allowed: bool) {
        self.allowed = allowed;
    }

    pub fn set_reason(&mut self, reason: &str) {
        self.reason = reason.to_string();
    }

    pub fn is_allowed(&self) -> bool {
        self.allowed
    }
}
```

### Custom Policy Engine

```rust
use async_trait::async_trait;

#[async_trait]
pub trait CustomPolicyEngine: Send + Sync {
    async fn evaluate(
        &self,
        context: &AuthorizationContext,
        resource: &ResourceAttributes,
        action: &Action,
    ) -> Result<bool, AuthorizationError>;
}

pub struct DefaultCustomPolicyEngine {
    policies: Vec<Box<dyn CustomPolicy>>,
}

#[async_trait]
pub trait CustomPolicy: Send + Sync {
    async fn evaluate(
        &self,
        context: &AuthorizationContext,
        resource: &ResourceAttributes,
        action: &Action,
    ) -> Result<bool, AuthorizationError>;

    fn name(&self) -> &str;
}

#[async_trait]
impl CustomPolicyEngine for DefaultCustomPolicyEngine {
    async fn evaluate(
        &self,
        context: &AuthorizationContext,
        resource: &ResourceAttributes,
        action: &Action,
    ) -> Result<bool, AuthorizationError> {
        for policy in &self.policies {
            let result = policy.evaluate(context, resource, action).await?;
            if !result {
                return Ok(false);
            }
        }
        Ok(true)
    }
}

// Example Custom Policy: MFA Required for Production

pub struct MfaRequiredForProductionPolicy;

#[async_trait]
impl CustomPolicy for MfaRequiredForProductionPolicy {
    async fn evaluate(
        &self,
        context: &AuthorizationContext,
        resource: &ResourceAttributes,
        action: &Action,
    ) -> Result<bool, AuthorizationError> {
        // Require MFA for write/execute/delete in production
        if resource.environment == Environment::Production {
            if matches!(
                action,
                Action::Write | Action::Execute | Action::Delete
            ) {
                return Ok(context.mfa_verified);
            }
        }
        Ok(true)
    }

    fn name(&self) -> &str {
        "mfa_required_for_production"
    }
}

// Example Custom Policy: Business Hours Only

pub struct BusinessHoursOnlyPolicy;

#[async_trait]
impl CustomPolicy for BusinessHoursOnlyPolicy {
    async fn evaluate(
        &self,
        _context: &AuthorizationContext,
        resource: &ResourceAttributes,
        action: &Action,
    ) -> Result<bool, AuthorizationError> {
        use chrono::{Datelike, Timelike};

        // Restrict production changes to business hours
        if resource.environment == Environment::Production
            && matches!(action, Action::Write | Action::Execute)
        {
            let now = chrono::Utc::now();
            let hour = now.hour();
            let weekday = now.weekday();

            // Monday-Friday, 9am-5pm UTC
            if weekday == chrono::Weekday::Sat || weekday == chrono::Weekday::Sun {
                return Ok(false);
            }
            if hour < 9 || hour >= 17 {
                return Ok(false);
            }
        }

        Ok(true)
    }

    fn name(&self) -> &str {
        "business_hours_only"
    }
}
```

---

## Enforcement Points

### Policy Enforcement Point (PEP) Middleware

```rust
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

pub struct PolicyEnforcementMiddleware {
    pdp: Arc<PolicyDecisionPoint>,
}

impl PolicyEnforcementMiddleware {
    pub async fn enforce(
        State(app_state): State<Arc<AppState>>,
        mut request: Request,
        next: Next,
    ) -> Result<Response, StatusCode> {
        // 1. Extract authorization context from JWT claims
        let auth_context = request
            .extensions()
            .get::<AuthorizationContext>()
            .ok_or(StatusCode::UNAUTHORIZED)?
            .clone();

        // 2. Extract resource attributes from request
        let resource_attrs = extract_resource_attributes(&request)
            .ok_or(StatusCode::BAD_REQUEST)?;

        // 3. Determine action from HTTP method
        let action = match request.method() {
            &axum::http::Method::GET => Action::Read,
            &axum::http::Method::POST => Action::Write,
            &axum::http::Method::PUT => Action::Write,
            &axum::http::Method::DELETE => Action::Delete,
            _ => return Err(StatusCode::METHOD_NOT_ALLOWED),
        };

        // 4. Make authorization decision
        let decision = app_state
            .pdp
            .authorize(&auth_context, &resource_attrs, action)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // 5. Enforce decision
        if !decision.is_allowed() {
            return Err(StatusCode::FORBIDDEN);
        }

        // 6. Audit the authorization decision
        audit_authorization_decision(&auth_context, &resource_attrs, &decision).await;

        Ok(next.run(request).await)
    }
}

fn extract_resource_attributes(request: &Request) -> Option<ResourceAttributes> {
    // Extract from path parameters, headers, or request body
    // This is application-specific
    let uri_path = request.uri().path();

    if uri_path.starts_with("/workflows") {
        Some(ResourceAttributes {
            resource_type: ResourceType::Workflow,
            resource_id: "default".to_string(),
            owner_id: None,
            tenant_id: None,
            environment: Environment::Development,
            sensitivity_level: SensitivityLevel::Internal,
            tags: HashMap::new(),
        })
    } else {
        None
    }
}

async fn audit_authorization_decision(
    context: &AuthorizationContext,
    resource: &ResourceAttributes,
    decision: &AuthorizationDecision,
) {
    // Log to audit system
    tracing::info!(
        user_id = %context.user_id,
        resource_type = ?resource.resource_type,
        resource_id = %resource.resource_id,
        allowed = decision.is_allowed(),
        reason = %decision.reason,
        "Authorization decision"
    );
}
```

### Function-Level Authorization

```rust
/// Macro for declarative authorization
macro_rules! require_permission {
    ($context:expr, $permission:expr) => {
        if !$context.has_permission(&$permission) {
            return Err(AuthorizationError::PermissionDenied);
        }
    };
}

/// Macro for role-based authorization
macro_rules! require_role {
    ($context:expr, $role:expr) => {
        if !$context.has_role(&$role) {
            return Err(AuthorizationError::PermissionDenied);
        }
    };
}

/// Example usage in handler
pub async fn delete_workflow_handler(
    State(app_state): State<Arc<AppState>>,
    context: AuthorizationContext,
    Path(workflow_id): Path<String>,
) -> Result<Json<()>, StatusCode> {
    // Declarative authorization check
    require_permission!(context, Permission::WorkflowManage);

    // Business logic
    app_state
        .workflow_service
        .delete_workflow(&workflow_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(()))
}
```

---

## Complete Authorization Flow Example

```rust
// Main application setup
use axum::{
    middleware,
    Router,
};

pub async fn create_app() -> Router {
    let app_state = Arc::new(AppState::new());

    Router::new()
        .route("/workflows", post(create_workflow_handler))
        .route("/workflows/:id", get(get_workflow_handler))
        .route("/workflows/:id", delete(delete_workflow_handler))
        .route("/workflows/:id/execute", post(execute_workflow_handler))
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_auth_middleware,
        ))
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            PolicyEnforcementMiddleware::enforce,
        ))
        .with_state(app_state)
}

// Handler with fine-grained authorization
pub async fn execute_workflow_handler(
    State(app_state): State<Arc<AppState>>,
    context: AuthorizationContext,
    Path(workflow_id): Path<String>,
) -> Result<Json<WorkflowExecution>, StatusCode> {
    // 1. Load workflow
    let workflow = app_state
        .workflow_repository
        .get_workflow(&workflow_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. Build resource attributes
    let resource_attrs = ResourceAttributes {
        resource_type: ResourceType::Workflow,
        resource_id: workflow_id.clone(),
        owner_id: Some(workflow.created_by.clone()),
        tenant_id: context.tenant_id.clone(),
        environment: workflow.environment.clone(),
        sensitivity_level: SensitivityLevel::Confidential,
        tags: workflow.tags.clone(),
    };

    // 3. Make authorization decision
    let decision = app_state
        .pdp
        .authorize(&context, &resource_attrs, Action::Execute)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !decision.is_allowed() {
        return Err(StatusCode::FORBIDDEN);
    }

    // 4. Execute workflow
    let execution = app_state
        .workflow_service
        .execute_workflow(&workflow_id, &context.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(execution))
}
```

---

## Summary

This authorization architecture provides:

1. **Multi-Layer Authorization**: RBAC + ABAC + Custom Policies
2. **Fine-Grained Control**: Permission-based and attribute-based decisions
3. **Flexible Policy Engine**: Extensible custom policies
4. **Production-Ready**: Environment-aware, MFA-aware, network-aware
5. **Auditable**: All decisions logged and traceable
6. **Type-Safe**: Full Rust type system guarantees

---

**Next Document:** [03-data-protection-architecture.md](./03-data-protection-architecture.md)
