# ADR-0002: Implement the PHI Compliance Data Layer, Enforced Access Logging, and Authenticated Compliance API

**Status:** Proposed
**Date:** 2026-07-27

## Context

[ADR-0001](./ADR-0001-compliance-claims-remediation.md) decided to scope the README's
compliance claims down to what is true today. It treated the underlying technical work as
a four-phase summary rather than a design decision. This ADR makes the concrete technical
decisions for ADR-0001 Phases 2 and 3, which that ADR deliberately left at the level of
"what must happen" rather than "how".

The compliance service at `services/compliance/` is roughly 4,100 lines of real,
non-stubbed TypeScript. Its SQL is consistently parameterized (`$1..$n`), so it is not
injection-prone. The problem is that it executes against a schema that does not exist, and
it is reachable without authentication.

### Finding 1 — Every table all three compliance services touch is undefined

`migrations/V001_initial_schema.sql` is the only migration in the repository. It defines
exactly nine tables: `users`, `sessions`, `conversations`, `messages`, `workflows`,
`workflow_executions`, `incidents`, `runbooks`, and `audit_logs` (partitioned by range on
`created_at`, `V001:311-341`).

Not one of the tables the compliance services read or write is among them. A
`CREATE TABLE` search across every `.sql` file in the repository returns zero hits for all
fifteen:

| Table | Written at | Service |
|---|---|---|
| `phi_access_logs` | `hipaaService.ts:84` (read `:112`) | HIPAA |
| `business_associate_agreements` | `hipaaService.ts:257` (read `:283`) | HIPAA |
| `scheduled_tasks` | `hipaaService.ts:383` | HIPAA |
| `hipaa_breaches` | `hipaaService.ts:712` | HIPAA |
| `security_alerts` | `hipaaService.ts:767` | HIPAA |
| `compliance_controls` | `complianceService.ts:68` (read `:93`, `hipaaService.ts:614`) | Compliance |
| `compliance_audits` | `complianceService.ts:289` | Compliance |
| `compliance_findings` | `complianceService.ts:423` | Compliance |
| `compliance_reports` | `complianceService.ts:658` | Compliance |
| `compliance_audit_log` | `complianceService.ts:863` | Compliance |
| `data_residency_policies` | `dataResidencyService.ts:90` | Data residency |
| `data_assets` | `dataResidencyService.ts:248` | Data residency |
| `data_transfer_requests` | `dataResidencyService.ts:420` | Data residency |
| `notifications` | `dataResidencyService.ts:743` | Data residency |
| `data_residency_events` | `dataResidencyService.ts:766` | Data residency |

**This corrects ADR-0001 Finding 1 and Implementation step 8**, which scoped the gap to six
tables. The gap is fifteen, spanning all three routers — not just the HIPAA one. Every
endpoint on all three mounted routers fails at the first query with
`relation ... does not exist`. The compliance service has never successfully served a
request against a real database.

### Finding 2 — Nothing calls the PHI logger except its own HTTP endpoint

`logPHIAccess` is defined at `hipaaService.ts:62`. A repository-wide search for the symbol
returns exactly two hits: the definition, and `routes/hipaa.ts:22`, its own route handler.

No data-access path invokes it. PHI logging is therefore opt-in self-reporting: a caller
announces that it touched PHI, and is trusted. HIPAA §164.312(b) (Audit Controls) requires
mechanisms that *record* activity, not endpoints that accept assertions about it. The
service's own requirements table declares this control `required: true`
(`hipaaService.ts:542-549`).

### Finding 3 — All three compliance routers are unauthenticated

`index.ts:183-185` mounts them behind `executionContextMiddleware` only:

```
app.use('/api/v1/compliance', executionContextMiddleware, createComplianceRoutes(...));
app.use('/api/v1/hipaa',      executionContextMiddleware, createHIPAARoutes(...));
app.use('/api/v1/data-residency', executionContextMiddleware, createDataResidencyRoutes(...));
```

`executionContextMiddleware` is span tracking. Grepping it for `user`, `auth`, `token`,
`jwt`, or `401` returns nothing. There is no other guard anywhere in the request path, and
`services/compliance/src/` imports no authentication module at all.

Three consequences follow:

