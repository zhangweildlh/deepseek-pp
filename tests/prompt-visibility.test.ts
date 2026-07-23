import { describe, expect, it } from 'vitest';
import {
  markVisibleUserPrompt,
  sanitizeInternalPromptText,
} from '../core/prompt/visibility';

describe('prompt visibility cleanup', () => {
  it('restores only the real English user input from a wrapped Skill prompt', () => {
    const visiblePrompt = [
      'Follow the private Skill instructions.',
      '',
      '---',
      '',
      'The following is the user input for this turn. Follow the instructions above when handling it:',
      '',
      'Inspect the project folder.',
    ].join('\n');

    expect(sanitizeInternalPromptText(markVisibleUserPrompt(visiblePrompt)))
      .toBe('Inspect the project folder.');
  });

  it('restores only the real Chinese user input from a wrapped Skill prompt', () => {
    const visiblePrompt = [
      '遵循内部 Skill 指令。',
      '',
      '---',
      '',
      '以下是用户本次的输入，请根据上述指令处理：',
      '',
      '查看 MultimodalMutationsPDAC 目录',
    ].join('\n');

    expect(sanitizeInternalPromptText(markVisibleUserPrompt(visiblePrompt)))
      .toBe('查看 MultimodalMutationsPDAC 目录');
  });

  it('uses the last wrapper boundary for composed Skills and preserves ordinary prompts', () => {
    const composedPrompt = [
      'First Skill instructions.',
      '',
      '---',
      '',
      'Second Skill instructions.',
      '',
      '---',
      '',
      'The following is the user input for this turn. Follow the instructions above when handling it:',
      '',
      'Audit the final state.',
    ].join('\n');

    expect(sanitizeInternalPromptText(markVisibleUserPrompt(composedPrompt)))
      .toBe('Audit the final state.');
    expect(sanitizeInternalPromptText(markVisibleUserPrompt('Keep this exact user prompt.')))
      .toBe('Keep this exact user prompt.');
  });
});
