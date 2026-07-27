/**
 * ADR-0002 Verification 8 -- fail-closed startup.
 *
 * A production deploy that forgets HIPAA_ENCRYPTION_KEY must exit non-zero and bind no
 * port, rather than starting cleanly and deriving every PHI pseudonym from a key
 * published in this repository.
 */

import fs from 'fs';
import path from 'path';
import { loadSecrets, ConfigurationError } from '../src/config/env';

const PROD_BASE = {
  NODE_ENV: 'production',
  HIPAA_ENCRYPTION_KEY: 'a-real-key',
  HIPAA_PSEUDONYM_SALT: 'a-real-salt',
  JWT_SECRET: 'a-real-jwt-secret',
};

describe('Verification 8: fail-closed startup', () => {
  it('throws in production when HIPAA_ENCRYPTION_KEY is unset', () => {
    const env = { ...PROD_BASE, HIPAA_ENCRYPTION_KEY: undefined };
    expect(() => loadSecrets(env as never)).toThrow(ConfigurationError);
    expect(() => loadSecrets(env as never)).toThrow(/HIPAA_ENCRYPTION_KEY/);
  });

  it('throws in production when HIPAA_PSEUDONYM_SALT is unset', () => {
    expect(() => loadSecrets({ ...PROD_BASE, HIPAA_PSEUDONYM_SALT: undefined } as never))
      .toThrow(/HIPAA_PSEUDONYM_SALT/);
  });

  it('throws in production when JWT_SECRET is unset', () => {
    // A default JWT secret on a PHI API means anyone can mint a valid token, so this
    // fails closed too even though ADR-0002 step 4 names only the two HIPAA variables.
    expect(() => loadSecrets({ ...PROD_BASE, JWT_SECRET: undefined } as never))
      .toThrow(/JWT_SECRET/);
  });

  it('throws on an empty-string key, not just an absent one', () => {
    expect(() => loadSecrets({ ...PROD_BASE, HIPAA_ENCRYPTION_KEY: '' } as never))
      .toThrow(ConfigurationError);
  });

  it('starts in production when every key is set', () => {
    const secrets = loadSecrets(PROD_BASE as never);
    expect(secrets.pseudonymKey).toHaveLength(32);
    expect(secrets.ephemeral).toBe(false);
  });

  it('permits an ephemeral key outside production, and flags it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const secrets = loadSecrets({ NODE_ENV: 'development' } as never);

    expect(secrets.ephemeral).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/EPHEMERAL/));
    warn.mockRestore();
  });

  it("has no 'default-key-change-in-production' string anywhere under services/", () => {
    const root = path.join(__dirname, '../..');
    const hits: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        // tests/ is excluded: this file necessarily names the literal it asserts is absent.
        if (['node_modules', 'dist', 'tests'].includes(entry.name) || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|js|json|yaml|yml|env|example)$/.test(entry.name)) {
          if (fs.readFileSync(full, 'utf8').includes('default-key-change-in-production')) {
            hits.push(path.relative(root, full));
          }
        }
      }
    };

    walk(root);
    expect(hits).toEqual([]);
  });

  it("has no hardcoded scryptSync(..., 'salt', ...) left in hipaaService", () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/services/hipaaService.ts'), 'utf8');
    expect(src).not.toMatch(/scryptSync\([^)]*'salt'/);
  });
});
