# ADR-0001: Scope Compliance Claims to Implemented Controls

**Status:** Proposed
**Date:** 2026-07-27

## Context

`README.md` presents SOC 2 Type II, HIPAA, and data residency as delivered, completed
capabilities. `README.md:470` marks Phase 5 ("AI/ML Platform & Compliance") as
**Complete**, and the "Security & Compliance" section states them as properties of the
system:

| Location | Claim |
|---|---|
| `README.md:34` | "**SOC 2 Type II** - Control management, audits, findings, evidence collection" |
| `README.md:35` | "**HIPAA Compliance** - PHI access logging, BAA management, breach reporting" |
| `README.md:36` | "**Data Residency** - Policy enforcement, regional data controls, transfer workflows" |
| `README.md:208` | "Enterprise compliance management for SOC 2, HIPAA, and data residency requirements." |
| `README.md:214` | "**HIPAA Compliance** \| PHI access logging, BAA management, breach reporting" |
| `README.md:470` | "\| Phase 5 \| Complete \| AI/ML Platform & Compliance \|" |
| `README.md:475-477` | "**SOC 2 Type II** - Comprehensive control framework" / "**HIPAA** - PHI protection and access logging" / "**GDPR** - Data residency and privacy controls" |
| `README.md:480` | "**Encryption** - At-rest and in-transit encryption" |

These are not pure marketing prose — `services/compliance/` contains 4,115 lines of real
TypeScript (`hipaaService.ts` 815, `complianceService.ts` 930, `dataResidencyService.ts`
831, plus routes and models) using parameterized SQL against Postgres and Redis. The
HIPAA control catalog in `hipaaService.ts:401-583` correctly enumerates 45 CFR §164.308,
§164.310, and §164.312 safeguards with accurate citations. This is competent work.

The problem is that the code does not run, is not reachable, and is not evidence.

### Finding 1 — Every table the HIPAA service writes to is undefined

The only migration is `migrations/V001_initial_schema.sql`, which creates `users`,
`sessions`, `conversations`, `messages`, `workflows`, `workflow_executions`, `incidents`,
`runbooks`, and `audit_logs` (+ partitions). It does **not** create `phi_access_logs`
(written at `hipaaService.ts:84`), `business_associate_agreements` (`:257`),
`hipaa_breaches` (`:712`), `compliance_controls` (read at `:614`), `security_alerts`
(`:767`), or `scheduled_tasks` (`:383`). No `.sql` file anywhere in the repo defines them.
Every PHI logging call fails at runtime with `relation "phi_access_logs" does not exist`.
PHI access logging is currently a 100% failure path.

### Finding 2 — Nothing calls the PHI logger

`logPHIAccess` is invoked from exactly one place: its own HTTP handler at
`routes/hipaa.ts:22`. No other service, middleware, or data-access path in the repo calls
it. PHI access logging is therefore opt-in self-reporting by whoever chooses to POST.
§164.312(b) Audit Controls requires the system to *record* access to ePHI; a system that
depends on callers voluntarily reporting their own access does not implement that control.

### Finding 3 — The compliance API has no authentication or authorization

`index.ts:183-185` mounts all three routers behind only `executionContextMiddleware`,
which is span/trace plumbing, not auth. Consequences:

- `routes/hipaa.ts:22` passes `req.body` unvalidated into `logPHIAccess`, so any caller
  can forge the `userId` attributed in the audit record — the audit trail is repudiable.
- `GET /phi-access` (`routes/hipaa.ts:32`) lets any party who can reach port 3009 read the
  entire PHI access log, including `patientId`, `ipAddress`, and `purpose`.

This contradicts §164.312(a)(1) Access Control and §164.312(d) Person or Entity
Authentication — two controls the repo's own catalog marks `required: true`
(`hipaaService.ts:511-517`, `:558-565`).

### Finding 4 — `pseudonymize()` is non-deterministic, breaking patient-level accounting

`hipaaService.ts:748-754` generates a fresh random IV on every call:

```ts
private pseudonymize(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
  ...
}
```

The same `patientId` therefore produces different ciphertext each time. The equality
filter at `hipaaService.ts:122-123` (`AND patient_id = $n` on a freshly-pseudonymized
value) can never match a stored row, and the `uniquePatients` count at `:172` counts one
distinct patient per access event. Accounting of disclosures under §164.528 is
structurally impossible with this function. A keyed HMAC is required, not encryption.

