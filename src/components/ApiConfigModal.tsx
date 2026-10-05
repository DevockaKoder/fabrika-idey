import { useState, useEffect } from 'react';
import {
  Key,
  X,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ApiSettings, ApiProvider } from '../types';

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ApiSettings;
  onSave: (newSettings: ApiSettings) => void;
}

export function ApiConfigModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: ApiConfigModalProps) {
  const [provider, setProvider] = useState<ApiProvider>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setProvider(settings.provider);
    setApiKey(settings.apiKey);
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setBackendUrl(settings.backendUrl || '');
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleProviderChange = (newProvider: ApiProvider) => {
    setProvider(newProvider);
    if (newProvider === 'gigachat') {
      setBaseUrl('https://gigachat.devices.sberbank.ru/api/v1');
      setModel('GigaChat');
    } else if (newProvider === 'openai') {
      if (!baseUrl || baseUrl.includes('sberbank')) {
        setBaseUrl('https://openrouter.ai/api/v1');
        setModel('meta-llama/llama-3.3-70b-instruct:free');
      }
    }
  };

  const handleSave = () => {
    const updated: ApiSettings = {
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      backendUrl: backendUrl.trim(),
    };
    onSave(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        id="api-config-modal"
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Настройки подключения к API нейросети
              </h2>
              <p className="text-xs text-slate-500">
                Панель наставника: сохранение ключа в localStorage браузера
              </p>
            </div>
          </div>
          <button
            id="btn-close-api-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Security Notice */}
          <div className="flex items-start gap-3 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-indigo-950">
                Безопасность для школьного класса
              </p>
              <p className="text-indigo-800 leading-relaxed">
                Ключ сохраняется исключительно в локальном хранилище (localStorage) текущего ПК.
                Школьники не видят сам ключ, а наставник вводит его один раз перед занятием.
              </p>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Источник генерации (Провайдер API)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                id="provider-openai"
                onClick={() => handleProviderChange('openai')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  provider === 'openai'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>OpenAI REST API</span>
                </div>
                <span className="text-[11px] text-slate-500 leading-tight">
                  OpenRouter, Groq, DeepSeek, OpenAI
                </span>
              </button>

              <button
                type="button"
                id="provider-gigachat"
                onClick={() => handleProviderChange('gigachat')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  provider === 'gigachat'
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>GigaChat API</span>
                </div>
                <span className="text-[11px] text-slate-500 leading-tight">
                  Сбербанк GigaChat (Авторизационный токен)
                </span>
              </button>
            </div>
          </div>

          {/* Configuration Inputs */}
          <div className="space-y-4 pt-1">
            {/* API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                API Key / Авторизационный токен
              </label>
              <div className="relative">
                <input
                  id="input-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'gigachat'
                      ? 'Bearer eyJhbGciOi... или токен доступа'
                      : 'sk-or-v1-... или sk-...'
                  }
                  className="w-full pl-3 pr-10 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Base URL (Адрес API шлюза)
                </label>
                {provider === 'openai' && (
                  <div className="flex gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl('https://openrouter.ai/api/v1');
                        setModel('gpt-4o-mini');
                      }}
                      className="text-indigo-600 hover:underline"
                    >
                      OpenRouter
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl('https://api.groq.com/openai/v1');
                        setModel('llama-3.3-70b-versatile');
                      }}
                      className="text-indigo-600 hover:underline"
                    >
                      Groq
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl('https://api.openai.com/v1');
                        setModel('gpt-4o-mini');
                      }}
                      className="text-indigo-600 hover:underline"
                    >
                      OpenAI
                    </button>
                  </div>
                )}
              </div>
              <input
                id="input-base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Имя модели нейросети
              </label>
              <input
                id="input-model-name"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini или GigaChat"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          {provider === 'gigachat' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    URL бэкенд-сервера (для GitHub Pages)
                  </label>
                  <span className="text-[11px] text-slate-400 font-normal">Необязательно</span>
                </div>
                <input
                  id="input-backend-url"
                  type="text"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="Оставьте пустым или укажите URL (напр. https://my-app.vercel.app)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  По умолчанию используется встроенный <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/api/gigachat</code>. Если сайт на GitHub Pages, укажите URL вашего бэкенда на Vercel/Render.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-950 space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-blue-900">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Как поднять бесплатный бэкенд за 1 минуту:</span>
                </p>
                <div className="text-[11px] leading-relaxed text-blue-800 space-y-1.5">
                  <p>
                    <strong>1. Самый быстрый способ:</strong> Разверните проект на <strong>Vercel (vercel.com)</strong>. В репозиторий уже добавлен готовый бессерверный бэкенд <code className="bg-blue-100/80 px-1 py-0.2 rounded font-mono">api/gigachat.ts</code>. На Vercel всё работает из коробки без CORS!
                  </p>
                  <p>
                    <strong>2. Для GitHub Pages:</strong> Запустите бэкенд на <strong>Render.com</strong> (команда старта <code className="bg-blue-100/80 px-1 py-0.2 rounded font-mono">npm start</code>) или локально <code className="bg-blue-100/80 px-1 py-0.2 rounded font-mono">node backend-server.js</code>, и вставьте полученный адрес в поле выше.
                  </p>
                  <p className="text-[10px] text-blue-600">
                    Подробная пошаговая инструкция доступна в файле <strong>README_BACKEND.md</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instruction on hardcoding in code */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>💡</span>
              <span>Как вшить ключ прямо в код для всего класса:</span>
            </p>
            <p className="text-slate-600 leading-relaxed font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
              src/config/apiKeyConfig.ts ➔ const DEFAULT_API_KEY = &apos;ваш_ключ&apos;;
            </p>
            <p className="text-[11px] text-slate-500">
              В автономном файле index.html ключ вставляется в начале тега &lt;script&gt; в константу DEFAULT_API_KEY. Тогда школьникам вообще не придётся ничего вводить.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Отмена
          </button>
          <button
            id="btn-save-api-config"
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
          >
            {savedSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Сохранено!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Сохранить в браузер</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
