import type { ToolDescriptor } from '../types';
import { createToolInvocationCatalog, getToolCloseTag } from '../tool';

export interface ToolCallScanGate {
  shouldScanChunk(text: string): boolean;
}

export function createToolCallScanGate(
  descriptors: readonly ToolDescriptor[],
): ToolCallScanGate {
  const catalog = createToolInvocationCatalog(descriptors);
  const closeTags = catalog.invocationNames.map(getToolCloseTag);
  const tailSize = Math.max(0, ...closeTags.map((tag) => tag.length - 1));
  let tail = '';

  return {
    shouldScanChunk(text: string): boolean {
      if (!text || closeTags.length === 0) return false;
      const probe = tail + text;
      tail = tailSize > 0 ? probe.slice(-tailSize) : '';
      return closeTags.some((tag) => probe.includes(tag));
    },
  };
}