1. **The audit trail is forgeable.** `routes/hipaa.ts:22` passes `req.body` straight into
   `logPHIAccess`, so `userId` — the attribution field of the HIPAA audit record — is
   attacker-controlled.
2. **The PHI access log is world-readable.** `GET /api/v1/hipaa/phi-access`
   (`routes/hipaa.ts:32-47`) returns full records including `patientId`, `ipAddress`, and
   `userAgent` to any caller who can reach the port. An audit log of PHI disclosures is
   itself sensitive; exposing it is a reportable disclosure.
3. **The code already assumes an authenticated principal that never materializes.**
   `routes/hipaa.ts:113` and `:213` read `(req as any).user?.id || 'system'`. Because no
   middleware populates `req.user`, every BAA and every breach report is permanently
   attributed to `'system'`.

### Finding 4 — The repository already has the auth middleware these routes omitted

`services/billing/src/middleware/auth.ts` implements a complete, reusable set: `authenticate`
(JWT bearer, `:28-57`), `authenticateApiKey` (`:62-88`), `authenticateAny` (`:93-110`),
`authorize(...roles)` (`:115-134`), `requireAdmin` (`:163-177`), `authenticateInternal`
(`:182-203`), and the `AuthenticatedRequest`/`AuthenticatedUser` types (`:13-23`).

`services/compliance/package.json` already declares `jsonwebtoken@^9.0.2` and `zod@^3.22.4`
as dependencies. Both are unused in `src/`.

So this is **not** "build authentication." It is "apply the authentication that already
exists and is already a declared dependency."

One trap: billing's middleware sets `req.user.userId` (`auth.ts:14`, `:44`), but the HIPAA
routes read `req.user?.id` (`routes/hipaa.ts:113`, `:213`). Mounting billing's middleware
unchanged would still silently yield `undefined` and fall through to `'system'`. The field
name mismatch must be fixed at the same time, or the fix will appear to work while
attributing every record to `'system'`.

### Finding 5 — `pseudonymize()` is non-deterministic, which breaks patient-scoped accounting

`hipaaService.ts:748-754`:

```
private pseudonymize(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
  ...
  return iv.toString('hex') + ':' + encrypted;
}
```

A fresh random IV per call means the same `patientId` encrypts to a different string every
time. Three call sites break:

- **Write** (`:65`) stores one ciphertext; **read** (`:122-123`) filters
  `patient_id = $n` with a *newly computed, different* ciphertext. The equality filter can
  never match. Patient-scoped lookup always returns zero rows.
- `generateAccessReport` (`:148-191`) counts `uniquePatients` via
  `new Set(logs.map(l => l.patientId))` (`:172`). Every access by the same patient counts
  as a distinct patient, so the number is meaningless.
- Disclosure accounting under HIPAA §164.528 requires producing, on request, the accesses
  pertaining to one individual. That query is structurally impossible under this scheme.

AES-CBC is also reversible, which is the wrong property here: a pseudonym should be a
one-way, stable token, not recoverable ciphertext sitting next to the key.

### Finding 6 — Hardcoded default key material with no production guard

`hipaaService.ts:51-52`:

```
const key = process.env.HIPAA_ENCRYPTION_KEY || 'default-key-change-in-production';
this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
```

Both the key fallback and the salt are literals committed to the repository. Nothing checks
`NODE_ENV`. A production deployment that forgets the variable starts cleanly and derives
every PHI pseudonym from a publicly known key and a publicly known salt — silently, with no
log line. `HIPAA_ENCRYPTION_KEY` does not appear in `.env.example`, so an operator has no
signal that it needs to be set.

---

## Decision

Implement the compliance data layer and close the four security defects, in this shape:

1. **Add `migrations/V002_compliance_schema.sql`** defining all fifteen missing tables,
   with `phi_access_logs` built for append-only, tamper-evident audit semantics. Use the
   filename ADR-0001 step 8 already names, so the two ADRs refer to one artifact.

2. **Move PHI logging from opt-in reporting to enforced instrumentation.** Introduce a PHI
   data-access layer that all ePHI reads and writes must route through, which emits the
   access record as an unavoidable side effect of the operation. Demote
   `POST /api/v1/hipaa/phi-access` to an internal, service-authenticated ingestion endpoint
   for out-of-process callers; it stops being the primary path.

