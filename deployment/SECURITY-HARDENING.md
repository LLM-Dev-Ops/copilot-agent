# LLM-CoPilot-Agent Security Hardening Guide

**Version:** 1.0.0
**Date:** 2025-11-25
**Status:** Production-Ready
**Compliance:** SOC 2 Type II, GDPR, HIPAA-Ready

## Executive Summary

This document provides comprehensive security hardening measures for production deployment of LLM-CoPilot-Agent, ensuring compliance with SOC 2 Type II and GDPR requirements while maintaining zero security incidents.

### Security Objectives

- Zero unauthorized access incidents
- 100% audit trail coverage for critical operations
- SOC 2 Type II and GDPR compliance
- TLS 1.3 and AES-256 encryption for all data
- OAuth 2.0 with PKCE and JWT authentication
- Defense in depth with multiple security layers
- Proactive threat detection and response

---

## 1. Network Security

### 1.1 TLS Configuration

#### Minimum TLS Version
```yaml
# Enforce TLS 1.3 minimum across all services
minTLSVersion: "1.3"
```

#### Approved Cipher Suites (TLS 1.3)
```yaml
cipherSuites:
  # TLS 1.3 cipher suites (preferred)
  - TLS_AES_256_GCM_SHA384
  - TLS_CHACHA20_POLY1305_SHA256
  - TLS_AES_128_GCM_SHA256

  # TLS 1.2 fallback (only if required for compatibility)
  - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
  - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
```

#### TLS Configuration (NGINX Ingress)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ingress-nginx-controller
  namespace: ingress-nginx
data:
  ssl-protocols: "TLSv1.3"
  ssl-ciphers: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256"
  ssl-prefer-server-ciphers: "on"
  ssl-session-cache: "shared:SSL:10m"
  ssl-session-timeout: "10m"
  ssl-session-tickets: "off"
  hsts: "true"
  hsts-max-age: "31536000"
  hsts-include-subdomains: "true"
  hsts-preload: "true"
```

#### Certificate Management
```yaml
# Use cert-manager for automatic certificate management
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: llm-copilot-tls
  namespace: llm-copilot
spec:
  secretName: llm-copilot-tls
  issuer: letsencrypt-prod
  dnsNames:
    - api.llm-copilot.com
    - "*.llm-copilot.com"
  privateKey:
    algorithm: RSA
    size: 4096
  duration: 2160h  # 90 days
  renewBefore: 360h  # 15 days before expiry
```

### 1.2 Network Policies

#### Default Deny All
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: llm-copilot
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

#### Allow Ingress from Load Balancer Only
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-ingress
  namespace: llm-copilot
spec:
  podSelector:
    matchLabels:
      app: llm-copilot-agent
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8080
```

#### Allow Database Access
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-database-egress
  namespace: llm-copilot
spec:
  podSelector:
    matchLabels:
      app: llm-copilot-agent
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: database
        - podSelector:
            matchLabels:
              app: postgresql
      ports:
        - protocol: TCP
          port: 5432
```

#### Allow Redis Access
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-redis-egress
  namespace: llm-copilot
spec:
  podSelector:
    matchLabels:
      app: llm-copilot-agent
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: redis
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
```

#### Allow DNS Resolution
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: llm-copilot
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

#### Allow Prometheus Scraping
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scraping
  namespace: llm-copilot
spec:
  podSelector:
    matchLabels:
      app: llm-copilot-agent
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
        - podSelector:
            matchLabels:
              app: prometheus
      ports:
        - protocol: TCP
          port: 9090
```

#### Allow External API Calls (Restricted)
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-apis
  namespace: llm-copilot
spec:
  podSelector:
    matchLabels:
      app: llm-copilot-agent
  policyTypes:
    - Egress
  egress:
    # Allow HTTPS to approved external APIs only
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443
    # Block by default, use service mesh for fine-grained control
```

### 1.3 Service Mesh mTLS (Istio)

#### Peer Authentication (Strict mTLS)
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-strict-mtls
  namespace: llm-copilot
spec:
  mtls:
    mode: STRICT  # Require mTLS for all traffic
```

#### Authorization Policy (Default Deny)
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: llm-copilot
spec:
  {}  # Empty spec = deny all
```

#### Allow Ingress Traffic
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-ingress
  namespace: llm-copilot
spec:
  selector:
    matchLabels:
      app: llm-copilot-agent
  action: ALLOW
  rules:
    - from:
        - source:
            namespaces: ["ingress-nginx"]
      to:
        - operation:
            methods: ["GET", "POST", "PUT", "DELETE"]
            paths: ["/api/*", "/health", "/metrics"]
```

#### Allow Inter-Service Communication
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-inter-service
  namespace: llm-copilot
spec:
  selector:
    matchLabels:
      app: llm-copilot-agent
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/llm-copilot/sa/llm-test-bench"
              - "cluster.local/ns/llm-copilot/sa/llm-observatory"
              - "cluster.local/ns/llm-copilot/sa/llm-incident-manager"
              - "cluster.local/ns/llm-copilot/sa/llm-orchestrator"
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/internal/*"]
```

### 1.4 DDoS Protection

#### Rate Limiting (NGINX Ingress)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ingress-nginx-controller
  namespace: ingress-nginx
data:
  # Global rate limits
  limit-req-zone: "$binary_remote_addr zone=global:10m rate=100r/s"
  limit-req-status-code: "429"
  limit-conn-zone: "$binary_remote_addr zone=addr:10m"

  # Per-path rate limits
  limit-rps: "100"  # 100 requests per second per IP
  limit-burst: "200"  # Allow burst of 200
  limit-connections: "20"  # Max 20 concurrent connections per IP
