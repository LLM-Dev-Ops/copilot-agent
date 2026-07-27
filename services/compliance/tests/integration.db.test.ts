/**
 * ADR-0002 Verification 2, 3, 9, 10 -- integration against a real PostgreSQL database.
 *
 * Requires TEST_DATABASE_URL pointing at a database with V001 and V002 applied.
 * Skips (loudly) when unset, so the unit suite still runs without a database.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
 *     -e POSTGRES_DB=compliance_test -p 5432:5432 postgres:16-alpine
 *   psql -f migrations/V001_initial_schema.sql
 *   psql -f migrations/V002_compliance_schema.sql
 *   TEST_DATABASE_URL=postgres://test:test@localhost:5432/compliance_test npx jest
 */

import { Pool } from 'pg';
import { HIPAAService } from '../src/services/hipaaService';
import { PHIAccessContext } from '../src/data/phiRepository';
import { loadSecrets } from '../src/config/env';

const URL = process.env.TEST_DATABASE_URL;
const describeDb = URL ? describe : describe.skip;

if (!URL) {
  // eslint-disable-next-line no-console
  console.warn('\n[skip] TEST_DATABASE_URL unset -- skipping PostgreSQL integration tests.\n');
}

const TEST_ENV = {
  NODE_ENV: 'test',
  HIPAA_ENCRYPTION_KEY: 'integration-key',
  HIPAA_PSEUDONYM_SALT: 'integration-salt',
  JWT_SECRET: 'integration-jwt',
};

const USERS = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
];

