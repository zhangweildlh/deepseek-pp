import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeDeveloperSettings,
  saveDeveloperSettings,
  getDeveloperSettings,
} from '../core/developer/settings';
import { runApiPlayground } from '../core/developer/api-playground';
import {
  createImageAttachmentManifestArtifact,
  createMessageMarkdownArtifact,
  createSavedItemsJsonArtifact,
  createSavedItemsMarkdownArtifact,
} from '../core/export/secondary-artifacts';
import {
  extractHistoryItems,
  filterHistoryItems,
  normalizeHistoryOrganizerState,
  parseSessionId,
  startDeepSeekHistoryOrganizer,
} from '../entrypoints/content/adapters/history-organizer';
import {
  collectCodeBlocks,
  getCodeBlockText,
  inferCodeFilename,
  startContentUxPolish,
} from '../entrypoints/content/adapters/ux-polish';
import type { SavedItem } from '../core/saved-items';

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
  document.body.innerHTML = '';
});

describe('Phase 5 product surface helpers', () => {
  it('normalizes developer settings so playground cannot enable without developer mode', async () => {
    expect(normalizeDeveloperSettings({ developerMode: false, apiPlaygroundEnabled: true })).toEqual({
      developerMode: false,
      apiPlaygroundEnabled: false,
    });

    await saveDeveloperSettings({ developerMode: true });
    const saved = await saveDeveloperSettings({ apiPlaygroundEnabled: true });
    expect(saved).toEqual({ developerMode: true, apiPlaygroundEnabled: true });
    expect(await getDeveloperSettings()).toEqual(saved);
  });

  it('runs the API playground without returning the API key', async () => {
    const seenHeaders: string[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      seenHeaders.push(String((init?.headers as Record<string, string>).authorization));
      return new Response(createSseStream([
        'data: {"choices":[{"delta":{"content":"pong"}}]}\n\n',
        'data: [DONE]\n\n',
      ]), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runApiPlayground({
      apiKey: 'sk-secret',
      prompt: 'ping',
      modelType: null,
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      output: 'pong',
      request: {
        messageCount: 1,
        thinking: 'disabled',
      },
    });
    expect(JSON.stringify(result)).not.toContain('sk-secret');
    expect(seenHeaders).toEqual(['Bearer sk-secret']);
  });

  it('extracts and filters DeepSeek history items with tags isolated from DOM text', () => {
    document.body.innerHTML = `
      <nav>
        <div><a href="https://chat.deepseek.com/a/chat/s/session-one">Release notes</a></div>
        <div><a href="https://chat.deepseek.com/a/chat/s/session-two">Android WebView</a></div>
      </nav>
    `;
    const state = normalizeHistoryOrganizerState({
      tagsBySessionId: {
        'session-one': ['release'],
        'session-two': ['android'],
      },
    });
    const items = extractHistoryItems(document, state);
    const filtered = filterHistoryItems(items, { query: 'release', tag: 'rel' });

    expect(parseSessionId('https://chat.deepseek.com/a/chat/s/session-one')).toBe('session-one');
    expect(items.map((item) => item.sessionId)).toEqual(['session-one', 'session-two']);
    expect(filtered.visible.map((item) => item.sessionId)).toEqual(['session-one']);
    expect(filtered.hidden.map((item) => item.sessionId)).toEqual(['session-two']);
  });

  it('collects code blocks and infers download filenames', () => {
    document.body.innerHTML = `
      <pre><code class="language-ts">const ok: boolean = true;</code></pre>
      <pre><code class="language-python">print("ok")</code></pre>
    `;
    const blocks = collectCodeBlocks(document);

    expect(blocks).toHaveLength(2);
    expect(inferCodeFilename(blocks[0], 0)).toBe('deepseek-code-1.ts');
    expect(inferCodeFilename(blocks[1], 1)).toBe('deepseek-code-2.py');
    blocks[0].appendChild(Object.assign(document.createElement('button'), { textContent: 'Download' }));
    expect(getCodeBlockText(blocks[0])).toBe('const ok: boolean = true;');
  });

  it('renders injected content controls with provided localized labels', () => {
    document.body.innerHTML = `
      <nav>
        <div><a href="https://chat.deepseek.com/a/chat/s/session-one">Release notes</a></div>
      </nav>
      <pre><code class="language-ts">const ok = true;</code></pre>
      <div data-message-id="message-1" data-message-role="assistant">Hello</div>
    `;

    const history = startDeepSeekHistoryOrganizer(() => ({
      title: 'DeepSeek++ 历史',
      searchPlaceholder: '搜索对话',
      tagPlaceholder: '按标签过滤',
      currentTagsPlaceholder: '当前对话标签',
      noHistoryDetected: 'DeepSeek++：未检测到历史列表',
      visibleStatus: (visibleCount, totalCount) => `DeepSeek++：已显示 ${visibleCount}/${totalCount}`,
      storageError: (_action, message) => `DeepSeek++：历史标签错误：${message}`,
    }));
    const polish = startContentUxPolish(() => ({
      codeDownloadButton: '下载',
      messageMarkdownButton: 'MD',
      messageMarkdownTitle: '下载消息为 Markdown',
    }));

    try {
      expect(document.querySelector('[data-dpp-history-title]')?.textContent).toBe('DeepSeek++ 历史');
      expect(document.querySelector<HTMLInputElement>('[data-dpp-history-search]')?.placeholder).toBe('搜索对话');
      expect(document.querySelector<HTMLInputElement>('[data-dpp-history-tag]')?.placeholder).toBe('按标签过滤');
      expect(document.querySelector('[data-dpp-history-status]')?.textContent).toBe('DeepSeek++：已显示 1/1');
      expect(document.querySelector<HTMLButtonElement>('.dpp-code-download')?.textContent).toBe('下载');
      expect(document.querySelector<HTMLButtonElement>('.dpp-message-download')?.title).toBe('下载消息为 Markdown');
    } finally {
      history.stop();
      polish.stop();
    }
  });

  it('creates optional message, saved-item, and image export artifacts', () => {
    const savedItems: SavedItem[] = [{
      id: 'saved-1',
      syncId: 'sync-1',
      kind: 'snippet',
      title: 'Prompt',
      content: 'Summarize this.',
      tags: ['prompt'],
      createdAt: 1,
      updatedAt: 2,
    }];

    expect(createMessageMarkdownArtifact({
      id: 'message-1',
      role: 'assistant',
      content: 'Hello',
      createdAt: null,
    }).content).toContain('Hello');
    expect(createSavedItemsMarkdownArtifact(savedItems).content).toContain('Summarize this.');
    expect(JSON.parse(createSavedItemsJsonArtifact(savedItems).content).items[0].id).toBe('saved-1');
    expect(createImageAttachmentManifestArtifact([{
      id: 'image-1',
      fileName: 'chart.png',
      mimeType: 'image/png',
      sizeBytes: 128,
      status: 'metadata_available',
      sourceMessageIds: ['message-1'],
    }]).content).toContain('chart.png');
  });
});

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}