```

#### Rate Limiting (Istio)
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: rate-limit-filter
  namespace: llm-copilot
spec:
  workloadSelector:
    labels:
      app: llm-copilot-agent
  configPatches:
    - applyTo: HTTP_FILTER
      match:
        context: SIDECAR_INBOUND
        listener:
          filterChain:
            filter:
              name: "envoy.filters.network.http_connection_manager"
      patch:
        operation: INSERT_BEFORE
        value:
          name: envoy.filters.http.local_ratelimit
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
            stat_prefix: http_local_rate_limiter
            token_bucket:
              max_tokens: 1000
              tokens_per_fill: 100
              fill_interval: 1s
```

#### AWS Shield and WAF Integration
```yaml
# Terraform configuration for AWS Shield and WAF
resource "aws_wafv2_web_acl" "llm_copilot_waf" {
  name  = "llm-copilot-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate-based rule
  rule {
    name     = "rate-limit-rule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules
  rule {
    name     = "aws-managed-rules"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRules"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "sql-injection-rule"
    priority = 3

    action {
      block {}
    }

    statement {
      sqli_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLInjectionRule"
      sampled_requests_enabled   = true
    }
  }

  # XSS protection
  rule {
    name     = "xss-rule"
    priority = 4

    action {
      block {}
    }

    statement {
      xss_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "XSSRule"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "LLMCoPilotWAF"
    sampled_requests_enabled   = true
  }
}

# AWS Shield Advanced (optional for DDoS protection)
resource "aws_shield_protection" "llm_copilot_alb" {
  name         = "llm-copilot-alb-protection"
  resource_arn = aws_lb.main.arn
}
```

### 1.5 WAF Rules

#### ModSecurity Core Rule Set (NGINX)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: modsecurity-config
  namespace: ingress-nginx