### Finding 5 — Hardcoded default key material

`hipaaService.ts:51-52` falls back to the literal string
`'default-key-change-in-production'` with a hardcoded salt `'salt'` when
`HIPAA_ENCRYPTION_KEY` is unset. There is no production fail-closed check, so a
misconfigured deploy silently pseudonymizes PHI identifiers under a publicly known key.

### Finding 6 — The service is neither deployed nor tested

`compliance` appears nowhere in `docker-compose.yml`, `deploy/`,
`deployment/kubernetes/`, or `deployment/helm/`. No `*.test.ts` or `*.spec.ts` matches
`compliance|hipaa|phi|residency`. The service is unshipped and unverified.

### Finding 7 — The SOC 2 evidence manifest points mostly at nothing

`deployment/compliance/soc2-evidence-collection.yaml` is a well-structured plan mapping
CC6.x controls to evidence sources, but 10 of its 14 referenced paths do not exist:
`docs/policies/authentication-policy.md`, `docs/procedures/user-provisioning.md`,
`services/auth/session.ts`, `services/auth/password-policy.ts`, `hr/background-checks/`,
`compliance/access-reviews/`, `compliance/dr-tests/`, `compliance/failover-tests/`,
`coverage/`, and `s3://llm-copilot-backups/`. The four that resolve are Kubernetes and
Terraform config files.

### Finding 8 — No audit artifact exists, and none could yet

There is no SOC 2 Type II report, auditor name, observation window, or bridge letter in
the repo. Type II is definitionally an *independent CPA firm's opinion on control
operating effectiveness across an observation period* (typically 3-12 months). No
quantity of code in this repository can produce it. Likewise, a Business Associate
Agreement is a signed contract between a covered entity and a business associate under
§164.502(e); `business_associate_agreements` is a registry schema for tracking such
contracts, not a mechanism that creates them. "BAA management" in `README.md:35` reads to
a healthcare buyer as "Agentics will sign a BAA" — a legal commitment, not a feature.

### Finding 9 — The security architecture docs already say they are designs

`security-architecture/03-data-protection-architecture.md:4` and
`security-architecture/05-audit-compliance-architecture.md:4` both carry
`**Status:** Design Specification`. The authors labelled these accurately. The README
promotes them to shipped compliance; the gap is in the README, not in those documents.

### Finding 10 — One claim is genuinely substantiated

Encryption at rest and in transit (`README.md:480`) is real and configured:
`deployment/terraform/main.tf:243` (`storage_encrypted = true` on RDS), `:298-299`
(ElastiCache `at_rest_encryption_enabled` and `transit_encryption_enabled`), `:340-344`
(S3 SSE-KMS), `:356` (customer-managed KMS key), and
`deployment/terraform/modules/eks/main.tf:64` (encrypted EBS volumes). This claim stands
and should not be weakened.

### Summary

This is not a documentation-only problem, so "just document the evidence" (option b) is
not available: the controls are absent, not undocumented. Nor is it vaporware — the
design work is substantially done and the control catalog is accurate. The accurate
description of today's state is **a designed compliance subsystem that has never been
wired up, deployed, or audited**, plus **genuinely implemented infrastructure
encryption**.

## Decision

**Scope the README claims down to what is true today, and gate every future compliance
claim on a linked evidence artifact.**

Specifically:

1. **SOC 2 Type II → removed as a claim.** Replaced with a roadmap entry. The repo may
   describe *"a SOC 2 control-mapping framework and evidence-collection design"* — that is
   true and is what `soc2-evidence-collection.yaml` is. It may not assert SOC 2 Type II
   until an independent auditor issues a report.
2. **HIPAA Compliance → "HIPAA-oriented architecture (design stage, not operational)."**
   The control catalog is accurate and worth citing; the enforcement is not present.
3. **BAA management → removed from the feature list entirely.** It is a legal commitment,
   not a software feature, and Agentics is not currently positioned to sign one. It may
   later return as "BAA lifecycle tracking" — a registry — clearly distinct from executing
   agreements.
4. **Data Residency / GDPR → "design specification."** Same posture as HIPAA; the service
   is undeployed and untested.
5. **Encryption at rest and in transit → retained as-is**, with a pointer to the Terraform
   resources that implement it.
6. **Phase 5 status → "Compliance: Design Complete, Implementation In Progress."**
   Splitting the row is more honest than marking the whole phase Complete.