3. **Apply the existing authentication and authorization middleware to all three routers**,
   promoted from `services/billing/src/middleware/auth.ts` to a location both services
   share. Derive `userId` exclusively from the verified token. Never read it from
   `req.body`. Gate `GET /phi-access` behind a `compliance-auditor` role.

4. **Replace `pseudonymize()` with a keyed HMAC-SHA256** — deterministic for a given
   `patientId`, non-reversible, and correct under equality filtering.

5. **Delete the default key and salt, and fail closed.** Refuse to start when
   `HIPAA_ENCRYPTION_KEY` is absent outside development.

### Why HMAC-SHA256 rather than the alternatives

| Option | Deterministic | Non-reversible | Verdict |
|---|---|---|---|
| AES-CBC, random IV (current) | No | No | Broken for equality; key recovers PHI |
| AES-SIV / deterministic AES | Yes | No | Works for lookup, but reversible — a pseudonym should not be decryptable |
| Bare SHA-256 | Yes | Yes | Patient ID spaces are small and structured; an unkeyed digest is brute-forceable from a rainbow table |
| **HMAC-SHA256 with secret key** | **Yes** | **Yes** | **Chosen.** The key acts as a pepper, so an attacker holding the log cannot enumerate candidate IDs without it |

The output is a fixed 64-character hex string, which also makes the column a fixed-width
`CHAR(64)` and cheap to index — unlike the current variable-length `iv:ciphertext`.

Because `phi_access_logs` has never existed, **there is no stored data to re-pseudonymize.**
This scheme change is free now and expensive after the first production write. That is the
main reason to sequence this ADR before any deployment work.

### Why enforced logging rather than disciplined calling

A logging call that a developer must remember to write is a control that fails silently the
first time someone forgets. Routing ePHI access through a layer that logs as a side effect
converts "we ask engineers to log PHI access" into "PHI access cannot occur without a log
record," which is what §164.312(b) actually requires and what an auditor will test.

---

## Consequences

**Positive**

- The compliance service executes successfully for the first time; every endpoint on all
  three routers currently fails at its first query.
- Patient-scoped lookup and §164.528 disclosure accounting become possible.
- The audit trail becomes attributable to a verified principal rather than to a
  request-body string.
- The PHI access log stops being readable by anonymous callers.
- A misconfigured production deploy fails loudly at boot instead of silently protecting PHI
  with a key printed in the repository.
- Closes ADR-0001 Findings 1-5 and satisfies its Phase 2-3 acceptance criteria, unblocking
  the "HIPAA-compliant" claim gate ADR-0001 defines (though it does not by itself satisfy
  that gate — the third-party risk analysis and BAA process in ADR-0001 Phase 4 remain).

**Negative**

- The PHI data-access layer is the largest item here and touches every ePHI call path. It
  cannot be scoped without first inventorying which fields are ePHI-classified, which does
  not exist yet.
- Promoting billing's auth middleware to shared code creates a cross-service dependency
  that needs an owner, and drags along `utils/config`, `utils/errors`, and `utils/logger`,
  which `services/compliance/` does not currently have.
- Every existing caller of the compliance API — if any exist outside tests — breaks when
  authentication turns on. Deliberate: an unauthenticated PHI API has no safe grace period.
- Append-only enforcement means corrections require compensating entries, not `UPDATE`s.
  This is correct for audit logs and will surprise anyone expecting mutable rows.

**Neutral**

- HMAC pseudonyms are stable only while the key is stable. Key rotation renders old
  pseudonyms unlinkable to new ones, so rotation needs a documented key-version column and
  procedure. Deferred to a follow-up ADR, but `phi_access_logs` carries a `key_version`
  column from day one so that ADR is not blocked by a migration.
- Fifteen tables is a large migration, but they are independent and additive; V002 creates
  no foreign keys into existing V001 tables except `users(id)`.

---

## Implementation Plan

