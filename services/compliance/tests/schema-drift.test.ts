/**
 * ADR-0002 Verification 10 (second half) -- schema/call-site drift.
 *
 * "Add a CI check that every table name appearing in a SQL string literal under
 * services/compliance/src/ resolves to a table created by some migration -- the check
 * that would have caught Finding 1 at authoring time."
 *
 * Finding 1 was fifteen tables queried by code and defined by no migration. This test is
 * what makes that condition impossible to reintroduce.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '../src');
const MIGRATIONS = path.join(__dirname, '../../../migrations');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Table names created by any migration in migrations/. */
function migratedTables(): Set<string> {
  const tables = new Set<string>();
  for (const file of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)/gi)) {
      tables.add(m[1].toLowerCase());
    }
  }
  return tables;
}

/**
 * Marks a string literal as SQL rather than prose. Without this, English like
 * "Update control status" in the API documentation block parses as `UPDATE control`.
 */
const LOOKS_LIKE_SQL = /\bSELECT\s+[\s\S]*\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b/i;

/** Extracts string literals (template, single, double) from TypeScript source. */
function stringLiterals(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`|'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return out;
}

/** Table names referenced from SQL string literals in the service source. */
function referencedTables(): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const file of sourceFiles(SRC)) {
    const code = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const literal of stringLiterals(code)) {
      if (!LOOKS_LIKE_SQL.test(literal)) continue;

      for (const m of literal.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/gi)) {
        const table = m[1].toLowerCase();
        // Keywords that can legitimately follow FROM/UPDATE inside an expression.
        if (['select', 'where', 'set', 'values', 'jsonb', 'to_jsonb'].includes(table)) continue;
        if (!refs.has(table)) refs.set(table, []);
        refs.get(table)!.push(path.relative(SRC, file));
      }
    }
  }
  return refs;
}

describe('Verification 10: schema and call sites do not drift', () => {
  it('finds the migrations directory and the tables it creates', () => {
    const tables = migratedTables();
    expect(tables.size).toBeGreaterThan(20);
    expect(tables).toContain('users');
  });

  it('creates all fifteen compliance tables named in ADR-0002 Finding 1', () => {
    const tables = migratedTables();
    const required = [
      'phi_access_logs', 'business_associate_agreements', 'scheduled_tasks',
      'hipaa_breaches', 'security_alerts', 'compliance_controls', 'compliance_audits',
      'compliance_findings', 'compliance_reports', 'compliance_audit_log',
      'data_residency_policies', 'data_assets', 'data_transfer_requests',
      'notifications', 'data_residency_events',
    ];

    const missing = required.filter(t => !tables.has(t));
    expect(missing).toEqual([]);
  });

  it('resolves every table referenced in service SQL to a migration', () => {
    const migrated = migratedTables();
    const unresolved: string[] = [];

    for (const [table, files] of referencedTables()) {
      if (!migrated.has(table)) {
        unresolved.push(`'${table}' referenced in ${[...new Set(files)].join(', ')} but created by no migration`);
      }
    }

    expect(unresolved).toEqual([]);
  });

  it('DETECTS a query against a table no migration creates', () => {
    // Negative case: proves the check above is not vacuous.
    const probe = path.join(SRC, 'services', '__drift_probe__.ts');
    fs.writeFileSync(probe, 'export const q = `SELECT id FROM table_that_does_not_exist`;');

    try {
      const migrated = migratedTables();
      const unresolved = [...referencedTables().keys()].filter(t => !migrated.has(t));
      expect(unresolved).toContain('table_that_does_not_exist');
    } finally {
      fs.unlinkSync(probe);
    }
  });
});