We choose narrowing over deletion because the underlying engineering is sound and
recoverable, and over "document what exists" because Findings 1-6 show the controls do not
operate. We treat this as urgent rather than cosmetic: representing unaudited software as
SOC 2 Type II certified to a customer is a misrepresentation with contractual and
regulatory exposure independent of the code quality, and HIPAA claims specifically invite
healthcare customers to route PHI into a system whose PHI logging currently throws on
every call.

## Consequences

**Positive**

- The README stops asserting an audit opinion that does not exist, removing the primary
  contractual and misrepresentation exposure.
- Healthcare prospects are not induced to send PHI into a system with no operational PHI
  audit trail.
- Findings 1-5 are concrete, fixable engineering defects; the ADR converts a vague
  "compliance risk" into a tracked backlog.
- The evidence-gate (below) prevents recurrence rather than fixing this one instance.

**Negative**

- The product narrows in sales positioning. Deals gated on SOC 2 Type II or a signed BAA
  become explicitly out of scope until the work lands. This cost is already real and
  merely unrecognized; the claims do not survive a customer security review or auditor
  walkthrough today.
- Anyone who relied on the current README — internally or externally — may need to be
  re-briefed. If these claims have already been made to a customer, correcting them is a
  disclosure conversation, not just a docs edit.

**Neutral**

- The `services/compliance/` code is retained unchanged. This ADR reclassifies it as
  in-progress; it does not deprecate it.

## Implementation Plan

Phase 1 is documentation-only and should ship immediately, independent of Phases 2-4.

**Phase 1 — Correct the claims (immediate)**

1. `README.md:33-36`: retitle the section "Compliance & Governance (Phase 5)" to
   "Compliance & Governance (Design Stage)". Reword `:34` to "SOC 2 control mapping and
   evidence-collection design (no audit performed)"; `:35` to "HIPAA-oriented control
   catalog covering §164.308/310/312 (design stage, not operational)"; `:36` to "Data
   residency policy model (design stage)". Delete "BAA management" from `:35`.
2. `README.md:208`: reword to "Design-stage compliance service for SOC 2 control mapping,
   HIPAA safeguard cataloguing, and data residency policy modelling. Not deployed; see
   `docs/adr/ADR-0001-compliance-claims-remediation.md`."
3. `README.md:212-216`: add a `Status` column to the feature table; mark every row
   `Design` except where a linked artifact exists. Delete "BAA management" from `:214`.
4. `README.md:219-223`: add a note above the endpoint list stating the compliance service
   is not currently deployed in any environment.
5. `README.md:470`: split the Phase 5 row into "AI/ML Platform — Complete" and
   "Compliance — Design Complete, Implementation In Progress".
6. `README.md:473-480`: retitle "Security & Compliance" to "Security". Delete the SOC 2
   Type II (`:475`), HIPAA (`:476`), and GDPR (`:477`) bullets. Retain Encryption (`:480`)
   and append "(see `deployment/terraform/main.tf:243,298-299,340-344`)". Add a line
   pointing to this ADR for compliance posture.
7. Add `**Status:** Design Specification — no audit performed` to the top of
   `deployment/compliance/soc2-evidence-collection.yaml`, and mark the 10 unresolved
   `path:` entries from Finding 7 with `# TODO: artifact does not yet exist`.

**Phase 2 — Make the HIPAA service actually function**

8. Write `migrations/V002_compliance_schema.sql` creating `phi_access_logs`,
   `business_associate_agreements`, `hipaa_breaches`, `compliance_controls`,
   `security_alerts`, and `scheduled_tasks`, matching the column lists in
   `hipaaService.ts:84-93`, `:257-267`, and `:712-721`. Index `phi_access_logs` on
   `(patient_id)`, `(user_id)`, and `(timestamp)`.
9. Replace `pseudonymize()` (`hipaaService.ts:748-754`) with a deterministic keyed HMAC
   (`crypto.createHmac('sha256', key)`), so equality lookups at `:122-123` work and
   `uniquePatients` at `:172` is correct. Add a unit test asserting the same input yields
   the same output across calls.
10. Remove the `'default-key-change-in-production'` fallback at `hipaaService.ts:51` and
    the hardcoded `'salt'` at `:52`. Throw on startup when `HIPAA_ENCRYPTION_KEY` is unset
    and `NODE_ENV === 'production'`; source the salt from config.
