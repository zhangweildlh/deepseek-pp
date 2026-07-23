const RESTORED_EXTENSION_UI_SELECTOR = [
  '.dpp-tool-block',
  '.dpp-agent-container',
  '.dpp-artifact-results',
].join(', ');

export function mutationMayAffectRestoredMessageTarget(
  mutation: MutationRecord,
): boolean {
  if (mutation.type === 'characterData') {
    return nodeMayAffectRestoredMessageTarget(mutation.target);
  }

  return Array.from(mutation.addedNodes)
    .some(nodeMayAffectRestoredMessageTarget);
}

function nodeMayAffectRestoredMessageTarget(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element || element.closest(RESTORED_EXTENSION_UI_SELECTOR)) return false;

  return element.matches('.ds-message') ||
    Boolean(element.closest('.ds-message')) ||
    Boolean(element.querySelector('.ds-message'));
}
