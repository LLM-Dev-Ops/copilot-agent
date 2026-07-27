/**
 * ADR-0002 Verification 1 -- pseudonym determinism.
 *
 * The old implementation generated a fresh random IV per call, so the same patientId
 * produced different ciphertext every time. Every assertion below fails against it.
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { HIPAAService } from '../src/services/hipaaService';
import { loadSecrets } from '../src/config/env';

const TEST_ENV = {
  NODE_ENV: 'test',
  HIPAA_ENCRYPTION_KEY: 'test-key-fixed-for-determinism',
  HIPAA_PSEUDONYM_SALT: 'test-salt-fixed-for-determinism',
  JWT_SECRET: 'test-jwt-secret',
};

function makeService(): HIPAAService {
  const secrets = loadSecrets(TEST_ENV as unknown as NodeJS.ProcessEnv);
  return new HIPAAService({} as never, {} as never, secrets);
}

describe('pseudonymize()', () => {
  it('returns byte-identical output for the same input across calls', () => {
    const svc = makeService();
    const a = svc.pseudonymize('PT-12345');
    const b = svc.pseudonymize('PT-12345');
    const c = svc.pseudonymize('PT-12345');

    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('returns a fixed 64-character hex digest, matching phi_access_logs.patient_id CHAR(64)', () => {
    const svc = makeService();
    const out = svc.pseudonymize('PT-12345');

    expect(out).toMatch(/^[0-9a-f]{64}$/);
    expect(out).toHaveLength(64);
  });

  it('is stable across separate service instances with the same key', () => {
    expect(makeService().pseudonymize('PT-12345')).toBe(makeService().pseudonymize('PT-12345'));
  });

  it('produces different output for different patients', () => {
    const svc = makeService();
    expect(svc.pseudonymize('PT-12345')).not.toBe(svc.pseudonymize('PT-99999'));
  });

  it('produces different output under a different key (the key really is a pepper)', () => {
    const other = loadSecrets({ ...TEST_ENV, HIPAA_ENCRYPTION_KEY: 'a-different-key' } as never);
    const svcOther = new HIPAAService({} as never, {} as never, other);

    expect(makeService().pseudonymize('PT-12345')).not.toBe(svcOther.pseudonymize('PT-12345'));
  });

  it('is not reversible: output contains no iv:ciphertext structure', () => {
    // The old scheme returned `${iv}:${ciphertext}` and was decryptable with the key.
    expect(makeService().pseudonymize('PT-12345')).not.toContain(':');
  });

  /**
   * The one that catches an accidental per-instance random salt: a fresh Node process,
   * same configured key, must produce the same digest. An in-process-only assertion
   * would pass even if the salt were randomised at module load.
   */
  it('returns the same value from a SEPARATE PROCESS with the same configured key', () => {
    const inProcess = makeService().pseudonymize('PT-12345');

    const script = `
      const { HIPAAService } = require(${JSON.stringify(path.join(__dirname, '../src/services/hipaaService'))});
      const { loadSecrets } = require(${JSON.stringify(path.join(__dirname, '../src/config/env'))});
      const secrets = loadSecrets(${JSON.stringify(TEST_ENV)});
      const svc = new HIPAAService({}, {}, secrets);
      process.stdout.write(svc.pseudonymize('PT-12345'));
    `;

    const out = execFileSync(
      'npx',
      ['ts-node', '--compiler-options', '{"module":"commonjs"}', '-e', script],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { ...process.env, ...TEST_ENV } }
    );

    expect(out.trim()).toBe(inProcess);
  });
});
