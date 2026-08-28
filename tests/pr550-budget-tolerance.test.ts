import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// T4 — budget gzip tolerance boundary (scripts/sidepanel-chunk-budget.mjs).
// `definitionFileOf` is unrelated; this validates the budget guardrail's exact
// comparison and the GZIP_ENCODER_VARIANCE_BYTES allowance WITHOUT modifying the
// script baseline. The real script is also executed separately (see report).

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(here, '../scripts/sidepanel-chunk-budget.mjs');
const scriptSrc = readFileSync(scriptPath, 'utf8');

const GZIP_ENCODER_VARIANCE_BYTES = 256;

// Faithful replication of assertBudget (scripts/sidepanel-chunk-budget.mjs:313).
function assertBudgetLike(actual: { raw: number; gzip: number }, budget: { raw: number; gzip: number }): boolean {
  return !(actual.raw > budget.raw || actual.gzip > budget.gzip);
}

describe('T4 budget gzip tolerance boundary', () => {
  it('script declares GZIP_ENCODER_VARIANCE_BYTES = 256 and uses strict `>` comparison', () => {
    expect(scriptSrc).toContain('GZIP_ENCODER_VARIANCE_BYTES = 256');
    expect(scriptSrc).toContain('actual.gzip > budget.gzip');
  });

  it('measurement == baseline + variance passes (green boundary)', () => {
    const baseline = { raw: 379_859, gzip: 116_182 };
    const budget = { raw: baseline.raw, gzip: baseline.gzip + GZIP_ENCODER_VARIANCE_BYTES };
    const actual = { raw: baseline.raw, gzip: baseline.gzip + GZIP_ENCODER_VARIANCE_BYTES };
    expect(assertBudgetLike(actual, budget)).toBe(true);
  });

  it('measurement == baseline + variance + 1 fails (over-budget by 1 byte)', () => {
    const baseline = { raw: 379_859, gzip: 116_182 };
    const budget = { raw: baseline.raw, gzip: baseline.gzip + GZIP_ENCODER_VARIANCE_BYTES };
    const actual = { raw: baseline.raw, gzip: baseline.gzip + GZIP_ENCODER_VARIANCE_BYTES + 1 };
    expect(assertBudgetLike(actual, budget)).toBe(false);
  });
});
