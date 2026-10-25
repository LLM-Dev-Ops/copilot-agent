#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [targetArg, toolingArg, outArg] = process.argv.slice(2);
if (!targetArg || !toolingArg) {
  console.error('usage: evaluate-function-boundary.mjs <target> <tooling> [out.json]');
  process.exit(2);
}

const target = resolve(targetArg);
const tooling = resolve(toolingArg);
const read = (path) => readFileSync(resolve(target, path), 'utf8');
const cors = read('functions/src/cors.ts');
const handler = read('functions/src/index.ts');
const router = read('functions/src/router.ts');
const jestConfig = resolve(target, 'functions/jest.config.js');
const jestBin = resolve(tooling, 'functions/node_modules/jest/bin/jest.js');
const test = spawnSync(process.execPath, [
  jestBin,
  '--config',
  jestConfig,
  '--runInBand',
], {
  cwd: resolve(target, 'functions'),
  encoding: 'utf8',
  env: { ...process.env, CI: 'true' },
  timeout: 120_000,
});
const output = `${test.stdout ?? ''}\n${test.stderr ?? ''}`;
const summary = output.match(/^(?:Test Suites|Tests|Snapshots|Time):.*$/gm) ?? [];

const holdout = {
  jest_suite_passes: test.status === 0,
  approved_origin_is_exact: cors.includes("ALLOWED_ORIGINS.has(origin)") &&
    cors.includes("setHeader('Access-Control-Allow-Origin', origin)"),
  unknown_origin_not_granted: !cors.includes("setHeader('Access-Control-Allow-Origin', '*')"),
  api_key_survives_preflight: cors.includes('X-Anthropic-Api-Key'),
  internal_errors_are_sanitized: handler.includes("{ error: 'Internal server error' }") &&
    !handler.includes('{ error: errorMessage }'),
  request_url_ignores_host_header: handler.includes("'https://copilot.invalid'") &&
    !handler.includes('req.headers.host'),
};
const anchors = {
  iam_only_deployment_preserved: handler.includes('--no-allow-unauthenticated'),
  ruvector_persistence_preserved: router.includes('createRuvectorFromEnv'),
};
const count = (values) => values.filter(Boolean).length;
const report = {
  target,
  test: { exit_code: test.status, signal: test.signal, summary },
  holdout: {
    passed: count(Object.values(holdout)),
    total: Object.keys(holdout).length,
    checks: holdout,
  },
  anchors: {
    passed: count(Object.values(anchors)),
    total: Object.keys(anchors).length,
    checks: anchors,
  },
};
const json = JSON.stringify(report, null, 2);
if (outArg) writeFileSync(resolve(outArg), `${json}\n`);
console.log(json);
process.exit(report.holdout.passed === report.holdout.total &&
  report.anchors.passed === report.anchors.total ? 0 : 1);
