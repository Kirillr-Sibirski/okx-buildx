export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function resolveBaseUrl(baseUrl?: string): string {
  const value = baseUrl ?? process.env.APPROVAL_FIREWALL_LLM_BASE_URL ?? process.env.OPENAI_BASE_URL;
  if (!value) {
    return "https://api.openai.com/v1";
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveModel(model?: string): string {
  return model ?? process.env.APPROVAL_FIREWALL_LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

function resolveApiKey(apiKey?: string): string | undefined {
  return apiKey ?? process.env.APPROVAL_FIREWALL_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
}

export function hasLlmCredentials(apiKey?: string): boolean {
  return Boolean(resolveApiKey(apiKey));
}

export async function createChatCompletion(params: {
  messages: ChatMessage[];
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  responseFormat?: Record<string, unknown>;
}): Promise<string> {
  const apiKey = resolveApiKey(params.apiKey);
  if (!apiKey) {
    throw new Error(
      "No LLM API key found. Set APPROVAL_FIREWALL_LLM_API_KEY or OPENAI_API_KEY to enable model-backed features."
    );
  }

  const response = await fetch(`${resolveBaseUrl(params.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: resolveModel(params.model),
      temperature: params.temperature ?? 0.2,
      messages: params.messages,
      response_format: params.responseFormat
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LLM request returned no message content.");
  }

  return content;
}
