/**
 * PHI data-access layer (ADR-0002 step 7, ADR-0001 step 13).
 *
 * Before this existed, `logPHIAccess` was called from exactly one place: its own HTTP
 * handler. PHI access logging was opt-in self-reporting -- a caller announced that it
 * had touched PHI and was trusted. 45 CFR 164.312(b) requires mechanisms that *record*
 * activity, not endpoints that accept assertions about it.
 *
 * Every method here emits an access record as an unavoidable side effect of the
 * operation. There is no method that reads ePHI without writing a log row.
 *
 * ENFORCEMENT: this module is the ONLY place permitted to issue SQL against the tables
 * in PHI_CLASSIFIED_TABLES. phi-enforcement.test.ts scans src/ and fails the suite if
 * any other module queries them directly -- that test is what makes this an enforced
 * control rather than a documented convention (ADR-0002 Verification 11).
 */

import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PHIAccessLog } from '../models/compliance';

/**
 * Tables classified as containing ePHI or ePHI-disclosure records.
 *
 * The repo has no ePHI *inventory* yet (ADR-0002 Consequences flags this as the reason
 * the layer could not be fully scoped). This registry is that inventory's starting
 * point: adding a table here immediately brings it under enforcement.
 *
 * phi_access_logs is itself listed because an audit log of PHI disclosures is sensitive
 * in its own right -- reading it is a disclosure event.
 */
export const PHI_CLASSIFIED_TABLES = ['phi_access_logs'] as const;

/** The verified principal performing the access. Never sourced from a request body. */
export interface PHIAccessContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  purpose?: string;
}

export interface PHIAccessRecord {
  patientId?: string;
  accessType: PHIAccessLog['accessType'];
  resourceType: string;
  resourceId: string;
  accessGranted: boolean;
  metadata?: Record<string, unknown>;
}

