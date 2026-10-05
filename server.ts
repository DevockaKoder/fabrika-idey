import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

// Disable TLS verification for Sberbank Russian Trusted Root CA (equivalent to verify=False in Python)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// In-memory cache for GigaChat OAuth access tokens (valid for ~30 minutes)
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
      return raw;
    }
  } catch {
    return `${defaultMsg} (${response.status})`;
  }
}

async function getGigaChatAccessToken(apiKey: string, scope = 'GIGACHAT_API_PERS'): Promise<string> {
  const cleanKey = apiKey.trim();

  // If user already passed an access_token (starts with eyJ...)
  if (cleanKey.startsWith('eyJ')) {
    return cleanKey;
  }

  const cacheKey = `${cleanKey}:::${scope}`;
  const cached = gigachatTokenCache.get(cacheKey);
  const now = Date.now();

  // Return cached token if valid for at least another 2 minutes
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

  // Cache token
  gigachatTokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: data.expires_at || Date.now() + 28 * 60 * 1000,
  });

  return data.access_token;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware to allow cross-origin requests from GitHub Pages or static hosts
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, RqUID');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // GigaChat dedicated proxy endpoint with OAuth handshake
  app.post('/api/gigachat', async (req, res) => {
    try {
      const { apiKey, systemPrompt, messages, model, scope } = req.body;

      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ error: 'API-ключ GigaChat не передан' });
      }

      // 1. Obtain temporary OAuth access token using Client Secret / Auth Key
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

      // 3. Send request to GigaChat completions endpoint
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

      return res.json({ reply });
    } catch (err: any) {
      console.error('[GigaChat Proxy Error]:', err);
      return res.status(500).json({ error: err.message || 'Внутренняя ошибка прокси GigaChat' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
