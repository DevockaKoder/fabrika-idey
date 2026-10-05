import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AssistantPicker } from './components/AssistantPicker';
import { IdeaExport } from './components/IdeaExport';
import { ChatInterface } from './components/ChatInterface';
import { ApiConfigModal } from './components/ApiConfigModal';
import { SCENARIOS } from './data/scenarios';
import { Scenario, ChatMessage, ApiSettings } from './types';
import { sendChatMessage } from './services/aiService';
import {
  DEFAULT_API_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  DEFAULT_BACKEND_URL,
} from './config/apiKeyConfig';

// Пять публичных помощников; сценарий «свой персонаж» и все системные промпты остаются под капотом
const ASSISTANTS = SCENARIOS.filter((s) => s.id !== 'custom-scenario');

export default function App() {
  // 1. API Settings state with default from config or localStorage
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    try {
      const saved = localStorage.getItem('idea_lab_api_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If default key is configured, synchronize provider and model with DEFAULT_PROVIDER
        if (DEFAULT_API_KEY) {
          if (!parsed.apiKey || parsed.apiKey === DEFAULT_API_KEY) {
            parsed.apiKey = DEFAULT_API_KEY;
            parsed.provider = DEFAULT_PROVIDER;
            parsed.model = DEFAULT_MODEL;
            parsed.baseUrl = DEFAULT_BASE_URL;
          }
        }
        if (DEFAULT_BACKEND_URL && !parsed.backendUrl) {
          parsed.backendUrl = DEFAULT_BACKEND_URL;
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return {
      provider: DEFAULT_PROVIDER,
      apiKey: DEFAULT_API_KEY,
      baseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      backendUrl: DEFAULT_BACKEND_URL,
    };
  });

  // 2. Modals state
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  // 3. Assistant state
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(ASSISTANTS[0]);

  // 4. Chat messages state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('idea_lab_messages');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);

  // Persist messages to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('idea_lab_messages', JSON.stringify(messages));
  }, [messages]);

  // Смена помощника начинает новый чистый диалог (его промпт зашит под капотом)
  const handleSelectScenario = (scenario: Scenario) => {
    if (scenario.id === selectedScenario.id) return;
    setSelectedScenario(scenario);
    setMessages([]);
    sessionStorage.removeItem('idea_lab_messages');
  };

  // Handle Sending a Message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: timeStr,
      scenarioTitle: selectedScenario.title,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const replyText = await sendChatMessage(
        apiSettings,
        selectedScenario.systemPrompt,
        updatedMessages
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        scenarioTitle: selectedScenario.title,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Ошибка при обращении к нейросети: ${error.message || 'Не удалось получить ответ'}\n\n💡 Совет: Проверьте правильность API-ключа в кнопке «Ключ API» вверху страницы или укажите его в файле конфигурации src/config/apiKeyConfig.ts.`,
        timestamp: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        scenarioTitle: selectedScenario.title,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle saving API settings
  const handleSaveApiSettings = (newSettings: ApiSettings) => {
    setApiSettings(newSettings);
    localStorage.setItem('idea_lab_api_settings', JSON.stringify(newSettings));
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Header with title and API key status */}
      <Header
        apiSettings={apiSettings}
        onOpenApiConfig={() => setIsApiModalOpen(true)}
      />

      {/* Main Two-Column Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: ИИ-помощники + выгрузка идеи (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <AssistantPicker
            assistants={ASSISTANTS}
            selected={selectedScenario}
            onSelect={handleSelectScenario}
          />
          <IdeaExport />
        </div>

        {/* Right Column: Интерактивный диалог (7 cols) */}
        <div className="lg:col-span-7 h-[740px] flex flex-col">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onClearChat={() => setMessages([])}
            selectedScenario={selectedScenario}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <span>
            ИИ-сервис «Фабрика идей» • КГЭУ, кафедра ИТИС
          </span>
        </div>
      </footer>

      {/* API Configuration Modal */}
      <ApiConfigModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        settings={apiSettings}
        onSave={handleSaveApiSettings}
      />
    </div>
  );
}