1. **Write `migrations/V002_compliance_schema.sql`.** Follow V001's existing conventions:
   `uuid_generate_v4()` primary keys, `TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `JSONB DEFAULT
   '{}'`, `CREATE TYPE ... AS ENUM` for closed value sets, and GIN indexes on array and
   JSONB columns.

   `phi_access_logs` — columns driven by the insert at `hipaaService.ts:84-93`:

   ```
   id UUID PK
   user_id UUID NOT NULL REFERENCES users(id)
   patient_id CHAR(64)              -- HMAC-SHA256 hex, nullable
   key_version SMALLINT NOT NULL DEFAULT 1
   access_type phi_access_type NOT NULL   -- ENUM
   resource_type VARCHAR(100) NOT NULL
   resource_id VARCHAR(255) NOT NULL
   purpose TEXT
   access_granted BOOLEAN NOT NULL
   ip_address INET
   user_agent TEXT
   timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
   metadata JSONB DEFAULT '{}'
   prev_hash CHAR(64)               -- tamper-evidence chain
   entry_hash CHAR(64) NOT NULL
   ```

   Partition by `RANGE (timestamp)`, mirroring the `audit_logs` pattern at `V001:311-341`,
   including a `DEFAULT` partition so inserts never fail on a missing range. Index
   `(patient_id, timestamp DESC)`, `(user_id, timestamp DESC)`, and `(timestamp DESC)` —
   the three filters at `hipaaService.ts:116-136`.

   Note `ip_address INET` matches V001's convention (`users.last_login_ip`,
   `sessions.ip_address`) but will reject malformed input, where the current code passes an
   unvalidated string. Validate at the boundary in step 6 rather than widening the column
   to `TEXT`.

   The remaining fourteen tables follow their respective insert statements. Two shapes need
   care: `business_associate_agreements.documents` must be `JSONB NOT NULL DEFAULT '[]'`
   because `hipaaService.ts:360` appends with the `||` operator, which returns `NULL` on a
   `NULL` left operand; and `hipaa_breaches.phi_types` / `.containment_actions` must be
   `TEXT[]`, since `:719` passes JavaScript arrays as parameters directly rather than
   serializing them. `compliance_controls` needs both a surrogate `id` and a distinct
   `control_id` (`complianceService.ts:68-72`), since `hipaaService.ts:613-616` joins on
   `control_id` against HIPAA identifiers like `164.308(a)(1)`.

2. **Enforce append-only on `phi_access_logs`.** In the same migration, `REVOKE UPDATE,
   DELETE ON phi_access_logs` from the application role, and add a `BEFORE UPDATE OR DELETE`
   trigger that raises an exception — belt and braces, so a future `GRANT` does not silently
   re-open mutation. Compute `entry_hash` over the row contents plus `prev_hash` at insert
   time to make the chain verifiable. This implements ADR-0001 step 14.

3. **Replace `pseudonymize()` (`hipaaService.ts:748-754`)** with
   `crypto.createHmac('sha256', this.pseudonymKey).update(value).digest('hex')`. Delete the
   IV, cipher, and the `iv:ciphertext` return format. No other call site changes: `:65` and
   `:123` keep working and start agreeing with each other.

4. **Replace the key setup (`hipaaService.ts:51-52`)** with a fail-closed loader:

   - Read `HIPAA_ENCRYPTION_KEY` and a new `HIPAA_PSEUDONYM_SALT`.
   - If either is unset and `NODE_ENV === 'production'`, throw — do not warn, do not
     default. `index.ts:315-318` already exits non-zero on a rejected `main()`, so the
     process will fail its healthcheck and the deploy will roll back.
   - Outside production, permit an explicitly-labelled ephemeral development key and log at
     `warn` that pseudonyms are not stable across restarts.
   - Delete both string literals. Add both variables to `.env.example`, where neither
     currently appears.

5. **Promote `services/billing/src/middleware/auth.ts`** to a location both services import
   — a shared package, or `services/compliance/src/middleware/auth.ts` if extraction is
   deferred — along with the `utils/config`, `utils/errors`, and `utils/logger` it depends
   on. Do not fork it; a second copy of authentication logic is how the two drift.

6. **Apply auth at `index.ts:183-185`**, with per-route authorization:

   | Route | Guard |
   |---|---|
   | All three routers | `authenticate` |
   | `GET /hipaa/phi-access`, `POST /hipaa/phi-access/report` | `authorize('compliance-auditor', 'admin')` |
   | `POST /hipaa/phi-access` | `authenticateInternal` — service-to-service ingestion only |
   | `POST /hipaa/breaches`, `POST|PATCH /hipaa/baa*` | `authorize('compliance-officer', 'admin')` |
   | `GET /hipaa/requirements`, `GET /hipaa/assessment` | `authenticate` (any authenticated principal) |

   Then fix the attribution bug: change `routes/hipaa.ts:22` to build its input from
   `req.user.userId` plus a validated body, never `req.body` wholesale; and change
   `routes/hipaa.ts:113` and `:213` from `(req as any).user?.id || 'system'` to
   `req.user.userId` on a typed `AuthenticatedRequest`. Drop the `|| 'system'` fallback
   entirely — with `authenticate` in front, an absent user is an invariant violation, not a
   case to paper over. Add Zod schemas (already a dependency) for every body and query.

7. **Build the PHI data-access layer.** Inventory the ePHI-classified fields, then place
   reads and writes behind a repository/interceptor that calls `logPHIAccess` as a side
   effect, deriving `userId` from the request context rather than from an argument. This is
   ADR-0001 step 13 and is the item most likely to need its own design note once the ePHI
   inventory exists.

8. **Add the tests in the Verification section**, then add the compliance service to
   `docker-compose.yml` and the Kubernetes and Helm manifests with the key sourced from a
   secret store (ADR-0001 step 16). The service is currently in none of them, so nothing
   above is exercised in CI until this step lands.

---

## Verification

Each of these fails today and must pass when this ADR is implemented.

1. **Pseudonym determinism.** Two calls to `pseudonymize()` with the same `patientId` in the
   same process return byte-identical output. A third call in a *separate process* with the
   same configured key returns the same value again — this is the one that catches an
   accidental per-instance random salt.

2. **Round-trip patient lookup.** `POST /api/v1/hipaa/phi-access` with
   `patientId: "PT-12345"`, then `GET /api/v1/hipaa/phi-access?patientId=PT-12345`, returns
   that record. This is ADR-0001 acceptance criterion 4 and fails today for two independent
   reasons — missing table and non-deterministic pseudonym — so it must be asserted after
   both are fixed.

3. **Disclosure accounting.** Twenty accesses to the same `patientId` by four users produce
   `uniquePatients: 1` and `uniqueUsers: 4` from `generateAccessReport`. Currently returns
   `uniquePatients: 20`.

4. **Unauthenticated rejection.** A request with no `Authorization` header to every route
   under `/api/v1/compliance/*`, `/api/v1/hipaa/*`, and `/api/v1/data-residency/*` returns
   `401`. Assert this by enumerating the router stack rather than listing paths by hand, so
   a route added later cannot quietly ship unguarded. `/health` and `/health/detailed`
   (`index.ts:128-180`) must remain reachable without auth.

5. **Authorization enforcement.** A valid token whose `roles` lack `compliance-auditor`
   receives `403` from `GET /api/v1/hipaa/phi-access`. Guards against authenticating
   everyone and then authorizing no one.

6. **Attribution is not forgeable.** `POST /api/v1/hipaa/phi-access` with
   `{"userId": "attacker-controlled"}` in the body, sent with a token for user `alice`,
   persists a row whose `user_id` is `alice`. Directly asserts Finding 3.

7. **No `'system'` attribution leaks.** `POST /api/v1/hipaa/baa` with a valid token persists
   `created_by` equal to that token's user. Catches the `req.user.id` / `req.user.userId`
   field mismatch, which would otherwise reproduce the current bug behind a passing auth
   check.

8. **Fail-closed startup.** With `NODE_ENV=production` and `HIPAA_ENCRYPTION_KEY` unset, the
   process exits non-zero and binds no port. With the key set, it starts. Also assert the
   string `default-key-change-in-production` appears nowhere in `services/`.

9. **Append-only enforcement.** `UPDATE phi_access_logs SET user_id = ...` and
   `DELETE FROM phi_access_logs` both raise, executed as the application role.

10. **Migration integrity.** `V002` applies cleanly onto a database at `V001`, and is
    idempotent under re-run. Add a CI check that every table name appearing in a SQL string
    literal under `services/compliance/src/` resolves to a table created by some migration —
    the check that would have caught Finding 1 at authoring time, and that keeps the schema
    and the fifteen call sites from drifting again.

11. **Logging cannot be bypassed.** A deliberately introduced ePHI read that circumvents the
    data-access layer fails the suite (ADR-0001 acceptance criterion 5). This is the only
    test that distinguishes an enforced control from a documented convention, and it is the
    one an auditor will ask to see.
