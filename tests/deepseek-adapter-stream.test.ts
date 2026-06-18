import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitPromptStreaming } from '../core/deepseek/adapter';
import type { ResponseTokenSpeedPayload } from '../core/interceptor/token-speed';

describe('DeepSeek web adapter streaming', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('can stream chunks without retaining the full assistant text', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => createSseResponse([
      'data: {"v":"Hello "}',
      'data: {"v":"world"}',
      'data: {"p":"response/status","v":"FINISHED"}',
    ].join('\n\n'))));

    const chunks: string[] = [];
    const fullTexts: string[] = [];
    const turn = await submitPromptStreaming(createSubmitInput(), {
      retainAssistantText: false,
      onTextChunk(text, fullText) {
        chunks.push(text);
        fullTexts.push(fullText);
      },
    });

    expect(chunks.join('')).toBe('Hello world');
    expect(fullTexts.every((fullText) => fullText === '')).toBe(true);
    expect(turn).toMatchObject({
      assistantText: '',
      finished: true,
    });
  });

  it('retains full assistant text by default', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => createSseResponse([
      'data: {"v":"Hello "}',
      'data: {"v":"world"}',
    ].join('\n\n'))));

    const fullTexts: string[] = [];
    const turn = await submitPromptStreaming(createSubmitInput(), {
      onTextChunk(_text, fullText) {
        fullTexts.push(fullText);
      },
    });

    expect(fullTexts.at(-1)).toBe('Hello world');
    expect(turn.assistantText).toBe('Hello world');
  });

  it('emits token speed progress for bypass streaming requests', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => createSseResponse([
      'event: ready\ndata: {"request_message_id":1,"response_message_id":2,"model_type":"vision"}',
      'data: {"v":{"response":{"message_id":2,"inserted_at":1000,"accumulated_token_usage":0}}}',
      'data: {"p":"response/fragments/-1/content","v":"Hello "}',
      'data: {"p":"response/fragments/-1/content","v":"world"}',
      'data: {"p":"response","o":"BATCH","v":[{"p":"accumulated_token_usage","v":3302},{"p":"quasi_status","v":"FINISHED"}]}',
      'event: update_session\ndata: {"updated_at":1003.11}',
    ].join('\n\n'))));

    const progress: ResponseTokenSpeedPayload[] = [];
    const turn = await submitPromptStreaming(createSubmitInput(), {
      onTokenSpeed(next) {
        progress.push(next);
      },
      onTextChunk() {
        now += 1000;
      },
    });

    const final = progress.at(-1);
    expect(turn.responseMessageId).toBe(2);
    expect(final).toMatchObject({
      active: false,
      accumulatedTokens: 3302,
      tokenSource: 'server',
      speedSource: 'server',
      modelType: 'vision',
      chatSessionId: 'session-1',
      assistantMessageId: 2,
    });
    expect(final?.tokensPerSecond).toBeCloseTo(3302 / 3.11, 5);
  });
});

function createSubmitInput() {
  return {
    chatSessionId: 'session-1',
    parentMessageId: 1,
    modelType: null,
    prompt: 'hello',
    refFileIds: [],
    thinkingEnabled: false,
    searchEnabled: false,
    clientHeaders: {},
    powHeaders: {},
  };
}

function createSseResponse(text: string): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  }), {
    headers: { 'content-type': 'text/event-stream' },
  });
}
