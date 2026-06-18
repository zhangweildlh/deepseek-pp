import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeMcpToolCall } from '../core/mcp/discovery';
import { createMcpServer } from '../core/mcp/store';
import type { ToolCall } from '../core/types';

let storage: Record<string, unknown>;

beforeEach(() => {
  storage = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          storage = { ...storage, ...values };
        }),
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MCP execution policy', () => {
  it('rejects tool calls before discovery when server execution is disabled', async () => {
    const server = await createMcpServer({
      displayName: 'Disabled Execution MCP',
      enabled: true,
      transport: {
        kind: 'native_messaging',
        nativeHost: 'com.example.disabled_execution',
      },
      execution: {
        enabled: false,
        mode: 'manual',
      },
    });

    const result = await executeMcpToolCall(createMcpCall(server.id));

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('mcp_execution_disabled');
    expect(result.detail).toContain('Disabled Execution MCP');
  });
});

function createMcpCall(serverId: string): ToolCall {
  return {
    name: 'sample_tool',
    invocationName: `mcp_${serverId}_sample_tool`,
    descriptorId: `mcp:${serverId}:sample_tool`,
    provider: {
      kind: 'mcp',
      id: serverId,
      displayName: 'Disabled Execution MCP',
      transport: 'native_messaging',
    },
    payload: {},
    raw: '',
  };
}
