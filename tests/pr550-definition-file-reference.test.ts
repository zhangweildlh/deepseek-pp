import { describe, expect, it } from 'vitest';
import { augmentDecodedRequestBody, type RequestAugmentationState } from '../core/interceptor/request-augmentation';
import { LOCAL_INDEX_MARKER } from '../core/skill/local-importer';

// T2 — `definitionFileOf` (core/interceptor/request-augmentation.ts:330) is NOT
// exported, so we test it INDIRECTLY: build a local index skill (source:'remote'
// + remote.provider:'local' + instructions carrying LOCAL_INDEX_MARKER), trigger
// it via an explicit `/<name>` invocation, and assert the injected activation
// directive / system context references the REAL definition file name derived
// from remote.path's basename — NOT a hardcoded `SKILL.md`.
//
// Contract under test:
//   path 'SKILL.md'            -> 'SKILL.md'   (directory-type single file)
//   path 'sub/SKILL.md'        -> 'SKILL.md'
//   path 'Standalone.md'       -> 'Standalone.md'
//   path 'D:\x\Standalone.md'  -> 'Standalone.md' (backslash normalized)
//   path undefined             -> undefined -> buildLocalSkillSystemContext
//                                   falls back to 'SKILL.md'

function localIndexSkill(skillName: string, definitionPath: string | undefined) {
  return {
    name: skillName,
    instructions: `# Local Skill: ${skillName}\n\n## Activation Notice\n\n${LOCAL_INDEX_MARKER}\n`,
    memoryEnabled: false,
    source: 'remote' as const,
    description: `local index skill ${skillName}`,
    remote: {
      provider: 'local' as const,
      sourceId: 'local:/tmp/skill',
      localDirectory: '/tmp/skill',
      path: definitionPath,
    },
  };
}

function runAugment(definitionPath: string | undefined, skillName: string): string {
  const state = {
    memories: [],
    skills: [localIndexSkill(skillName, definitionPath)],
    activePreset: null,
    modelType: null,
    toolDescriptors: [],
    messageCount: 0,
  } as unknown as RequestAugmentationState;

  const decodedBody = { prompt: `/${skillName} please do the task`, parent_message_id: null };
  const result = augmentDecodedRequestBody(decodedBody, state);
  if (!result) throw new Error('augmentDecodedRequestBody returned null');
  const prompt = (JSON.parse(result.body) as { prompt: string }).prompt;
  return prompt;
}

describe('definitionFileOf — real definition file name reference (indirect)', () => {
  it('T2a path "SKILL.md" -> directive references SKILL.md', () => {
    const prompt = runAugment('SKILL.md', 'skillmd');
    expect(prompt).toContain('SKILL.md');
  });

  it('T2b path "sub/SKILL.md" -> directive references SKILL.md', () => {
    const prompt = runAugment('sub/SKILL.md', 'subskill');
    expect(prompt).toContain('SKILL.md');
  });

  it('T2c path "Standalone.md" -> references Standalone.md and NOT SKILL.md', () => {
    const prompt = runAugment('Standalone.md', 'standalone');
    expect(prompt).toContain('Standalone.md');
    expect(prompt).not.toContain('SKILL.md');
  });

  it('T2d backslash path "D:\\x\\Standalone.md" -> references Standalone.md and NOT SKILL.md', () => {
    const prompt = runAugment('D:\\x\\Standalone.md', 'winstandalone');
    expect(prompt).toContain('Standalone.md');
    expect(prompt).not.toContain('SKILL.md');
  });

  it('T2e undefined path -> falls back to SKILL.md', () => {
    const prompt = runAugment(undefined, 'nofile');
    expect(prompt).toContain('SKILL.md');
  });
});
