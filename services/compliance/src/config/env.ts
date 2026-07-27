/**
 * Fail-closed configuration for the compliance service.
 *
 * ADR-0002 Finding 6: hipaaService.ts previously fell back to a hardcoded default key
 * literal with a hardcoded 'salt'. A production deploy
 * that forgot HIPAA_ENCRYPTION_KEY started cleanly and derived every PHI pseudonym
 * from a key published in this repository, with no log line.
 *
 * Nothing here defaults in production. A misconfigured deploy throws at startup,
 * fails its healthcheck, and rolls back.
 */

import crypto from 'crypto';

export interface ComplianceSecrets {
  /** Key material for the HMAC-SHA256 patient pseudonym. */
  pseudonymKey: Buffer;
  /** Version stamped onto every phi_access_logs row, for future key rotation. */
  keyVersion: number;
  /** Secret used to verify inbound JWTs. */
  jwtSecret: string;
  /** Shared secret for service-to-service PHI ingestion. */
  internalServiceKey?: string;
  apiKeyHeader: string;
  ephemeral: boolean;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function requireInProduction(name: string, value: string | undefined, isProduction: boolean): string | undefined {
  if (value && value.length > 0) return value;
  if (isProduction) {
    throw new ConfigurationError(
      `${name} must be set when NODE_ENV=production. The compliance service refuses to start ` +
        `without it: PHI pseudonyms derived from a default key are not pseudonyms. ` +
        `See docs/adr/ADR-0002-implement-phi-compliance-data-layer.md`
    );
  }
  return undefined;
}

export function loadSecrets(env: NodeJS.ProcessEnv = process.env): ComplianceSecrets {
  const isProduction = env.NODE_ENV === 'production';

  const encryptionKey = requireInProduction('HIPAA_ENCRYPTION_KEY', env.HIPAA_ENCRYPTION_KEY, isProduction);
  const pseudonymSalt = requireInProduction('HIPAA_PSEUDONYM_SALT', env.HIPAA_PSEUDONYM_SALT, isProduction);
  const jwtSecret = requireInProduction('JWT_SECRET', env.JWT_SECRET, isProduction);

  // Production returned above or threw; below here we are in dev/test.
  const ephemeral = !encryptionKey || !pseudonymSalt;

  if (ephemeral) {
    // eslint-disable-next-line no-console
    console.warn(
      '[compliance] HIPAA_ENCRYPTION_KEY/HIPAA_PSEUDONYM_SALT not set. Using an EPHEMERAL ' +
        'development key: patient pseudonyms will NOT be stable across restarts, and ' +
        'patient-scoped lookups will not match rows written by a previous process. ' +
        'Never use this configuration with real PHI.'
    );
  }

  const key = encryptionKey ?? crypto.randomBytes(32).toString('hex');
  const salt = pseudonymSalt ?? crypto.randomBytes(16).toString('hex');

  return {
    pseudonymKey: crypto.scryptSync(key, salt, 32),
    keyVersion: parseInt(env.HIPAA_KEY_VERSION || '1', 10),
    jwtSecret: jwtSecret ?? 'development-only-jwt-secret',
    internalServiceKey: env.INTERNAL_SERVICE_KEY,
    apiKeyHeader: env.API_KEY_HEADER || 'x-api-key',
    ephemeral,
  };
}