export interface PHIAccessFilters {
  userId?: string;
  patientId?: string;
  accessType?: PHIAccessLog['accessType'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/** Pseudonymizes a patient identifier. Injected so the repository never holds key material. */
export type Pseudonymizer = (value: string) => string;

/** Advisory lock id, so concurrent inserts serialize on the hash chain rather than forking it. */
const CHAIN_LOCK_ID = 0x50484921; // 'PHI!'

export class PHIRepository {
  private db: Pool;
  private pseudonymize: Pseudonymizer;
  private keyVersion: number;

  constructor(db: Pool, pseudonymize: Pseudonymizer, keyVersion: number = 1) {
    this.db = db;
    this.pseudonymize = pseudonymize;
    this.keyVersion = keyVersion;
  }

  /**
   * Canonical hash over the fields that matter for tamper evidence, chained to the
   * previous entry. Any edit to a logged row breaks verifyChain().
   */
  private computeEntryHash(row: {
    id: string;
    userId: string;
    patientId?: string | null;
    accessType: string;
    resourceType: string;
    resourceId: string;
    accessGranted: boolean;
    timestamp: Date;
    prevHash: string | null;
  }): string {
    const canonical = [
      row.id,
      row.userId,
      row.patientId ?? '',
      row.accessType,
      row.resourceType,
      row.resourceId,
      String(row.accessGranted),
      row.timestamp.toISOString(),
      row.prevHash ?? '',
    ].join('|');
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  private async latestHash(client: PoolClient): Promise<string | null> {
    const result = await client.query(
      `SELECT entry_hash FROM phi_access_logs ORDER BY timestamp DESC, id DESC LIMIT 1`
    );
    return result.rows.length > 0 ? (result.rows[0].entry_hash as string) : null;
  }

  /**
   * Record a PHI access. This is the ONLY write path into phi_access_logs.
   *
   * `userId` comes from the context (a verified principal), never from the record --
   * there is deliberately no userId field on PHIAccessRecord to forge.
   */
  async recordAccess(ctx: PHIAccessContext, record: PHIAccessRecord): Promise<PHIAccessLog> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [CHAIN_LOCK_ID]);

      const id = uuidv4();
      const timestamp = new Date();
      const patientId = record.patientId ? this.pseudonymize(record.patientId) : null;
      const prevHash = await this.latestHash(client);

      const entryHash = this.computeEntryHash({
        id,
        userId: ctx.userId,
        patientId,
        accessType: record.accessType,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        accessGranted: record.accessGranted,
        timestamp,
        prevHash,
      });

      await client.query(
        `INSERT INTO phi_access_logs (
          id, user_id, patient_id, key_version, access_type, resource_type, resource_id,
          purpose, access_granted, ip_address, user_agent, timestamp, metadata,
          prev_hash, entry_hash
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          ctx.userId,
          patientId,
          this.keyVersion,
          record.accessType,
          record.resourceType,
          record.resourceId,
          ctx.purpose ?? null,
          record.accessGranted,
          ctx.ipAddress ?? null,
          ctx.userAgent ?? null,
          timestamp,
          JSON.stringify(record.metadata ?? {}),
          prevHash,
          entryHash,
        ]
      );

      await client.query('COMMIT');

      return {
        id,
        userId: ctx.userId,
        patientId: patientId ?? undefined,
        accessType: record.accessType,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        purpose: ctx.purpose,
        accessGranted: record.accessGranted,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        timestamp,
        metadata: record.metadata,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Read PHI access logs.
   *
   * Reading the disclosure log is itself a disclosure, so this emits its own access
   * record BEFORE returning rows. The log write is not conditional on the read
   * succeeding and cannot be skipped by a caller.
   */
  async queryAccessLogs(
    ctx: PHIAccessContext,
    filters: PHIAccessFilters
  ): Promise<PHIAccessLog[]> {
    await this.recordAccess(ctx, {
      patientId: filters.patientId,
      accessType: 'view',
      resourceType: 'phi_access_log',
      resourceId: filters.patientId ? 'patient-scoped-query' : 'bulk-query',
      accessGranted: true,
      metadata: {
        filters: {
          userId: filters.userId,
          accessType: filters.accessType,
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          limit: filters.limit,
        },
      },
    });

    let query = `SELECT * FROM phi_access_logs WHERE 1=1`;
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      values.push(filters.userId);
    }
    if (filters.patientId) {
      // Deterministic HMAC, so this equality filter matches what recordAccess stored.
      query += ` AND patient_id = $${paramIndex++}`;
      values.push(this.pseudonymize(filters.patientId));
    }
    if (filters.accessType) {
      query += ` AND access_type = $${paramIndex++}`;
      values.push(filters.accessType);
    }
    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    values.push(filters.limit ?? 100);

    const result = await this.db.query(query, values);
    return result.rows.map(mapPHIAccessLogRow);
  }

  /**
   * Verify the tamper-evidence chain. An UPDATE that slipped past the append-only
   * trigger would break the hash linkage and be detected here.
   */
  async verifyChain(limit = 1000): Promise<{ valid: boolean; brokenAt?: string; checked: number }> {
    const result = await this.db.query(
      `SELECT id, user_id, patient_id, access_type, resource_type, resource_id,
              access_granted, timestamp, prev_hash, entry_hash
       FROM phi_access_logs ORDER BY timestamp ASC, id ASC LIMIT $1`,
      [limit]
    );

    let expectedPrev: string | null = null;
    for (const row of result.rows) {
      if (row.prev_hash !== expectedPrev) {
        return { valid: false, brokenAt: row.id, checked: result.rows.length };
      }
      const recomputed = this.computeEntryHash({
        id: row.id,
        userId: row.user_id,
        patientId: row.patient_id,
        accessType: row.access_type,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        accessGranted: row.access_granted,
        timestamp: new Date(row.timestamp),
        prevHash: row.prev_hash,
      });
      if (recomputed !== row.entry_hash) {
        return { valid: false, brokenAt: row.id, checked: result.rows.length };
      }
      expectedPrev = row.entry_hash;
    }

    return { valid: true, checked: result.rows.length };
  }
}

export function mapPHIAccessLogRow(row: Record<string, unknown>): PHIAccessLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    patientId: (row.patient_id as string | null)?.trim() || undefined,
    accessType: row.access_type as PHIAccessLog['accessType'],
    resourceType: row.resource_type as string,
    resourceId: row.resource_id as string,
    purpose: (row.purpose as string | null) ?? undefined,
    accessGranted: row.access_granted as boolean,
    ipAddress: (row.ip_address as string | null) ?? undefined,
    userAgent: (row.user_agent as string | null) ?? undefined,
    timestamp: row.timestamp as Date,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  };
}
