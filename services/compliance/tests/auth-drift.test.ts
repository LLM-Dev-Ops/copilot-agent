/**
 * Guards the one deviation this change makes from ADR-0002 step 5.
 *
 * The ADR says to promote services/billing/src/middleware/auth.ts to a location both
 * services import, and warns: "Do not fork it; a second copy of authentication logic is
 * how the two drift." It also permits services/compliance/src/middleware/auth.ts "if
 * extraction is deferred".
 *
 * The repo has no monorepo tooling -- no workspaces, and each service's tsconfig sets
 * rootDir: ./src, so TypeScript will not compile a file outside it. Building shared-
 * package infrastructure across eleven services is well beyond this ADR, so extraction
 * is deferred and the copy taken.
 *
 * These tests are the mitigation for the drift the ADR warns about: they fail loudly if
 * billing changes the contract compliance depends on.
 */

import fs from 'fs';
import path from 'path';

const BILLING = path.join(__dirname, '../../billing/src/middleware/auth.ts');
const COMPLIANCE = path.join(__dirname, '../src/middleware/auth.ts');

const billingSrc = fs.readFileSync(BILLING, 'utf8');
const complianceSrc = fs.readFileSync(COMPLIANCE, 'utf8');

describe('auth middleware drift guard', () => {
  it('billing still names the principal field `userId`, not `id`', () => {
    // ADR-0002 Finding 4's trap: the compliance routes used to read `req.user?.id`, which
    // AuthenticatedUser does not have, so every record was attributed to 'system'. If
    // billing ever renames this field, compliance's `req.user.userId` silently breaks
    // the same way -- so assert the contract rather than trusting it.
    const iface = billingSrc.slice(
      billingSrc.indexOf('export interface AuthenticatedUser'),
      billingSrc.indexOf('export interface AuthenticatedRequest')
    );
    expect(iface).toMatch(/^\s*userId:\s*string;/m);
    expect(iface).not.toMatch(/^\s*id:\s*string;/m);
  });

  it('both copies declare the same AuthenticatedUser shape', () => {
    const extract = (src: string): string[] => {
      const iface = src.slice(
        src.indexOf('export interface AuthenticatedUser'),
        src.indexOf('export interface AuthenticatedRequest')
      );
      return [...iface.matchAll(/^\s*(\w+):/gm)].map(m => m[1]).sort();
    };
    expect(extract(complianceSrc)).toEqual(extract(billingSrc));
  });

  it('compliance exports every guard the ADR mounts', () => {
    for (const fn of ['authenticate', 'authorize', 'requireAdmin', 'authenticateInternal']) {
      expect(complianceSrc).toMatch(new RegExp(`export function ${fn}\\b`));
    }
  });

  it('authorize() applies the same role-matching rule in both copies', () => {
    const rule = /const hasRole = req\.user\.roles\.some\(role => allowedRoles\.includes\(role\)\);/;
    expect(billingSrc).toMatch(rule);
    expect(complianceSrc).toMatch(rule);
  });

  it('both reject a missing or non-Bearer Authorization header', () => {
    const check = /if \(!authHeader \|\| !authHeader\.startsWith\('Bearer '\)\) \{/;
    expect(billingSrc).toMatch(check);
    expect(complianceSrc).toMatch(check);
  });

  it("documents that compliance's authenticateInternal intentionally diverges", () => {
    // Billing's version synthesises `userId: 'system'`. Compliance must not: an audit
    // record must name a real user, since phi_access_logs.user_id is a FK to users(id).
    const code = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code(billingSrc)).toMatch(/userId: 'system'/);
    // Checked against code with comments stripped -- compliance's auth.ts explains this
    // divergence in prose, which would otherwise match.
    expect(code(complianceSrc)).not.toMatch(/userId: 'system'/);
    expect(complianceSrc).toMatch(/does NOT synthesise/);
  });
});
