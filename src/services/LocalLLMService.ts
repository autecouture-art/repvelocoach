import * as SecureStore from 'expo-secure-store';

const LOCAL_LLM_API_KEY = 'repvelo_local_llm_api_key';
const LOCAL_LLM_MODEL = 'repvelo_local_llm_model';
const LOCAL_LLM_API_URL = 'repvelo_local_llm_api_url';

export type LocalLLMConfig = {
  apiKey: string;
  model: string;
  apiUrl: string;
};

type CoachHistory = Array<{
  role: 'user' | 'coach';
  text: string;
}>;

type CoachContext = Record<string, unknown>;

const DEFAULT_MODEL = 'glm-4.7';
const DEFAULT_API_URL = 'https://api.z.ai/api/anthropic';

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const getValue = async (key: string) => (await SecureStore.getItemAsync(key)) ?? '';

export async function getLocalLLMConfig(): Promise<LocalLLMConfig> {
  const [apiKey, model, apiUrl] = await Promise.all([
    getValue(LOCAL_LLM_API_KEY),
    getValue(LOCAL_LLM_MODEL),
    getValue(LOCAL_LLM_API_URL),
  ]);

  return {
    apiKey: apiKey.trim(),
    model: model.trim() || DEFAULT_MODEL,
    apiUrl: trimTrailingSlash(apiUrl.trim() || DEFAULT_API_URL),
  };
}

export async function saveLocalLLMConfig(config: Partial<LocalLLMConfig>): Promise<void> {
  if (typeof config.apiKey === 'string') {
    const next = config.apiKey.trim();
    if (next) {
      await SecureStore.setItemAsync(LOCAL_LLM_API_KEY, next);
    } else {
      await SecureStore.deleteItemAsync(LOCAL_LLM_API_KEY);
    }
  }

  if (typeof config.model === 'string') {
    const next = config.model.trim() || DEFAULT_MODEL;
    await SecureStore.setItemAsync(LOCAL_LLM_MODEL, next);
  }

  if (typeof config.apiUrl === 'string') {
    const next = trimTrailingSlash(config.apiUrl.trim() || DEFAULT_API_URL);
    await SecureStore.setItemAsync(LOCAL_LLM_API_URL, next);
  }
}

export async function getLocalLLMHealth() {
  const config = await getLocalLLMConfig();
  return {
    ...config,
    hasApiKey: Boolean(config.apiKey),
    configured: Boolean(config.apiKey),
    isAnthropicCompatible: /\/anthropic(\/|$)/i.test(config.apiUrl),
  };
}

const buildSystemPrompt = (context: CoachContext) => {
  const contextText = `トレーニングコンテキスト(JSON):\n${JSON.stringify(context, null, 2)}`;
  return [
    'あなたは日本語のストレングスコーチです。短く具体的に答えてください。与えられたトレーニングデータを優先し、足りないときだけ不足点を1行で示してください。安全と回復を優先してください。',
    contextText,
  ].join('\n\n');
};

export async function invokeDirectCoachChat(params: {
  message: string;
  history?: CoachHistory;
  context?: CoachContext;
}): Promise<string> {
  const config = await getLocalLLMConfig();
  if (!config.apiKey) {
    throw new Error('ZAI_API_KEY is not configured');
  }

  const system = buildSystemPrompt(params.context ?? {});

  if (/\/anthropic(\/|$)/i.test(config.apiUrl)) {
    const response = await fetch(`${config.apiUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 700,
        system,
        messages: [
          ...(params.history ?? []).map((message) => ({
            role: message.role === 'coach' ? 'assistant' : 'user',
            content: message.text,
          })),
          {
            role: 'user',
            content: params.message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 && /invalid|authentication_error|api key/i.test(errorText)) {
        throw new Error('ZAI_API_KEY is invalid');
      }
      if (response.status === 429 && /Insufficient balance|no resource package|recharge/i.test(errorText)) {
        throw new Error('ZAI_API_BALANCE_EXHAUSTED');
      }
      throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    return (data.content ?? [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n') || '回答を生成できませんでした。';
  }

  const response = await fetch(`${config.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 700,
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: system },
        ...(params.history ?? []).map((message) => ({
          role: message.role === 'coach' ? 'assistant' : 'user',
          content: message.text,
        })),
        { role: 'user', content: params.message },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 && /invalid api key/i.test(errorText)) {
      throw new Error('ZAI_API_KEY is invalid');
    }
    if (response.status === 429 && /Insufficient balance|no resource package|recharge/i.test(errorText)) {
      throw new Error('ZAI_API_BALANCE_EXHAUSTED');
    }
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type: string; text?: string }>;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return '回答を生成できませんでした。';
}
