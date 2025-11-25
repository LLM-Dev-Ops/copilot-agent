# ==============================================================================
# Production Environment Variables
# ==============================================================================

project_name = "llm-copilot"
environment  = "production"
aws_region   = "us-east-1"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"

# EKS Configuration
kubernetes_version           = "1.28"
node_group_desired_capacity = 5
node_group_min_capacity     = 3
node_group_max_capacity     = 20

# RDS Configuration
rds_instance_class    = "db.r6g.xlarge"
rds_allocated_storage = 200

# ElastiCache Configuration
redis_node_type = "cache.r6g.xlarge"

# Monitoring
enable_monitoring              = true
cloudwatch_log_retention_days = 90

# Backup
backup_retention_period = 30

# Tags
tags = {
  Environment = "production"
  CostCenter  = "engineering"
  Compliance  = "soc2"
  DataClass   = "confidential"
}
