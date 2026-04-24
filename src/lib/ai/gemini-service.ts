type GeminiGenerateParams = {
  prompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

const GEMINI_BASE_URL = 'https://aiplatform.googleapis.com/v1/publishers/google/models';
const GEMINI_FALLBACK_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_TIMEOUT_MS = 45000;

function extractGeminiText(payload: any): string {
  if (Array.isArray(payload)) {
    return payload
      .map((entry: any) => extractGeminiText(entry))
      .filter(Boolean)
      .join('')
      .trim();
  }

  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  if (typeof payload?.text === 'string') return payload.text.trim();
  return '';
}

function parseGeminiStreamResponse(rawBody: string): string {
  const body = rawBody.trim();
  if (!body) return '';

  // First try normal JSON response (object/array).
  try {
    const parsed = JSON.parse(body);
    const text = extractGeminiText(parsed);
    if (text) return text;
  } catch {
    // Fall through to streaming parsers.
  }

  const sseChunks: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    try {
      const parsed = JSON.parse(data);
      const text = extractGeminiText(parsed);
      if (text) sseChunks.push(text);
    } catch {
      // Ignore non-JSON SSE lines.
    }
  }

  if (sseChunks.length > 0) {
    return sseChunks.join('').trim();
  }

  const lineChunks: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    try {
      const parsed = JSON.parse(line);
      const text = extractGeminiText(parsed);
      if (text) lineChunks.push(text);
    } catch {
      // Ignore non-JSON lines.
    }
  }

  return lineChunks.join('').trim();
}

function extractApiErrorMessage(rawBody: string, status: number): string {
  if (!rawBody) return `Gemini API error: ${status}`;

  try {
    const parsed = JSON.parse(rawBody);
    const message = parsed?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // Keep raw body fallback.
  }

  return rawBody;
}

function isApiKeyUnsupportedError(status: number, rawBody: string): boolean {
  if (status !== 401 && status !== 403) return false;

  const normalized = rawBody.toLowerCase();
  return normalized.includes('api keys are not supported by this api');
}

async function requestGemini(
  url: string,
  payload: unknown,
  mode: 'stream' | 'json'
): Promise<{ ok: true; text: string } | { ok: false; status: number; rawBody: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { ok: false, status: 504, rawBody: 'Request to Gemini timed out. Please try again.' };
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, rawBody };
  }

  let text = '';
  if (mode === 'stream') {
    text = parseGeminiStreamResponse(rawBody);
  } else {
    try {
      text = extractGeminiText(JSON.parse(rawBody));
    } catch {
      return { ok: false, status: 502, rawBody: rawBody || 'Invalid JSON response from Gemini' };
    }
  }

  if (!text) {
    return { ok: false, status: 502, rawBody: 'Gemini returned empty response' };
  }

  return { ok: true, text };
}

export async function generateGeminiText({
  prompt,
  model = DEFAULT_GEMINI_MODEL,
  temperature = 0.4,
  maxOutputTokens = 600,
}: GeminiGenerateParams): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or API_KEY is not set');
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  const streamUrl = `${GEMINI_FALLBACK_BASE_URL}/${model}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;
  const streamResult = await requestGemini(streamUrl, payload, 'stream');

  if (streamResult.ok) {
    return streamResult.text;
  }

  // If the initial stream attempt fails or reports API key unsupported,
  // try the fallback URL with a non-streaming request.
  const fallbackUrl = `${GEMINI_FALLBACK_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const fallbackResult = await requestGemini(fallbackUrl, payload, 'json');

  if (fallbackResult.ok) {
    return fallbackResult.text;
  }

  // If both streaming and fallback fail, throw an error with the most relevant message.
  if (!streamResult.ok) {
    throw new Error(extractApiErrorMessage(streamResult.rawBody, streamResult.status));
  }

  // At this point streamResult was ok, so fallbackResult must have failed.
  throw new Error(extractApiErrorMessage(fallbackResult.rawBody, fallbackResult.status));
}
