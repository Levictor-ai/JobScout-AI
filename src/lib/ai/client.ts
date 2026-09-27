const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 2;

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiResult<T> {
  data: T;
  model: string;
  usage: AiUsage;
  requestId: string | null;
}

export class AiError extends Error {
  readonly status: number | undefined;
  readonly refusal: boolean;

  constructor(message: string, options: { status?: number; refusal?: boolean } = {}) {
    super(message);
    this.name = 'AiError';
    this.status = options.status;
    this.refusal = options.refusal ?? false;
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function getBaseUrl(): string {
  return (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface AiCallOptions {
  schemaName: string;
  schema: Record<string, unknown>;
  messages: ChatMessage[];
  maxCompletionTokens?: number;
  temperature?: number;
  retries?: number;
  signal?: AbortSignal;
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null; refusal?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; type?: string; code?: string };
}

export async function requestStructuredJson<T>(options: AiCallOptions): Promise<AiResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiError('OPENAI_API_KEY is not configured.');

  const model = getModel();
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);

    try {
      const response = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: options.schemaName,
              strict: true,
              schema: options.schema,
            },
          },
          max_completion_tokens: options.maxCompletionTokens ?? 1200,
          temperature: options.temperature ?? 0.2,
        }),
        cache: 'no-store',
      });

      const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

      if (!response.ok) {
        const detail = body?.error?.message ?? `OpenAI responded with status ${response.status}.`;

        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          await sleep(750 * 2 ** attempt);
          continue;
        }

        throw new AiError(detail, { status: response.status });
      }

      const choice = body?.choices?.[0];
      const refusal = choice?.message?.refusal;
      const content = choice?.message?.content;

      if (refusal) {
        throw new AiError(`Model refused to answer: ${refusal}`, { refusal: true });
      }

      if (!content) {
        throw new AiError(
          `Model returned no content (finish_reason: ${choice?.finish_reason ?? 'unknown'}).`
        );
      }

      let data: T;
      try {
        data = JSON.parse(content) as T;
      } catch {
        throw new AiError('Model response was not valid JSON.');
      }

      return {
        data,
        model: body?.model ?? model,
        usage: {
          promptTokens: body?.usage?.prompt_tokens ?? 0,
          completionTokens: body?.usage?.completion_tokens ?? 0,
          totalTokens: body?.usage?.total_tokens ?? 0,
        },
        requestId: body?.id ?? null,
      };
    } catch (error) {
      lastError = error;

      if (error instanceof AiError) {
        if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
          if (attempt < retries) {
            await sleep(750 * 2 ** attempt);
            continue;
          }
        }
        throw error;
      }

      if (attempt < retries) {
        await sleep(750 * 2 ** attempt);
        continue;
      }

      throw new AiError(
        error instanceof Error
          ? error.name === 'AbortError'
            ? `OpenAI request timed out after ${REQUEST_TIMEOUT_MS}ms.`
            : error.message
          : 'Unknown OpenAI error.'
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  throw new AiError(
    lastError instanceof Error ? lastError.message : 'OpenAI request failed.',
    { status: 500 }
  );
}
