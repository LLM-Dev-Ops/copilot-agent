/**
 * ADR-0002 Verification 11 -- logging cannot be bypassed.
 *
 * "A deliberately introduced ePHI read that circumvents the data-access layer fails the
 * suite. This is the only test that distinguishes an enforced control from a documented
 * convention, and it is the one an auditor will ask to see."
 *
 * The mechanism: PHIRepository is the only module permitted to issue SQL against a
 * PHI-classified table. Any other module that queries one is a bypass, and fails here.
 */

import fs from 'fs';
import path from 'path';
import { PHI_CLASSIFIED_TABLES } from '../src/data/phiRepository';

const SRC = path.join(__dirname, '../src');
const REPOSITORY = path.join(SRC, 'data/phiRepository.ts');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Strips comments so a table named in prose is not mistaken for a query. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function findBypasses(files: string[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    if (path.resolve(file) === path.resolve(REPOSITORY)) continue;

    const code = stripComments(fs.readFileSync(file, 'utf8'));
    for (const table of PHI_CLASSIFIED_TABLES) {
      // SQL touching a PHI-classified table: FROM/INTO/UPDATE/JOIN <table>
      const sql = new RegExp(`(FROM|INTO|UPDATE|JOIN)\\s+${table}\\b`, 'i');
      if (sql.test(code)) {
        violations.push(`${path.relative(SRC, file)} queries '${table}' directly`);
      }
    }
  }
  return violations;
}

describe('Verification 11: PHI logging cannot be bypassed', () => {
  it('registers phi_access_logs as PHI-classified', () => {
    expect(PHI_CLASSIFIED_TABLES).toContain('phi_access_logs');
  });

  it('has no module outside PHIRepository querying a PHI-classified table', () => {
    expect(findBypasses(sourceFiles(SRC))).toEqual([]);
  });

  /**
   * The negative case. Without this, the test above would pass vacuously if the detector
   * were broken -- which is exactly how an "enforced control" silently becomes a
   * documented convention.
   */
  it('DETECTS a deliberately introduced ePHI read that circumvents the layer', () => {
    const smuggled = path.join(SRC, 'services', '__bypass_probe__.ts');
    fs.writeFileSync(
      smuggled,
      `import { Pool } from 'pg';
       export async function sneakyRead(db: Pool) {
         return db.query('SELECT patient_id FROM phi_access_logs LIMIT 10');
       }`
    );

    try {
      const violations = findBypasses(sourceFiles(SRC));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('__bypass_probe__.ts');
      expect(violations[0]).toContain('phi_access_logs');
    } finally {
      fs.unlinkSync(smuggled);
    }

    // And the tree is clean again once the bypass is removed.
    expect(findBypasses(sourceFiles(SRC))).toEqual([]);
  });

  it('routes hipaaService PHI access through the repository, not raw SQL', () => {
    const src = stripComments(
      fs.readFileSync(path.join(SRC, 'services/hipaaService.ts'), 'utf8')
    );
    expect(src).toContain('this.phi.recordAccess');
    expect(src).toContain('this.phi.queryAccessLogs');
    expect(src).not.toMatch(/INSERT INTO phi_access_logs/i);
  });

  it('gives PHIAccessRecord no userId field for a caller to forge', () => {
    const src = fs.readFileSync(REPOSITORY, 'utf8');
    const iface = src.slice(
      src.indexOf('export interface PHIAccessRecord'),
      src.indexOf('export interface PHIAccessFilters')
    );
    expect(iface).not.toContain('userId');
  });
});