describeDb('PostgreSQL integration', () => {
  let db: Pool;
  let hipaa: HIPAAService;

  const ctxFor = (userId: string): PHIAccessContext => ({
    userId,
    ipAddress: '10.0.0.1',
    userAgent: 'jest',
    purpose: 'integration test',
  });

  beforeAll(async () => {
    db = new Pool({ connectionString: URL });
    const redis = { incr: async () => 1, expire: async () => 1, publish: async () => 1 };
    hipaa = new HIPAAService(db, redis as never, loadSecrets(TEST_ENV as never));

    for (const [i, id] of USERS.entries()) {
      await db.query(
        `INSERT INTO users (id, email, username, password_hash)
         VALUES ($1, $2, $3, 'x') ON CONFLICT (id) DO NOTHING`,
        [id, `u${i}@test.io`, `user${i}`]
      );
    }
  });

  afterAll(async () => {
    await db.end();
  });

  // -------------------------------------------------------------------------
  // Verification 2 -- round-trip patient lookup
  // -------------------------------------------------------------------------

  it('round-trips a patient-scoped PHI access record (Verification 2)', async () => {
    const patientId = `PT-${Date.now()}`;

    await hipaa.logPHIAccess({
      userId: USERS[0],
      patientId,
      accessType: 'view',
      resourceType: 'Patient',
      resourceId: 'chart-1',
      accessGranted: true,
      purpose: 'treatment',
    });

    const logs = await hipaa.getPHIAccessLogs(ctxFor(USERS[0]), { patientId });

    // Fails today for two independent reasons: missing table, non-deterministic pseudonym.
    const chartReads = logs.filter(l => l.resourceId === 'chart-1');
    expect(chartReads).toHaveLength(1);
    expect(chartReads[0].userId).toBe(USERS[0]);
    expect(chartReads[0].patientId).toMatch(/^[0-9a-f]{64}$/);
    // The raw identifier is never stored.
    expect(chartReads[0].patientId).not.toBe(patientId);
  });

  it('stores a pseudonym, never the raw patient identifier', async () => {
    const patientId = `PT-RAW-${Date.now()}`;
    await hipaa.logPHIAccess({
      userId: USERS[0],
      patientId,
      accessType: 'view',
      resourceType: 'Patient',
      resourceId: 'raw-check',
      accessGranted: true,
    });

    const raw = await db.query(`SELECT count(*)::int AS n FROM phi_access_logs WHERE patient_id = $1`, [patientId]);
    expect(raw.rows[0].n).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Verification 3 -- disclosure accounting
  // -------------------------------------------------------------------------

  it('reports uniquePatients:1 and uniqueUsers:4 for 20 accesses by 4 users (Verification 3)', async () => {
    const patientId = `PT-ACCT-${Date.now()}`;
    const start = new Date(Date.now() - 60_000);

    for (let i = 0; i < 20; i++) {
      await hipaa.logPHIAccess({
        userId: USERS[i % 4],
        patientId,
        accessType: 'view',
        resourceType: 'Patient',
        resourceId: `acct-${i}`,
        accessGranted: true,
      });
    }

    const report = await hipaa.generateAccessReport(ctxFor(USERS[0]), {
      startDate: start,
      endDate: new Date(Date.now() + 60_000),
      patientId,
    });

    // Was 20 under the random-IV scheme: every access counted as a distinct patient,
    // making 45 CFR 164.528 disclosure accounting impossible.
    expect(report.summary.uniquePatients).toBe(1);
    expect(report.summary.uniqueUsers).toBe(4);
    expect(report.summary.totalAccesses).toBeGreaterThanOrEqual(20);
  });

  // -------------------------------------------------------------------------
  // Enforced logging -- the read is itself logged
  // -------------------------------------------------------------------------

  it('records a disclosure event when the PHI access log is read', async () => {
    const before = await db.query(`SELECT count(*)::int AS n FROM phi_access_logs`);
    await hipaa.getPHIAccessLogs(ctxFor(USERS[1]), { limit: 5 });
    const after = await db.query(`SELECT count(*)::int AS n FROM phi_access_logs`);

    // Reading the disclosure log is itself a disclosure. The caller cannot skip it.
    expect(after.rows[0].n).toBe(before.rows[0].n + 1);
  });

  // -------------------------------------------------------------------------
  // Verification 9 -- append-only enforcement
  // -------------------------------------------------------------------------

  it('rejects UPDATE on phi_access_logs (Verification 9)', async () => {
    await expect(
      db.query(`UPDATE phi_access_logs SET user_id = $1`, [USERS[0]])
    ).rejects.toThrow(/append-only/i);
  });

  it('rejects DELETE on phi_access_logs (Verification 9)', async () => {
    await expect(db.query(`DELETE FROM phi_access_logs`)).rejects.toThrow(/append-only/i);
  });

  it('leaves the rows intact after a rejected mutation', async () => {
    const before = await db.query(`SELECT count(*)::int AS n FROM phi_access_logs`);
    await db.query(`DELETE FROM phi_access_logs`).catch(() => undefined);
    const after = await db.query(`SELECT count(*)::int AS n FROM phi_access_logs`);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  // -------------------------------------------------------------------------
  // Tamper evidence
  // -------------------------------------------------------------------------

  it('maintains a verifiable hash chain across entries', async () => {
    const result = await hipaa.phiRepository.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.checked).toBeGreaterThan(0);
  });

  it('chains each entry to its predecessor', async () => {
    const rows = await db.query(
      `SELECT prev_hash, entry_hash FROM phi_access_logs ORDER BY timestamp ASC, id ASC LIMIT 5`
    );
    expect(rows.rows.length).toBeGreaterThan(1);
    for (let i = 1; i < rows.rows.length; i++) {
      expect(rows.rows[i].prev_hash).toBe(rows.rows[i - 1].entry_hash);
    }
  });

  // -------------------------------------------------------------------------
  // The other fourteen tables actually accept the service's writes
  // -------------------------------------------------------------------------

  it('accepts a BAA write and appends documents without nulling the column', async () => {
    const baa = await hipaa.createBAA(
      {
        vendorId: `v-${Date.now()}`,
        vendorName: 'Test Vendor',
        agreementType: 'baa',
        effectiveDate: new Date(),
        expirationDate: new Date(Date.now() + 86400_000 * 365),
        autoRenew: false,
        terms: { permittedUses: ['treatment'], subcontractorAllowed: false, breachNotificationHours: 24 },
        contacts: [{ name: 'C', email: 'c@v.io', role: 'privacy', isPrimary: true }],
      },
      USERS[0]
    );

    await hipaa.addBAADocument(baa.id, { name: 'agreement.pdf', url: 'https://x/y' });
    const after = await hipaa.getBAA(baa.id);

    // `documents || $1::jsonb` returns NULL on a NULL left operand; the column is
    // JSONB NOT NULL DEFAULT '[]' precisely so this cannot silently erase the list.
    expect(after!.documents).toHaveLength(1);
  });

  it('accepts a breach report with TEXT[] array parameters', async () => {
    const breach = await hipaa.reportBreach({
      discoveryDate: new Date(),
      affectedIndividuals: 600,
      phiTypes: ['name', 'ssn', 'diagnosis'],
      description: 'Integration test breach',
      containmentActions: ['isolated', 'rotated-keys'],
      reportedBy: USERS[0],
    });

    expect(breach.hhsNotificationRequired).toBe(true);

    const row = await db.query(
      `SELECT phi_types, containment_actions FROM hipaa_breaches WHERE id = $1`,
      [breach.id]
    );
    expect(row.rows[0].phi_types).toEqual(['name', 'ssn', 'diagnosis']);
    expect(row.rows[0].containment_actions).toEqual(['isolated', 'rotated-keys']);
  });

  /**
   * Must run after the chain assertions above: it deliberately corrupts the chain.
   * Without this test, the verifyChain assertion above could pass vacuously.
   */
  it('DETECTS a forged entry whose hash does not match its contents', async () => {
    expect((await hipaa.phiRepository.verifyChain()).valid).toBe(true);

    // A row inserted outside the repository, with a hash that does not cover its
    // contents -- what an attacker with INSERT rights but no key would produce.
    await db.query(
      `INSERT INTO phi_access_logs
         (id, user_id, patient_id, access_type, resource_type, resource_id,
          access_granted, timestamp, prev_hash, entry_hash)
       VALUES (gen_random_uuid(), $1, $2, 'view', 'Patient', 'forged', true, NOW(), NULL, $3)`,
      [USERS[0], 'f'.repeat(64), 'b'.repeat(64)]
    );

    const result = await hipaa.phiRepository.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBeDefined();
  });

  it('runs the HIPAA assessment query against compliance_controls', async () => {
    // hipaaService.ts:613-616 joins on control_id against identifiers like '164.308(a)(1)',
    // which is why the table needs a surrogate id AND a distinct control_id.
    await db.query(
      `INSERT INTO compliance_controls (framework, control_id, name, description, category, status, owner)
       VALUES ('hipaa','164.308(a)(1)','Risk Analysis','d','risk_management','implemented','o')
       ON CONFLICT (framework, control_id) DO NOTHING`
    );

    const assessment = await hipaa.assessHIPAACompliance();
    expect(assessment.overallScore).toBeGreaterThan(0);
    expect(assessment.gaps.length).toBeGreaterThan(0);
  });
});
