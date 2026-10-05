import crypto from 'crypto';

// Disable TLS rejection for Sberbank Russian Trusted Root CA certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}
const gigachatTokenCache = new Map<string, TokenCacheEntry>();

async function extractErrorText(response: Response, defaultMsg = 'Ошибка'): Promise<string> {
  try {
    const raw = await response.text();
    if (!raw || !raw.trim()) return `${defaultMsg} (${response.status})`;
    try {
      const parsed = JSON.parse(raw);
      return parsed.message || parsed.error?.message || parsed.error || parsed.error_description || raw;
    } catch {
      return raw.slice(0, 300);
    }
  } catch {
    return `${defaultMsg} (${response.status})`;
  }
}

async function getGigaChatAccessToken(apiKey: string, scope = 'GIGACHAT_API_PERS'): Promise<string> {
  const cleanKey = apiKey.trim();
  if (cleanKey.startsWith('eyJ')) {
    return cleanKey;
  }

  const cacheKey = `${cleanKey}:::${scope}`;
  const cached = gigachatTokenCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now + 120000) {
    return cached.accessToken;
  }

  const authHeader = cleanKey.startsWith('Basic ') ? cleanKey : `Basic ${cleanKey}`;
  const rquid = crypto.randomUUID();

  const oauthUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rquid,
      'Authorization': authHeader,
    },
    body: `scope=${encodeURIComponent(scope)}`,
  });

  if (!response.ok) {
    const errBody = await extractErrorText(response, 'Ошибка авторизации GigaChat');
    throw new Error(
      `Ошибка авторизации GigaChat (OAuth ${response.status}): ${errBody || 'Проверьте Client Secret (Authorization Key)'}`
    );
  }

  const data = (await response.json()) as { access_token: string; expires_at: number };
  if (!data.access_token) {
    throw new Error('GigaChat OAuth сервер не вернул access_token');
  }

  gigachatTokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: data.expires_at || Date.now() + 28 * 60 * 1000,
  });

  return data.access_token;
}

export default async function handler(req: any, res: any) {
  // CORS Headers for cross-domain requests (e.g. from GitHub Pages)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, RqUID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { apiKey, systemPrompt, messages, model, scope } = body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'API-ключ GigaChat не передан' });
    }

    // 1. Get temporary OAuth access token from GigaChat
    const accessToken = await getGigaChatAccessToken(apiKey, scope || 'GIGACHAT_API_PERS');

    // 2. Format chat messages payload
    const chatPayload = {
      model: model && model.trim() ? model.trim() : 'GigaChat',
      messages: [
        { role: 'system', content: systemPrompt || '' },
        ...(Array.isArray(messages)
          ? messages.map((m: any) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content || '',
            }))
          : []),
      ],
      temperature: 0.7,
      max_tokens: 1000,
    };

    // 3. Send request to GigaChat API
    const chatResponse = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(chatPayload),
    });

    if (!chatResponse.ok) {
      const chatErr = await extractErrorText(chatResponse, 'Ошибка GigaChat API');
      return res.status(chatResponse.status).json({
        error: `Ошибка GigaChat API (${chatResponse.status}): ${chatErr}`,
      });
    }

    const chatData = (await chatResponse.json()) as any;
    const reply = chatData.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({ error: 'GigaChat вернул ответ без текста' });
    }

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error('[Vercel GigaChat Handler Error]:', err);
    return res.status(500).json({ error: err.message || 'Внутренняя ошибка прокси GigaChat' });
  }
}