data:
  enable-modsecurity: "true"
  enable-owasp-modsecurity-crs: "true"
  modsecurity-snippet: |
    SecRuleEngine On
    SecAuditEngine RelevantOnly
    SecAuditLog /var/log/modsec_audit.log

    # OWASP CRS 3.3.0 rules
    Include /etc/nginx/owasp-modsecurity-crs/crs-setup.conf
    Include /etc/nginx/owasp-modsecurity-crs/rules/*.conf

    # Custom rules for LLM-specific attacks
    SecRule REQUEST_BODY "@rx (?i)(ignore\s+previous\s+instructions|disregard\s+system\s+prompt)" \
      "id:1000001,\
      phase:2,\
      deny,\
      status:403,\
      msg:'Prompt injection attempt detected'"

    # Block common SQL injection patterns
    SecRule ARGS "@detectSQLi" \
      "id:1000002,\
      phase:2,\
      deny,\
      status:403,\
      msg:'SQL injection attempt'"

    # Block XSS attempts
    SecRule ARGS "@detectXSS" \
      "id:1000003,\
      phase:2,\
      deny,\
      status:403,\
      msg:'XSS attempt detected'"
```

---

## 2. Application Security

### 2.1 Input Sanitization Checklist

#### Request Validation Middleware
```typescript
// middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

export class InputValidator {

  // Sanitize all string inputs
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove null bytes
    input = input.replace(/\0/g, '');

    // Remove control characters
    input = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Trim whitespace
    input = input.trim();

    // HTML escape
    input = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    return input;
  }

  // Validate and sanitize email
  static sanitizeEmail(email: string): string | null {
    if (!validator.isEmail(email)) {
      return null;
    }
    return validator.normalizeEmail(email) || null;
  }

  // Validate URL
  static validateURL(url: string): boolean {
    return validator.isURL(url, {
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_query_components: true,
      disallow_auth: true
    });
  }

  // Sanitize JSON input
  static sanitizeJSON(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return null;
    }

    const sanitized: any = Array.isArray(data) ? [] : {};

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const sanitizedKey = this.sanitizeString(key);
        const value = data[key];

        if (typeof value === 'string') {
          sanitized[sanitizedKey] = this.sanitizeString(value);
        } else if (typeof value === 'object') {
          sanitized[sanitizedKey] = this.sanitizeJSON(value);
        } else {
          sanitized[sanitizedKey] = value;
        }
      }
    }

    return sanitized;
  }

  // Validate LLM prompt input (prevent injection)
  static validateLLMPrompt(prompt: string): boolean {
    const dangerousPatterns = [
      /ignore\s+(previous|all|above)\s+instructions/i,
      /disregard\s+(system|previous)\s+prompt/i,
      /new\s+instructions:/i,
      /you\s+are\s+now/i,
      /system\s+mode/i,
      /developer\s+mode/i,
      /jailbreak/i,
      /<\|im_start\|>/i,
      /<\|im_end\|>/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(prompt));
  }

  // Middleware for request validation
  static validateRequest(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate Content-Type
      const contentType = req.get('Content-Type') || '';
      if (req.method !== 'GET' && !contentType.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid Content-Type' });
      }

      // Validate request body size (already handled by body-parser limit)

      // Sanitize query parameters
      if (req.query) {
        for (const key in req.query) {
          if (typeof req.query[key] === 'string') {
            req.query[key] = InputValidator.sanitizeString(req.query[key] as string);
          }
        }
      }

      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = InputValidator.sanitizeJSON(req.body);
      }

      next();
    } catch (error) {
      res.status(400).json({ error: 'Invalid input' });
    }
  }
}
```

#### Input Validation Schema (Joi)
```typescript
// schemas/validation.ts
import Joi from 'joi';

export const schemas = {
  // User registration
  userRegistration: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string()
      .min(12)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character'
      }),
    name: Joi.string().min(1).max(100).required(),
    organizationId: Joi.string().uuid().optional()
  }),

  // LLM query
  llmQuery: Joi.object({
    prompt: Joi.string().min(1).max(10000).required(),
    context: Joi.object().optional(),
    maxTokens: Joi.number().integer().min(1).max(4096).default(1024),
    temperature: Joi.number().min(0).max(2).default(0.7)
  }),

  // API request
  apiRequest: Joi.object({
    method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').required(),
    endpoint: Joi.string().uri({ relativeOnly: true }).required(),
    headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    body: Joi.any().optional()
  })
};
```

### 2.2 Output Encoding Rules

#### Response Encoding Middleware
```typescript
// middleware/encoding.ts
import { Response } from 'express';

export class OutputEncoder {

  // HTML encode output
  static htmlEncode(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // JSON encode with safe defaults
  static jsonEncode(data: any): string {
    return JSON.stringify(data, (key, value) => {
      // Remove sensitive fields
      if (['password', 'token', 'secret', 'apiKey'].includes(key)) {
        return undefined;
      }

      // Encode strings
      if (typeof value === 'string') {
        return this.htmlEncode(value);
      }

      return value;
    });
  }

  // Redact PII from logs
  static redactPII(text: string): string {
    // Email
    text = text.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL_REDACTED]');

    // Phone numbers
    text = text.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE_REDACTED]');

    // SSN
    text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');

    // Credit cards
    text = text.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_REDACTED]');

    // IP addresses
    text = text.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');

    return text;
  }

  // Sanitize error messages (prevent information disclosure)
  static sanitizeError(error: Error): { message: string; code?: string } {
    const genericMessage = 'An error occurred processing your request';

    // Never expose stack traces in production
    if (process.env.NODE_ENV === 'production') {
      return {
        message: genericMessage,
        code: 'INTERNAL_ERROR'
      };
    }

    // In development, return sanitized error
    return {
      message: this.redactPII(error.message),
      code: (error as any).code || 'INTERNAL_ERROR'
    };
  }
}

// Response wrapper
export function secureResponse(res: Response) {
  return {
    json: (data: any) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(OutputEncoder.jsonEncode(data));
    },
    error: (error: Error, statusCode: number = 500) => {
      res.status(statusCode).json(OutputEncoder.sanitizeError(error));
    }
  };
}
```

### 2.3 CORS Configuration

```typescript
// config/cors.ts
import cors from 'cors';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://app.llm-copilot.com',
      'https://dashboard.llm-copilot.com'
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204
};
```

### 2.4 Security Headers

```typescript
// middleware/security-headers.ts
import helmet from 'helmet';
import { Application } from 'express';

export function configureSecurityHeaders(app: Application) {

  // Use Helmet for basic security headers
  app.use(helmet({

    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        connectSrc: ["'self'", "https://api.llm-copilot.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: []
      }
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },

    // Hide X-Powered-By
    hidePoweredBy: true,

    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },

    // Permissions Policy
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        microphone: ["'none'"],
        camera: ["'none'"],
        payment: ["'none'"],
        usb: ["'none'"],
        magnetometer: ["'none'"],
        gyroscope: ["'none'"],
        accelerometer: ["'none'"]
      }
    }
  }));

  // Additional custom headers
  app.use((req, res, next) => {
    // X-Request-ID for request tracking
    res.setHeader('X-Request-ID', req.id || generateRequestId());

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Cache-Control for sensitive endpoints
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Remove Server header
    res.removeHeader('Server');

    next();
  });
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### 2.5 Dependency Scanning

#### npm audit configuration
```json
{
  "scripts": {
    "audit": "npm audit --production --audit-level=moderate",
    "audit:fix": "npm audit fix --production",
    "audit:report": "npm audit --json > audit-report.json"
  },
  "auditConfig": {
    "ignore": [],
    "thresholds": {
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0
    }
  }
}
```

#### Snyk Integration (GitHub Actions)
```yaml
# .github/workflows/security-scan.yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all

      - name: Upload Snyk report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: snyk-report
          path: snyk-report.json
```

#### Dependabot configuration
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    commit-message:
      prefix: "security"
      include: "scope"
    # Auto-merge patch updates
    automerged_updates:
      - match:
          dependency_type: "all"
          update_type: "security:patch"
```

---

## 3. Authentication Hardening

### 3.1 Password Policies

```typescript
// services/auth/password-policy.ts
import * as zxcvbn from 'zxcvbn';
import * as bcrypt from 'bcrypt';

export class PasswordPolicy {
  private static readonly MIN_LENGTH = 12;
  private static readonly MAX_LENGTH = 128;
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_STRENGTH_SCORE = 3; // zxcvbn score (0-4)

  // Common passwords list (top 10000)
  private static readonly COMMON_PASSWORDS_FILE = '/etc/security/common-passwords.txt';

  // Password requirements
  static readonly REQUIREMENTS = {
    minLength: this.MIN_LENGTH,
    maxLength: this.MAX_LENGTH,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    minStrengthScore: this.MIN_STRENGTH_SCORE,
    preventCommonPasswords: true,
    preventUserInfo: true
  };

  // Validate password strength
  static validate(
    password: string,
    userInfo?: { email?: string; name?: string; username?: string }
  ): { valid: boolean; errors: string[]; score: number } {
    const errors: string[] = [];

    // Length check
    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters`);
    }
    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_LENGTH} characters`);
    }

    // Character requirements
    if (this.REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (this.REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (this.REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (this.REQUIREMENTS.requireSpecialChars && !/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    // Strength check with zxcvbn
    const strengthResult = zxcvbn(password, [
      userInfo?.email,
      userInfo?.name,
      userInfo?.username
    ].filter(Boolean) as string[]);

    if (strengthResult.score < this.MIN_STRENGTH_SCORE) {
      errors.push(`Password is too weak. ${strengthResult.feedback.warning || ''}`);
      if (strengthResult.feedback.suggestions.length > 0) {
        errors.push(...strengthResult.feedback.suggestions);
      }
    }

    // Check against common passwords
    // (In production, load from file or database)

    return {
      valid: errors.length === 0,
      errors,
      score: strengthResult.score
    };
  }

  // Hash password
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verify password
  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Check if password needs rehashing (e.g., after SALT_ROUNDS increase)
  static needsRehash(hash: string): boolean {
    const rounds = bcrypt.getRounds(hash);
    return rounds < this.SALT_ROUNDS;
  }
}

// Password expiration policy
export class PasswordExpirationPolicy {
  private static readonly EXPIRATION_DAYS = 90;
  private static readonly WARNING_DAYS = 14;
  private static readonly PASSWORD_HISTORY_COUNT = 5;

  static isExpired(lastChangedAt: Date): boolean {
    const expirationDate = new Date(lastChangedAt);
    expirationDate.setDate(expirationDate.getDate() + this.EXPIRATION_DAYS);
    return new Date() > expirationDate;
  }

  static daysUntilExpiration(lastChangedAt: Date): number {
    const expirationDate = new Date(lastChangedAt);
    expirationDate.setDate(expirationDate.getDate() + this.EXPIRATION_DAYS);
    const diff = expirationDate.getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  static shouldWarn(lastChangedAt: Date): boolean {
    return this.daysUntilExpiration(lastChangedAt) <= this.WARNING_DAYS;
  }

  static async isInHistory(
    userId: string,
    newPassword: string,
    getPasswordHistory: (userId: string, count: number) => Promise<string[]>
  ): Promise<boolean> {
    const history = await getPasswordHistory(userId, this.PASSWORD_HISTORY_COUNT);

    for (const oldHash of history) {
      if (await PasswordPolicy.verify(newPassword, oldHash)) {
        return true;
      }
    }

    return false;
  }
}
```

### 3.2 MFA Implementation

```typescript
// services/auth/mfa.ts
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export class MFAService {

  // Generate TOTP secret
  static generateSecret(user: { email: string }): {
    secret: string;
    otpauthUrl: string;
    backupCodes: string[];
  } {
    const secret = speakeasy.generateSecret({
      name: `LLM-CoPilot-Agent (${user.email})`,
      issuer: 'LLM-CoPilot-Agent',
      length: 32
    });

    const backupCodes = this.generateBackupCodes(8);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
      backupCodes
    };
  }

  // Generate QR code
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  // Verify TOTP token
  static verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 windows (60 seconds) for time drift
    });
  }

  // Generate backup codes
  static generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateRandomCode(8));
    }
    return codes;
  }

  private static generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Verify backup code
  static async verifyBackupCode(
    userId: string,
    code: string,
    getBackupCodes: (userId: string) => Promise<string[]>,
    removeBackupCode: (userId: string, code: string) => Promise<void>
  ): Promise<boolean> {
    const codes = await getBackupCodes(userId);
    const hashedCodes = codes.map(c => this.hashBackupCode(c));
    const hashedInput = this.hashBackupCode(code);

    if (hashedCodes.includes(hashedInput)) {
      await removeBackupCode(userId, code);
      return true;
    }

    return false;
  }

  private static hashBackupCode(code: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
```

#### MFA Enforcement Policy
```yaml
# config/mfa-policy.yaml
mfaPolicy:
  # Enforce MFA for all users
  enforceForAll: true

  # Grace period before enforcement (days)
  gracePeriod: 30

  # Roles that require MFA
  requiredRoles:
    - admin
    - developer
    - operator

  # IP addresses exempt from MFA (internal network)
  exemptIPs: []

  # Remember device for N days
  rememberDevice: true
  rememberDeviceDays: 30

  # Trusted device cookie settings
  trustedDeviceCookie:
    httpOnly: true
    secure: true
    sameSite: "strict"
    maxAge: 2592000  # 30 days in seconds
```

### 3.3 Session Management

```typescript
// services/auth/session.ts
import { createClient } from 'redis';
import * as crypto from 'crypto';

export class SessionManager {
  private redis: ReturnType<typeof createClient>;

  // Session configuration
  private static readonly SESSION_TTL = 3600; // 1 hour
  private static readonly REFRESH_TOKEN_TTL = 604800; // 7 days
  private static readonly MAX_SESSIONS_PER_USER = 5;
  private static readonly SESSION_ID_LENGTH = 32;

  constructor(redisClient: ReturnType<typeof createClient>) {
    this.redis = redisClient;
  }

  // Create new session
  async createSession(userId: string, metadata: {
    ipAddress: string;
    userAgent: string;
    deviceId?: string;
  }): Promise<{ sessionId: string; refreshToken: string }> {
    const sessionId = this.generateSessionId();
    const refreshToken = this.generateRefreshToken();

    const session = {
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      deviceId: metadata.deviceId,
      refreshToken: await this.hashToken(refreshToken)
    };

    // Store session
    await this.redis.setEx(
      `session:${sessionId}`,
      SessionManager.SESSION_TTL,
      JSON.stringify(session)
    );

    // Add to user's session list
    await this.redis.sAdd(`user:sessions:${userId}`, sessionId);

    // Enforce max sessions per user
    await this.enforceMaxSessions(userId);

    return { sessionId, refreshToken };
  }

  // Get session
  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    if (!data) return null;

    const session = JSON.parse(data);

    // Update last activity
    session.lastActivity = Date.now();
    await this.redis.setEx(
      `session:${sessionId}`,
      SessionManager.SESSION_TTL,
      JSON.stringify(session)
    );

    return session;
  }

  // Validate session
  async validateSession(sessionId: string, ipAddress: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // Check IP address (optional, can be disabled for mobile)
    if (process.env.VALIDATE_SESSION_IP === 'true' && session.ipAddress !== ipAddress) {
      await this.revokeSession(sessionId);
      return false;
    }

    // Check inactivity timeout
    const inactivityTimeout = 1800000; // 30 minutes in milliseconds
    if (Date.now() - session.lastActivity > inactivityTimeout) {
      await this.revokeSession(sessionId);
      return false;
    }

    return true;
  }

  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.redis.sRem(`user:sessions:${session.userId}`, sessionId);
    }
    await this.redis.del(`session:${sessionId}`);
  }

  // Revoke all user sessions
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.sMembers(`user:sessions:${userId}`);
    for (const sessionId of sessionIds) {
      await this.redis.del(`session:${sessionId}`);
    }
    await this.redis.del(`user:sessions:${userId}`);
  }

  // Refresh token
  async refreshSession(sessionId: string, refreshToken: string): Promise<string | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const isValidToken = await this.verifyToken(refreshToken, session.refreshToken);
    if (!isValidToken) return null;

    // Generate new session ID
    const newSessionId = this.generateSessionId();

    // Update session
    session.lastActivity = Date.now();
    await this.redis.setEx(
      `session:${newSessionId}`,
      SessionManager.SESSION_TTL,
      JSON.stringify(session)
    );

    // Update user's session list
    await this.redis.sRem(`user:sessions:${session.userId}`, sessionId);
    await this.redis.sAdd(`user:sessions:${session.userId}`, newSessionId);

    // Delete old session
    await this.redis.del(`session:${sessionId}`);

    return newSessionId;
  }

  // Enforce max sessions per user
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.sMembers(`user:sessions:${userId}`);

    if (sessionIds.length > SessionManager.MAX_SESSIONS_PER_USER) {
      // Get all sessions with timestamps
      const sessions = await Promise.all(
        sessionIds.map(async (id) => {
          const data = await this.redis.get(`session:${id}`);
          return data ? { id, ...JSON.parse(data) } : null;
        })
      );

      // Sort by last activity (oldest first)
      const sortedSessions = sessions
        .filter(s => s !== null)
        .sort((a, b) => a!.lastActivity - b!.lastActivity);

      // Remove oldest sessions
      const toRemove = sortedSessions.length - SessionManager.MAX_SESSIONS_PER_USER;
      for (let i = 0; i < toRemove; i++) {
        await this.revokeSession(sortedSessions[i]!.id);
      }
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(SessionManager.SESSION_ID_LENGTH).toString('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async verifyToken(token: string, hash: string): Promise<boolean> {
    const tokenHash = await this.hashToken(token);
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash),
      Buffer.from(hash)
    );
  }
}
```

### 3.4 Token Security (JWT)

```typescript
// services/auth/jwt.ts
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

export class JWTService {
  private privateKey: string;
  private publicKey: string;

  // JWT configuration
  private static readonly ALGORITHM = 'RS256'; // RSA with SHA-256
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
  private static readonly ISSUER = 'llm-copilot-agent';
  private static readonly AUDIENCE = 'llm-copilot-api';

  constructor() {
    // Load RSA keys from files (mounted as secrets in production)
    this.privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH || '/secrets/jwt-private.pem', 'utf8');
    this.publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH || '/secrets/jwt-public.pem', 'utf8');
  }

  // Generate access token
  generateAccessToken(payload: {
    userId: string;
    email: string;
    roles: string[];
    organizationId?: string;
  }): string {
    return jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        roles: payload.roles,
        organizationId: payload.organizationId,
        type: 'access'
      },
      this.privateKey,
      {
        algorithm: JWTService.ALGORITHM,
        expiresIn: JWTService.ACCESS_TOKEN_EXPIRY,
        issuer: JWTService.ISSUER,
        audience: JWTService.AUDIENCE,
        jwtid: this.generateJTI()
      }
    );
  }

  // Generate refresh token
  generateRefreshToken(payload: {
    userId: string;
    sessionId: string;
  }): string {
    return jwt.sign(
      {
        sub: payload.userId,
        sessionId: payload.sessionId,
        type: 'refresh'
      },
      this.privateKey,
      {
        algorithm: JWTService.ALGORITHM,
        expiresIn: JWTService.REFRESH_TOKEN_EXPIRY,
        issuer: JWTService.ISSUER,
        audience: JWTService.AUDIENCE,
        jwtid: this.generateJTI()
      }
    );
  }

  // Verify token
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: [JWTService.ALGORITHM],
        issuer: JWTService.ISSUER,
        audience: JWTService.AUDIENCE
      });
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  // Decode token without verification (for debugging)
  decodeToken(token: string): any {
    return jwt.decode(token, { complete: true });
  }

  // Check if token is expired
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload.exp) return true;
      return Date.now() >= decoded.payload.exp * 1000;
    } catch {
      return true;
    }
  }

  // Generate unique JWT ID
  private generateJTI(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Token revocation list (using Redis)
export class TokenRevocationList {
  private redis: any;

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  // Add token to revocation list
  async revokeToken(jti: string, expiresAt: number): Promise<void> {
    const ttl = Math.floor((expiresAt * 1000 - Date.now()) / 1000);
    if (ttl > 0) {
      await this.redis.setEx(`revoked:${jti}`, ttl, '1');
    }
  }

  // Check if token is revoked
  async isTokenRevoked(jti: string): Promise<boolean> {
    const result = await this.redis.get(`revoked:${jti}`);
    return result !== null;
  }
}
```

### 3.5 Brute Force Protection

```typescript
// middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Login rate limiter
export const loginRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:login:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // Rate limit by IP and username
    return `${req.ip}:${req.body.username || 'unknown'}`;
  }
});

// Password reset rate limiter
export const passwordResetRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:reset:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts. Please try again later.',
  keyGenerator: (req) => req.body.email || req.ip
});

// API rate limiter
export const apiRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests. Please slow down.',
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?.id || req.ip;
  }
});

// Account lockout mechanism
export class AccountLockout {
  private redis: any;
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 30 * 60; // 30 minutes in seconds

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  // Record failed login attempt
  async recordFailedAttempt(identifier: string): Promise<{ locked: boolean; remainingAttempts: number }> {
    const key = `lockout:${identifier}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      // Set expiry on first attempt
      await this.redis.expire(key, AccountLockout.LOCKOUT_DURATION);
    }

    if (attempts >= AccountLockout.MAX_FAILED_ATTEMPTS) {
      // Lock account
      await this.redis.setEx(
        `locked:${identifier}`,
        AccountLockout.LOCKOUT_DURATION,
        '1'
      );
      return { locked: true, remainingAttempts: 0 };
    }

    return {
      locked: false,
      remainingAttempts: AccountLockout.MAX_FAILED_ATTEMPTS - attempts
    };
  }

  // Check if account is locked
  async isLocked(identifier: string): Promise<boolean> {
    const locked = await this.redis.get(`locked:${identifier}`);
    return locked !== null;
  }

  // Reset failed attempts (after successful login)
  async resetAttempts(identifier: string): Promise<void> {
    await this.redis.del(`lockout:${identifier}`);
    await this.redis.del(`locked:${identifier}`);
  }

  // Get time until unlock
  async getTimeUntilUnlock(identifier: string): Promise<number> {
    const ttl = await this.redis.ttl(`locked:${identifier}`);
    return ttl > 0 ? ttl : 0;
  }
}
```

---

## 4. Authorization Hardening

### 4.1 Principle of Least Privilege

#### Role-Based Access Control (RBAC) Definition
```yaml
# config/rbac.yaml
roles:

  # Guest - Unauthenticated users
  guest:
    description: "Unauthenticated users with minimal access"
    permissions:
      - "auth:login"
      - "auth:register"
      - "auth:reset-password"
      - "health:check"
    resources: []

  # User - Standard authenticated user
  user:
    description: "Standard authenticated user"
    inherits: []
    permissions:
      - "profile:read:own"
      - "profile:update:own"
      - "query:execute:own"
      - "dashboard:read:own"
      - "test:read:own"
      - "test:create:own"
      - "incident:read:own"
      - "workflow:read:own"
      - "workflow:execute:own"
    resources:
      - "user/*"
    quotas:
      maxQueriesPerHour: 100
      maxTestsPerDay: 50
      maxWorkflowExecutionsPerDay: 10

  # Developer - Application developer
  developer:
    description: "Application developer with code and test access"
    inherits: ["user"]
    permissions:
      - "test:create:team"
      - "test:update:team"
      - "test:delete:team"
      - "test:execute:team"
      - "repository:read:team"
      - "repository:webhook:manage"
      - "dashboard:create:team"
      - "dashboard:update:team"
      - "workflow:create:team"
      - "workflow:update:team"
      - "incident:create:team"
      - "incident:update:team"
    resources:
      - "team/*"
      - "repository/*"
    quotas:
      maxQueriesPerHour: 500
      maxTestsPerDay: 200
      maxWorkflowExecutionsPerDay: 50

  # Operator - Operations/SRE team member
  operator:
    description: "Operations engineer with deployment and monitoring access"
    inherits: ["developer"]
    permissions:
      - "deployment:read:all"
      - "deployment:create:team"
      - "deployment:rollback:team"
      - "observability:read:all"
      - "observability:query:all"
      - "incident:manage:team"
      - "incident:escalate:team"
      - "runbook:execute:team"
      - "alert:create:team"
      - "alert:update:team"
      - "alert:delete:team"
    resources:
      - "deployment/*"
      - "observability/*"
      - "incident/*"
    quotas:
      maxQueriesPerHour: 1000
      maxWorkflowExecutionsPerDay: 100

  # Admin - Team/Organization administrator
  admin:
    description: "Organization administrator with full team management"
    inherits: ["operator"]
    permissions:
      - "user:read:org"
      - "user:create:org"
      - "user:update:org"
      - "user:delete:org"
      - "role:assign:org"
      - "team:create:org"
      - "team:update:org"
      - "team:delete:org"
      - "billing:read:org"
      - "billing:update:org"
      - "audit:read:org"
      - "settings:read:org"
      - "settings:update:org"
      - "secret:create:org"
      - "secret:read:org"
      - "secret:update:org"
      - "secret:delete:org"
    resources:
      - "org/*"
    quotas:
      maxQueriesPerHour: 5000
      maxWorkflowExecutionsPerDay: 500

  # SuperAdmin - Platform administrator
  superadmin:
    description: "Platform administrator with system-wide access"
    inherits: ["admin"]
    permissions:
      - "*:*:*"  # All permissions
    resources:
      - "*"
    quotas:
      maxQueriesPerHour: -1  # Unlimited
      maxWorkflowExecutionsPerDay: -1  # Unlimited

# Permission definitions
permissions:
  # Authentication
  "auth:login": "Login to the system"
  "auth:register": "Register new account"
  "auth:reset-password": "Reset password"

  # Profile management
  "profile:read:own": "Read own profile"
  "profile:update:own": "Update own profile"

  # Query execution
  "query:execute:own": "Execute own queries"

  # Dashboard
  "dashboard:read:own": "View own dashboards"
  "dashboard:create:team": "Create team dashboards"
  "dashboard:update:team": "Update team dashboards"

  # Tests
  "test:read:own": "View own tests"
  "test:create:own": "Create own tests"
  "test:create:team": "Create team tests"
  "test:update:team": "Update team tests"
  "test:delete:team": "Delete team tests"
  "test:execute:team": "Execute team tests"

  # Repositories
  "repository:read:team": "Read team repositories"
  "repository:webhook:manage": "Manage repository webhooks"

  # Deployments
  "deployment:read:all": "View all deployments"
  "deployment:create:team": "Create team deployments"
  "deployment:rollback:team": "Rollback team deployments"

  # Observability
  "observability:read:all": "Read all observability data"
  "observability:query:all": "Query all observability data"

  # Incidents
  "incident:read:own": "View own incidents"
  "incident:create:team": "Create team incidents"
  "incident:update:team": "Update team incidents"
  "incident:manage:team": "Manage team incidents"
  "incident:escalate:team": "Escalate team incidents"

  # Workflows
  "workflow:read:own": "View own workflows"
  "workflow:execute:own": "Execute own workflows"
  "workflow:create:team": "Create team workflows"
  "workflow:update:team": "Update team workflows"

  # Runbooks
  "runbook:execute:team": "Execute team runbooks"

  # Alerts
  "alert:create:team": "Create team alerts"
  "alert:update:team": "Update team alerts"
  "alert:delete:team": "Delete team alerts"

  # Users
  "user:read:org": "Read organization users"
  "user:create:org": "Create organization users"
  "user:update:org": "Update organization users"
  "user:delete:org": "Delete organization users"

  # Roles
  "role:assign:org": "Assign roles in organization"

  # Teams
  "team:create:org": "Create teams in organization"
  "team:update:org": "Update teams in organization"
  "team:delete:org": "Delete teams in organization"

  # Billing
  "billing:read:org": "Read organization billing"
  "billing:update:org": "Update organization billing"

  # Audit
  "audit:read:org": "Read organization audit logs"

  # Settings
  "settings:read:org": "Read organization settings"
  "settings:update:org": "Update organization settings"

  # Secrets
  "secret:create:org": "Create organization secrets"
  "secret:read:org": "Read organization secrets"
  "secret:update:org": "Update organization secrets"
  "secret:delete:org": "Delete organization secrets"

  # Health check
  "health:check": "Check system health"
```

#### RBAC Implementation
```typescript
// services/auth/rbac.ts
import { load } from 'js-yaml';
import * as fs from 'fs';

interface Permission {
  resource: string;
  action: string;
  scope: string;
}

interface Role {
  name: string;
  description: string;
  inherits: string[];
  permissions: string[];
  resources: string[];
  quotas: Record<string, number>;
}

export class RBACService {
  private roles: Map<string, Role> = new Map();
  private permissionCache: Map<string, Set<string>> = new Map();

  constructor(configPath: string = '/config/rbac.yaml') {
    this.loadRoles(configPath);
  }

  // Load roles from configuration
  private loadRoles(configPath: string): void {
    const config = load(fs.readFileSync(configPath, 'utf8')) as any;

    for (const [roleName, roleConfig] of Object.entries(config.roles)) {
      this.roles.set(roleName, {
        name: roleName,
        ...roleConfig as any
      });
    }

    // Build permission cache with inheritance
    for (const roleName of this.roles.keys()) {
      this.buildPermissionCache(roleName);
    }
  }

  // Build permission cache with inheritance
  private buildPermissionCache(roleName: string): Set<string> {
    if (this.permissionCache.has(roleName)) {
      return this.permissionCache.get(roleName)!;
    }

    const role = this.roles.get(roleName);
    if (!role) return new Set();

    const permissions = new Set<string>(role.permissions);

    // Add inherited permissions
    for (const parentRole of role.inherits) {
      const parentPermissions = this.buildPermissionCache(parentRole);
      parentPermissions.forEach(p => permissions.add(p));
    }

    this.permissionCache.set(roleName, permissions);
    return permissions;
  }

  // Check if user has permission
  hasPermission(userRoles: string[], permission: string, resource?: string): boolean {
    const [action, scope, resourceType] = permission.split(':');

    for (const roleName of userRoles) {
      const permissions = this.permissionCache.get(roleName);
      if (!permissions) continue;

      // Check for wildcard permission
      if (permissions.has('*:*:*')) return true;

      // Check for exact permission
      if (permissions.has(permission)) {
        // If resource specified, check resource access
        if (resource) {
          return this.hasResourceAccess(roleName, resource);
        }
        return true;
      }

      // Check for wildcard action
      if (permissions.has(`*:${scope}:${resourceType}`)) return true;
      if (permissions.has(`${action}:*:${resourceType}`)) return true;
      if (permissions.has(`${action}:${scope}:*`)) return true;
    }

    return false;
  }

  // Check resource access
  private hasResourceAccess(roleName: string, resource: string): boolean {
    const role = this.roles.get(roleName);
    if (!role) return false;

    // Check for wildcard access
    if (role.resources.includes('*')) return true;

    // Check for specific resource access
    for (const pattern of role.resources) {
      if (this.matchResource(resource, pattern)) {
        return true;
      }
    }

    return false;
  }

  // Match resource against pattern
  private matchResource(resource: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resource);
  }

  // Get user permissions
  getUserPermissions(userRoles: string[]): string[] {
    const allPermissions = new Set<string>();

    for (const roleName of userRoles) {
      const permissions = this.permissionCache.get(roleName);
      if (permissions) {
        permissions.forEach(p => allPermissions.add(p));
      }
    }

    return Array.from(allPermissions);
  }

  // Get role quotas
  getRoleQuotas(userRoles: string[]): Record<string, number> {
    const quotas: Record<string, number> = {};

    for (const roleName of userRoles) {
      const role = this.roles.get(roleName);
      if (role && role.quotas) {
        for (const [key, value] of Object.entries(role.quotas)) {
          // Take maximum quota from all roles
          quotas[key] = Math.max(quotas[key] || 0, value);
        }
      }
    }

    return quotas;
  }
}

// RBAC Middleware
export function requirePermission(permission: string, resourceGetter?: (req: any) => string) {
  return async (req: any, res: any, next: any) => {
    if (!req.user || !req.user.roles) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rbac = new RBACService();
    const resource = resourceGetter ? resourceGetter(req) : undefined;

    if (!rbac.hasPermission(req.user.roles, permission, resource)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}
```

### 4.2 Permission Audit

#### Audit Logger
```typescript
// services/audit/logger.ts
import { createLogger, format, transports } from 'winston';
import * as Transport from 'winston-transport';

interface AuditEvent {
  timestamp: Date;
  userId: string;
  userEmail: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  result: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  requestId: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private logger: ReturnType<typeof createLogger>;

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: { service: 'llm-copilot-agent' },
      transports: [
        // Write to local file
        new transports.File({
          filename: '/var/log/llm-copilot/audit.log',
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10,
          tailable: true
        }),

        // Send to CloudWatch (in AWS)
        // new WinstonCloudWatch({
        //   logGroupName: '/aws/llm-copilot/audit',
        //   logStreamName: `${process.env.ENVIRONMENT}-${process.env.POD_NAME}`,
        //   awsRegion: process.env.AWS_REGION
        // })
      ]
    });
  }

  // Log audit event
  log(event: AuditEvent): void {
    this.logger.info({
      type: 'audit',
      ...event
    });
  }

  // Log successful action
  logSuccess(event: Omit<AuditEvent, 'result'>): void {
    this.log({ ...event, result: 'success' });
  }

  // Log failed action
  logFailure(event: Omit<AuditEvent, 'result'>, error?: Error): void {
    this.log({
      ...event,
      result: 'failure',
      metadata: {
        ...event.metadata,
        error: error?.message
      }
    });
  }
}

// Audit middleware
export function auditMiddleware(action: string, resourceGetter?: (req: any) => string) {
  const auditLogger = new AuditLogger();

  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Capture response
    const originalJson = res.json;
    res.json = function(data: any) {
      const duration = Date.now() - startTime;

      const event: AuditEvent = {
        timestamp: new Date(),
        userId: req.user?.id || 'anonymous',
        userEmail: req.user?.email || 'anonymous',
        organizationId: req.user?.organizationId,
        action,
        resource: resourceGetter ? resourceGetter(req) : req.path,
        resourceId: req.params.id,
        result: res.statusCode < 400 ? 'success' : 'failure',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'unknown',
        requestId: req.id,
        metadata: {
          method: req.method,
          statusCode: res.statusCode,
          duration
        }
      };

      auditLogger.log(event);

      return originalJson.call(this, data);
    };

    next();
  };
}
```

### 4.3 Access Review Process

#### Quarterly Access Review
```yaml
# docs/processes/access-review.yaml
accessReviewProcess:
  frequency: "Quarterly"

  steps:
    - name: "Generate Access Report"
      description: "Generate report of all user permissions and roles"
      owner: "Security Team"
      automation: true
      script: "scripts/generate-access-report.sh"

    - name: "Manager Review"
      description: "Managers review access for their team members"
      owner: "Team Managers"
      duration: "2 weeks"

    - name: "Security Review"
      description: "Security team reviews high-privilege accounts"
      owner: "Security Team"
      duration: "1 week"

    - name: "Execute Changes"
      description: "Remove or modify access as needed"
      owner: "Security Team"
      duration: "1 week"

    - name: "Document Results"
      description: "Document review results and actions taken"
      owner: "Security Team"
      automation: true

  criteria:
    - "Is the access still required for the user's current role?"
    - "Has the user been active in the last 90 days?"
    - "Are there any overprivileged accounts?"
    - "Are there any dormant accounts that should be disabled?"
    - "Are service accounts still in use?"

  alerts:
    - condition: "User inactive for 90 days"
      action: "Notify manager for review"
    - condition: "User has admin role but not in admin team"
      action: "Escalate to security team"
    - condition: "Service account not used in 180 days"
      action: "Mark for deletion"
```

#### Automated Access Review Script
```bash
#!/bin/bash
# scripts/generate-access-report.sh

set -euo pipefail

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="access-review-${REPORT_DATE}.csv"

echo "Generating access review report..."

# Generate CSV report
kubectl exec -n llm-copilot deployment/llm-copilot-agent -- \
  node scripts/access-report.js > "/tmp/${REPORT_FILE}"

# Upload to S3
aws s3 cp "/tmp/${REPORT_FILE}" \
  "s3://llm-copilot-compliance/access-reviews/${REPORT_FILE}"

# Send notification
aws sns publish \
  --topic-arn "arn:aws:sns:us-east-1:123456789012:access-review" \
  --subject "Quarterly Access Review - ${REPORT_DATE}" \
  --message "Access review report generated. Please review at: https://s3.console.aws.amazon.com/s3/object/llm-copilot-compliance/access-reviews/${REPORT_FILE}"

echo "Report generated: ${REPORT_FILE}"
```

---

*Continued in next section due to length...*
