/**
 * ============================================================================
 * 🔑 МЕСТО ДЛЯ ВСТАВКИ ВАШЕГО API-КЛЮЧА:
 * ============================================================================
 * 
 * Если вы хотите, чтобы площадка сразу работала на всех компьютерах учеников
 * без необходимости на каждом ПК открывать модальное окно и вводить ключ,
 * просто вставьте ваш ключ в кавычки переменной DEFAULT_API_KEY ниже:
 * 
 * Пример:
 * export const DEFAULT_API_KEY = 'sk-or-v1-7a8b9c...';
 * 
 * ============================================================================
 */

export const DEFAULT_API_KEY = 'MDE5YWRmZjItNzE2Ni03ODU5LTk1NTQtOGMyN2Q5Y2ZiZjFiOjBmYWM2NjBlLTdjZWMtNDNkNC1hMzMyLWNkMTZhYmViNTk3MQ=='; // 👈 ВСТАВЬТЕ ВАШ API-КЛЮЧ В КАВЫЧКИ СЮДА

// Адрес API шлюза (для GigaChat)
export const DEFAULT_BASE_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';

// Название модели нейросети
export const DEFAULT_MODEL = 'GigaChat';

// Тип провайдера: 'openai' (любой OpenAI-совместимый API) или 'gigachat'
export const DEFAULT_PROVIDER: 'openai' | 'gigachat' = 'gigachat';

// URL бэкенд-сервера (если сайт размещён на GitHub Pages).
// Если сайт запущен локально или на Vercel/Render, оставьте пустым '' (будет использоваться относительный путь /api/gigachat).
export const DEFAULT_BACKEND_URL = '';

