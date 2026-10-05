import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Download,
  Bot,
  User,
  Trash2,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { ChatMessage, Scenario } from '../types';
import { AFFILIATION, SERVICE_URL } from '../config/serviceInfo';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  selectedScenario: Scenario;
}

export function ChatInterface({
  messages,
  isLoading,
  onSendMessage,
  onClearChat,
  selectedScenario,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('idea_lab_student_name') || '';
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const effectiveRoleName = selectedScenario.title;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownloadDialog = () => {
    const defaultName = studentName.trim() || 'Ученик';
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU');
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const serviceUrl = SERVICE_URL.trim() || window.location.origin;

    let report = `=======================================================\n`;
    report += `СТЕНОГРАММА ДИАЛОГА — ИИ-СЕРВИС «ФАБРИКА ИДЕЙ»\n`;
    report += `=======================================================\n\n`;
    report += `Аффилиация: ${AFFILIATION}\n`;
    report += `Ссылка на сайт: ${serviceUrl}\n`;
    report += `Ученик: ${defaultName}\n`;
    report += `Дата и время проведения: ${dateStr} ${timeStr}\n`;
    report += `ИИ-помощник: ${effectiveRoleName} (${selectedScenario.category})\n`;
    report += `Задача бота: ${selectedScenario.taskGoal}\n\n`;
    report += `-------------------------------------------------------\n`;
    report += `СТЕНОГРАММА ДИАЛОГА (${messages.length} реплик):\n`;
    report += `-------------------------------------------------------\n\n`;

    if (messages.length === 0) {
      report += `[Диалог не проводился / сообщения отсутствуют]\n`;
    } else {
      messages.forEach((m, idx) => {
        const sender = m.role === 'user' ? `[${defaultName}]` : `[ИИ: ${effectiveRoleName}]`;
        report += `${idx + 1}. ${sender} (${m.timestamp}):\n${m.content}\n\n`;
      });
    }

    report += `=======================================================\n`;
    report += `Подпись наставника / Оценка: ___________________________\n`;
    report += `=======================================================\n`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = defaultName.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
    link.href = url;
    link.download = `ФабрикаИдей_диалог_${safeName}_${now.toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatMessageText = (content: string) => {
    // Simple markdown-like formatter for bullet points and bold text
    const lines = content.split('\n');
    return lines.map((line, lineIndex) => {
      // Bold text replacement
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      return (
        <p key={lineIndex} className={line === '' ? 'h-2' : 'leading-relaxed'}>
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Right Column Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Обсуждение идеи
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {messages.length} сообщ.
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate max-w-[240px]">
              Помощник: <span className="text-indigo-600 font-medium">{effectiveRoleName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-clear-chat"
            onClick={onClearChat}
            disabled={messages.length === 0}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-500 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 bg-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Очистить</span>
          </button>

          <button
            id="btn-download-dialog"
            onClick={handleDownloadDialog}
            className="flex items-center gap-1 text-xs font-bold text-slate-800 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 bg-white transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать диалог</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-sm font-bold text-slate-800">
                Обсуждение идеи проекта с ИИ-помощником
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Нажмите на одну из готовых реплик ниже или напишите своё сообщение,
                чтобы обсудить идею с помощником «{effectiveRoleName}».
              </p>
            </div>

            {/* Quick Starter Suggestions */}
            <div className="w-full max-w-lg pt-2 space-y-2 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Стартовые реплики для обсуждения:
              </span>
              <div className="space-y-1.5">
                {selectedScenario.suggestedPrompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(promptText)}
                    className="w-full text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-xs text-slate-700 transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <span>«{promptText}»</span>
                    <Send className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative max-w-[85%] rounded-2xl p-3.5 text-xs shadow-2xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                    <span className="font-semibold">
                      {isUser ? studentName.trim() || 'Пользователь' : effectiveRoleName}
                    </span>
                    <span className="font-mono">{m.timestamp}</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {formatMessageText(m.content)}
                  </div>

                  {!isUser && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end">
                      <button
                        onClick={() => handleCopyMessage(m.id, m.content)}
                        className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing Status Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5 justify-start animate-in fade-in">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs text-slate-600 shadow-2xs flex items-center gap-2">
              <span className="font-medium">ИИ печатает...</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
        {/* Optional Student Name Tag */}
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[11px] text-slate-400 font-medium shrink-0">
            Имя ученика для отчётов:
          </label>
          <input
            id="input-student-name"
            type="text"
            value={studentName}
            onChange={(e) => {
              setStudentName(e.target.value);
              localStorage.setItem('idea_lab_student_name', e.target.value);
            }}
            placeholder="Например: Артём Смирнов (9Б)"
            className="text-xs px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[200px]"
          />
        </div>

        <div className="flex items-end gap-2">
          <textarea
            id="input-chat-message"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите реплику для ИИ (Enter — отправить, Shift+Enter — перенос строки)..."
            rows={2}
            className="flex-1 p-3 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed"
          />

          <button
            id="btn-send-message"
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <span>Отправить</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
