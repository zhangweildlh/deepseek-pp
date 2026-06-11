import type { ModelType } from '../types';
import { createOfficialDeepSeekRequestBody, submitOfficialDeepSeekStreaming } from '../deepseek/official-api';

export interface ApiPlaygroundInput {
  apiKey: string;
  prompt: string;
  modelType: ModelType;
  fetchImpl?: typeof fetch;
}

export interface ApiPlaygroundResult {
  ok: true;
  output: string;
  finished: boolean;
  request: {
    model: string;
    messageCount: number;
    thinking: 'enabled' | 'disabled';
  };
}

export interface ApiPlaygroundError {
  ok: false;
  error: string;
}

const MAX_PROMPT_CHARS = 12_000;

export async function runApiPlayground(input: ApiPlaygroundInput): Promise<ApiPlaygroundResult | ApiPlaygroundError> {
  const prompt = normalizePrompt(input.prompt);
  if (!prompt) return { ok: false, error: 'prompt_required' };

  try {
    const messages = [{ role: 'user' as const, content: prompt }];
    const body = createOfficialDeepSeekRequestBody({
      modelType: input.modelType,
      messages,
    });
    const turn = await submitOfficialDeepSeekStreaming({
      apiKey: input.apiKey,
      modelType: input.modelType,
      messages,
      fetchImpl: input.fetchImpl,
    }, {});

    return {
      ok: true,
      output: turn.assistantText,
      finished: turn.finished,
      request: {
        model: body.model,
        messageCount: body.messages.length,
        thinking: body.thinking.type === 'enabled' ? 'enabled' : 'disabled',
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function normalizePrompt(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_PROMPT_CHARS);
}
