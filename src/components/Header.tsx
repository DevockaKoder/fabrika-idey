import {
  Key,
  Lightbulb,
} from 'lucide-react';
import { ApiSettings } from '../types';

interface HeaderProps {
  apiSettings: ApiSettings;
  onOpenApiConfig: () => void;
}

export function Header({
  apiSettings,
  onOpenApiConfig,
}: HeaderProps) {
  const isConfigured = Boolean(apiSettings.apiKey && apiSettings.apiKey.trim());

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 gap-3">
          
          {/* Logo & Main Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  Фабрика идей
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  КГЭУ • кафедра ИТИС
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Обсуждение и проработка идей школьного проекта с ИИ-помощниками
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* API Config Button */}
            <button
              id="btn-open-api-config"
              onClick={onOpenApiConfig}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                isConfigured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>
                {isConfigured
                  ? `${apiSettings.provider === 'gigachat' ? 'GigaChat' : 'API'} (Подключен)`
                  : 'Ключ API'}
              </span>
              <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
