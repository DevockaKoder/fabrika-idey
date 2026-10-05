/**
 * Standalone GigaChat Backend Proxy
 * ----------------------------------------------------
 * Запуск в 1 строку: node backend-server.js
 * Работает без npm install (использует встроенные модули Node.js 18+)
 * 
 * Поддерживает:
 * - CORS для запросов с GitHub Pages
 * - Сертификаты Минцифры РФ (NODE_TLS_REJECT_UNAUTHORIZED=0)
 * - Кэширование OAuth-токенов Сбера
 * - Эндпоинты: POST /api/gigachat, GET /api/health
 */

import http from 'http';
import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PORT = process.env.PORT || 3001;
const tokenCache = new Map();

async function getAccessToken(apiKey, scope = 'GIGACHAT_API_PERS') {
  const cleanKey = apiKey.trim();
  if (cleanKey.startsWith('eyJ')) return cleanKey;

  const cacheKey = `${cleanKey}:::${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 120000) {
    return cached.accessToken;
  }

  const authHeader = cleanKey.startsWith('Basic ') ? cleanKey : `Basic ${cleanKey}`;
  const rquid = crypto.randomUUID();

  const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rquid,
      'Authorization': authHeader,
    },
    body: `scope=${encodeURIComponent(scope)}`,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ошибка OAuth GigaChat (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth сервер не вернул access_token');

  tokenCache.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: data.expires_at || Date.now() + 28 * 60 * 1000,
  });

  return data.access_token;
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, RqUID');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', serverTime: new Date().toISOString() }));
  }

  if (url.pathname === '/api/gigachat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const { apiKey, systemPrompt, messages, model, scope } = parsed;

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'API-ключ не передан' }));
        }

        const token = await getAccessToken(apiKey, scope || 'GIGACHAT_API_PERS');

        const chatPayload = {
          model: (model && model.trim()) || 'GigaChat',
          messages: [
            { role: 'system', content: systemPrompt || '' },
            ...(Array.isArray(messages) ? messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content || '',
            })) : []),
          ],
          temperature: 0.7,
        };

        const gigaRes = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(chatPayload),
        });

        if (!gigaRes.ok) {
          const errBody = await gigaRes.text();
          res.writeHead(gigaRes.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `GigaChat API error: ${errBody}` }));
        }

        const gigaData = await gigaRes.json();
        const reply = gigaData.choices?.[0]?.message?.content || '';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ reply }));
      } catch (err) {
        console.error('Server error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message || 'Ошибка сервера' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ GigaChat Backend Proxy запущен на http://localhost:${PORT}`);
  console.log(`📡 URL для GitHub Pages: http://localhost:${PORT} (или ваш публичный URL)`);
});
