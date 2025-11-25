# ==============================================================================
# Main Terraform Configuration for LLM CoPilot Agent Infrastructure
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket         = "llm-copilot-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "llm-copilot-terraform-locks"
    kms_key_id     = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID"
  }
}

# ==============================================================================
# Provider Configuration
# ==============================================================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "llm-copilot-agent"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "llm-devops-team"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_name
    ]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name
      ]
    }
  }
}

# ==============================================================================
# Local Variables
# ==============================================================================

locals {
  cluster_name = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

# ==============================================================================
# Data Sources
# ==============================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ==============================================================================
# VPC Module
# ==============================================================================

module "vpc" {
  source = "./modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
  azs          = local.azs

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  tags = local.common_tags
}

# ==============================================================================
# EKS Cluster Module
# ==============================================================================

module "eks" {
  source = "./modules/eks"

  cluster_name    = local.cluster_name
  cluster_version = var.kubernetes_version

  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  # Node groups configuration
  node_groups = {
    general = {
      desired_capacity = var.node_group_desired_capacity
      min_capacity     = var.node_group_min_capacity
      max_capacity     = var.node_group_max_capacity

      instance_types = ["t3.large", "t3a.large"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "general"
      }

      taints = []

      tags = {
        NodeGroup = "general"
      }
    }

    compute = {
      desired_capacity = 2
      min_capacity     = 1
      max_capacity     = 10

      instance_types = ["c6i.2xlarge", "c6a.2xlarge"]
      capacity_type  = var.environment == "production" ? "ON_DEMAND" : "SPOT"

      labels = {
        role = "compute-intensive"
      }

      taints = [{
        key    = "workload"
        value  = "compute"
        effect = "NoSchedule"
      }]

      tags = {
        NodeGroup = "compute"
      }
    }
  }

  # OIDC provider for IRSA
  enable_irsa = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  tags = local.common_tags
}

# ==============================================================================
# RDS (PostgreSQL) Module
# ==============================================================================

module "rds" {
  source = "./modules/rds"

  identifier     = "${local.cluster_name}-postgres"
  engine_version = "15.4"

  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  storage_encrypted = true
  storage_type      = "gp3"

  database_name = "llm_copilot"
  username      = "llm_user"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.database_subnets

  # High Availability
  multi_az               = var.environment == "production"
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  # Performance Insights
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  performance_insights_retention_period = 7

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Deletion protection
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  tags = local.common_tags
}

# ==============================================================================
# ElastiCache (Redis) Module
# ==============================================================================

module "elasticache" {
  source = "./modules/elasticache"

  cluster_id      = "${local.cluster_name}-redis"
  engine_version  = "7.0"
  node_type       = var.redis_node_type
  num_cache_nodes = var.environment == "production" ? 3 : 2

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.elasticache_subnets

  # High Availability
  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled          = var.environment == "production"

  # Backup
  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "mon:05:00-mon:07:00"

  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true

  # Parameters
  parameter_group_family = "redis7"
  parameters = [
    {
      name  = "maxmemory-policy"
      value = "allkeys-lru"
    }
  ]

  tags = local.common_tags
}

# ==============================================================================
# S3 Buckets
# ==============================================================================

module "s3_backups" {
  source = "./modules/s3"

  bucket_name = "${local.cluster_name}-backups"

  versioning_enabled = true

  lifecycle_rules = [
    {
      id      = "expire-old-backups"
      enabled = true

      expiration = {
        days = 90
      }

      noncurrent_version_expiration = {
        days = 30
      }
    }
  ]

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = aws_kms_key.backups.id
      }
    }
  }

  tags = local.common_tags
}

# ==============================================================================
# KMS Keys
# ==============================================================================

resource "aws_kms_key" "backups" {
  description             = "KMS key for ${local.cluster_name} backups"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-backups-key"
  })
}

resource "aws_kms_alias" "backups" {
  name          = "alias/${local.cluster_name}-backups"
  target_key_id = aws_kms_key.backups.key_id
}

# ==============================================================================
# IAM Roles for Service Accounts (IRSA)
# ==============================================================================

module "irsa_llm_copilot_agent" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name = "${local.cluster_name}-llm-copilot-agent"

  role_policy_arns = {
    policy = aws_iam_policy.llm_copilot_agent.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["llm-copilot:llm-copilot-agent"]
    }
  }

  tags = local.common_tags
}

resource "aws_iam_policy" "llm_copilot_agent" {
  name        = "${local.cluster_name}-llm-copilot-agent-policy"
  description = "IAM policy for LLM CoPilot Agent"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          module.s3_backups.bucket_arn,
          "${module.s3_backups.bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:llm-copilot/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = [
          aws_kms_key.backups.arn
        ]
      }
    ]
  })

  tags = local.common_tags
}

# ==============================================================================
# Outputs
# ==============================================================================

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.primary_endpoint_address
  sensitive   = true
}

output "backup_bucket" {
  description = "S3 backup bucket name"
  value       = module.s3_backups.bucket_id
}
