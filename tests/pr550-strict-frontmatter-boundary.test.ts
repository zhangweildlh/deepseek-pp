import { describe, expect, it } from 'vitest';
import { parseLocalSkillDoc } from '../core/skill/local-importer';
import type { ParseSkillDocResult } from '../core/skill/local-importer';

// T1 — boundary blind spots of the strict local-import frontmatter parser
// `parseLocalSkillDoc` (core/skill/local-importer.ts). Each case assumes the
// implementation might silently misbehave (drop a violation, misclassify a
// rule) and asserts the precise contract; a failing assertion is evidence of a
// real bug at the cited source line.

function isFail(r: ParseSkillDocResult): boolean {
  return 'ok' in r;
}
function ruleIds(r: ParseSkillDocResult): string[] {
  return isFail(r) ? r.violations.map((v) => v.ruleId) : [];
}

describe('parseLocalSkillDoc — strict frontmatter boundary blind spots', () => {
  // T1a: whitespace-only name (`name:   `).
  // Task hypothesis claimed R-NAME-CHARSET (trimmed empty string fails charset).
  // Code reading (readString returns undefined for a trim()-empty string, so
  // the REQUIRED gate fires first) predicts R-NAME-REQUIRED. Assert the actual
  // behavior and report which rule the implementation emits.
  it('T1a whitespace-only name -> rejected (R-NAME-REQUIRED, not R-NAME-CHARSET)', () => {
    const doc = '---\nname:   \ndescription: a real description\n---\nbody text';
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(true);
    const ids = ruleIds(r);
    // If this fails, the implementation emits R-NAME-CHARSET instead of
    // R-NAME-REQUIRED — a consistency bug at local-importer.ts:944-947.
    expect(ids).toContain('R-NAME-REQUIRED');
  });

  // T1b: opening fence starting after line 25 (frontmatter start line > 25).
  // head = lines.slice(0, 25) (local-importer.ts:905), so a fence at line index
  // 25 (the 26th line) is outside the window and must yield R-FENCE.
  it('T1b opening fence beyond line 25 -> R-FENCE', () => {
    const filler = Array.from({ length: 25 }, (_, i) => `preamble-line-${i}`).join('\n');
    const doc = `${filler}\n---\nname: x\ndescription: y\n---\nbody text`;
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(true);
    expect(ruleIds(r)).toContain('R-FENCE');
  });

  // T1c: closing fence that is indented or has a trailing space must NOT be
  // recognized as a top-level standalone `---` (local-importer.ts:917-922).
  it('T1c indented closing fence "  ---" -> R-FENCE', () => {
    const doc = '---\nname: x\ndescription: y\n  ---\nbody text';
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(true);
    expect(ruleIds(r)).toContain('R-FENCE');
  });

  it('T1c trailing-space closing fence "--- " -> R-FENCE', () => {
    const doc = '---\nname: x\ndescription: y\n--- \nbody text';
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(true);
    expect(ruleIds(r)).toContain('R-FENCE');
  });

  // T1d: `description:` whose value is only whitespace -> R-DESC-REQUIRED.
  it('T1d whitespace-only description -> R-DESC-REQUIRED', () => {
    const doc = '---\nname: x\ndescription:   \n---\nbody text';
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(true);
    expect(ruleIds(r)).toContain('R-DESC-REQUIRED');
  });

  // T1e: multiple violations must ALL surface. Note: "missing name"
  // (R-NAME-REQUIRED) and "Chinese name" (R-NAME-CHARSET) are mutually
  // exclusive in this implementation (readString returns undefined for a
  // missing name, so only one of the two can ever fire). To still exercise the
  // "all violations surface" contract with two DISTINCT rule ids, we use a
  // Chinese name (R-NAME-CHARSET) + missing description (R-DESC-REQUIRED). The
  // indented `note:` / `version:` below are legitimate children of `description:`
  // (a nested block), so R-FIELD-INDENT must NOT fire here.
  it('T1e multiple violations surface all distinct ruleIds', () => {
    const doc = [
      '---',
      'name: 测试',
      'description:',
      '  note: x',
      '  version: 1.0',
      '---',
      'body text',
    ].join('\n');
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(true);
    const ids = ruleIds(r);
    expect(ids).toContain('R-NAME-CHARSET'); // `name: 测试` non-ASCII
    expect(ids).toContain('R-DESC-REQUIRED'); // `description:` nested -> undefined
    // Indented `note:` / `version:` are legitimate children of `description:`,
    // NOT misaligned top-level fields — R-FIELD-INDENT must NOT fire here.
    expect(ids).not.toContain('R-FIELD-INDENT');
  });

  // T1f: success branch must extract version / lastUpdated from the metadata block.
  it('T1f success extracts version + lastUpdated from metadata', () => {
    const doc = [
      '---',
      'name: x',
      'description: y',
      'metadata:',
      '  version: 1.2.3',
      '  last_updated: 2024-01-01',
      '---',
      'body text',
    ].join('\n');
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(false);
    if (isFail(r)) throw new Error('unexpected failure');
    expect(r.name).toBe('x');
    expect(r.description).toBe('y');
    expect(r.version).toBe('1.2.3');
    expect(r.lastUpdated).toBe('2024-01-01');
    expect(r.body).toBe('body text');
  });

  // T1g: CRLF line endings must parse (or fail consistently with R-FENCE).
  it('T1g CRLF line endings parse successfully', () => {
    const doc = '---\r\nname: x\r\ndescription: y\r\n---\r\nbody text\r\n';
    const r = parseLocalSkillDoc(doc, 'SKILL.md');
    expect(isFail(r)).toBe(false);
    if (isFail(r)) throw new Error('unexpected failure');
    expect(r.name).toBe('x');
    expect(r.description).toBe('y');
    expect(r.body).toBe('body text');
  });

  // T1h: success vs failure branch discriminator is `'ok' in result`.
  it('T1h success branch has no `ok`; failure branch has `ok:false`', () => {
    const ok = parseLocalSkillDoc('---\nname: x\ndescription: y\n---\nbody', 'SKILL.md');
    expect('ok' in ok).toBe(false);
    const fail = parseLocalSkillDoc('---\ndescription: y\n---\nbody', 'SKILL.md');
    expect('ok' in fail).toBe(true);
    if ('ok' in fail) expect(fail.ok).toBe(false);
  });

  // T1i: a genuinely misaligned `name:` / `description:` (leading space) must
  // still be rejected with R-FIELD-INDENT — the nested-block exemption must not
  // let real top-level misalignment slip through. See the iteration-1 fix for
  // R-FIELD-INDENT (only `name` / `description` keys are gated, not nested
  // block children such as `metadata:` -> `version:` / `last_updated:`).
  it('T1i indented name / description key -> R-FIELD-INDENT', () => {
    const indentedName = '---\n  name: x\ndescription: y\n---\nbody';
    const r1 = parseLocalSkillDoc(indentedName, 'SKILL.md');
    expect(isFail(r1)).toBe(true);
    expect(ruleIds(r1)).toContain('R-FIELD-INDENT');
    const indentedDesc = '---\nname: x\n  description: y\n---\nbody';
    const r2 = parseLocalSkillDoc(indentedDesc, 'SKILL.md');
    expect(isFail(r2)).toBe(true);
    expect(ruleIds(r2)).toContain('R-FIELD-INDENT');
  });
});