11. Add authentication and role-based authorization middleware to all three routers at
    `index.ts:183-185`. Derive `userId` in `routes/hipaa.ts:22` from the authenticated
    principal, never from `req.body`. Restrict `GET /phi-access` to a compliance-auditor
    role.
12. Add schema validation (the repo already uses Zod elsewhere) on every compliance route
    body and query.

**Phase 3 — Make PHI logging an enforced control, not an opt-in call**

13. Identify every code path that reads or writes ePHI-classified fields and route it
    through a data-access layer that emits a PHI access record as a side effect of the
    read, so logging cannot be skipped by omission.
14. Make `phi_access_logs` append-only: revoke `UPDATE`/`DELETE` from the application role
    and add a hash-chain or equivalent tamper-evidence mechanism, per the design already
    written in `security-architecture/05-audit-compliance-architecture.md`.
15. Add integration tests proving (a) a PHI read with no accompanying log entry fails the
    test suite, (b) an unauthenticated request to any `/api/v1/hipaa/*` route is rejected,
    (c) patient-scoped lookup returns that patient's records.
16. Add the compliance service to `docker-compose.yml` and the Kubernetes and Helm
    manifests, with the encryption key sourced from a secret store.

**Phase 4 — Earn the stronger claims**

17. Author the missing policy and procedure artifacts enumerated in Finding 7.
18. Implement automated evidence collection against the CC6.x mappings in
    `soc2-evidence-collection.yaml` and land the artifacts in a real `compliance/`
    directory.
19. Engage an independent CPA firm. Complete a Type I readiness assessment, then a Type II
    observation window (3-12 months). Only on receipt of the Type II report may
    `README.md` state SOC 2 Type II, and it must then cite the auditor, report date, and
    observation window.
20. For HIPAA: obtain a third-party §164.308(a)(1)(ii)(A) risk analysis, and have counsel
    produce a BAA template plus an execution process before any BAA language returns to
    the README.

**Controls that must exist before the stronger claims are accurate**

*Before "HIPAA-compliant":* enforced PHI access logging (13), tamper-evident append-only
audit storage (14), authentication and authorization on all PHI paths (11), deterministic
patient-scoped accounting of disclosures (9), managed key material with rotation (10),
a documented breach notification runbook exercised at least once, a third-party risk
analysis, and an executed BAA process.

*Before "SOC 2 Type II":* all of the above, plus operating evidence for each CC6.x control
across the full observation window, documented access reviews, DR and failover test
records, and an unqualified independent auditor opinion.

## Verification

1. **No unbacked compliance claim ships.** Every compliance assertion in `README.md` must
   link to either (a) a file path in this repo implementing the control, or (b) a dated
   third-party audit artifact. A claim with neither is a release blocker.
2. **Automated check.** Add a CI job that greps `README.md` and `docs/` for
   `SOC 2|SOC2|HIPAA compliant|BAA|GDPR compliant|certified` and fails unless each hit is
   within 3 lines of a resolvable link or an explicit `(design stage)` qualifier. This
   catches regressions mechanically rather than relying on review vigilance.
3. **Evidence-path integrity.** Add a CI job that resolves every `path:` entry in
   `deployment/compliance/soc2-evidence-collection.yaml` and fails on any path that does
   not exist and is not explicitly marked `# TODO`. Finding 7 would have been caught at
   authoring time by this check.
4. **Phase 2 acceptance.** `migrations/V002_compliance_schema.sql` applies cleanly and an
   integration test performs a full write-then-read of `POST /api/v1/hipaa/phi-access`
   followed by `GET /api/v1/hipaa/phi-access?patientId=...` returning the same record —
   proving Findings 1 and 4 are closed.
5. **Phase 3 acceptance.** A deliberately introduced ePHI read that bypasses the logging
   layer causes a test failure. An unauthenticated request to any `/api/v1/hipaa/*` route
   returns 401. Attempting `UPDATE` or `DELETE` on `phi_access_logs` as the application
   role is rejected by the database.
6. **Claim restoration is gated on artifacts, not on code completion.** SOC 2 Type II
   language returns to `README.md` only in a PR that also adds the auditor's report
   reference. HIPAA and BAA language returns only in a PR that also adds the third-party
   risk analysis and counsel-approved BAA template. Reviewers reject such PRs on a missing
   artifact regardless of implementation state.
