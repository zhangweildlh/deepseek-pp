import { describe, expect, it } from 'vitest';
import { mutationMayAffectRestoredMessageTarget } from '../entrypoints/content/restored-message-targets';

describe('restored message target mutations', () => {
  it('detects newly mounted messages and content added inside an existing message', () => {
    const message = document.createElement('article');
    message.className = 'ds-message';
    const content = document.createElement('div');
    message.appendChild(content);

    expect(mutationMayAffectRestoredMessageTarget(childListMutation(document.body, message)))
      .toBe(true);
    expect(mutationMayAffectRestoredMessageTarget(childListMutation(message, content)))
      .toBe(true);
  });

  it('detects late text rendering inside a message', () => {
    const message = document.createElement('article');
    message.className = 'ds-message';
    const text = document.createTextNode('Late assistant content');
    message.appendChild(text);

    expect(mutationMayAffectRestoredMessageTarget(characterDataMutation(text))).toBe(true);
  });

  it('ignores extension-owned restored UI so rendering does not reschedule itself', () => {
    const message = document.createElement('article');
    message.className = 'ds-message';
    const toolBlock = document.createElement('div');
    toolBlock.className = 'dpp-tool-block';
    const toolItem = document.createElement('span');
    toolBlock.appendChild(toolItem);
    message.appendChild(toolBlock);

    expect(mutationMayAffectRestoredMessageTarget(childListMutation(message, toolBlock)))
      .toBe(false);
    expect(mutationMayAffectRestoredMessageTarget(childListMutation(toolBlock, toolItem)))
      .toBe(false);
  });
});

function childListMutation(target: Node, ...addedNodes: Node[]): MutationRecord {
  return {
    type: 'childList',
    target,
    addedNodes: addedNodes as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
  } as MutationRecord;
}

function characterDataMutation(target: Node): MutationRecord {
  return { type: 'characterData', target } as MutationRecord;
}
