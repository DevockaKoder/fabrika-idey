import { useState } from 'react';
import {
  FileDown,
  Download,
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  CheckCircle2,
} from 'lucide-react';
import { AFFILIATION, SERVICE_URL } from '../config/serviceInfo';

const BOX_COUNT = 5;
const BOXES_STORAGE_KEY = 'idea_lab_idea_boxes';
const STUDENT_NAME_KEY = 'idea_lab_student_name';

function loadInitialBoxes(): string[] {
  try {
    const saved = localStorage.getItem(BOXES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === BOX_COUNT) {
        return parsed.map((v: unknown) => (typeof v === 'string' ? v : ''));
      }
    }
  } catch (e) {
    console.error(e);
  }
  return Array(BOX_COUNT).fill('');
}

export function IdeaExport() {
  const [boxes, setBoxes] = useState<string[]>(loadInitialBoxes);
  const [copied, setCopied] = useState(false);
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  const setBox = (index: number, value: string) => {
    const next = [...boxes];
    next[index] = value;
    setBoxes(next);
    localStorage.setItem(BOXES_STORAGE_KEY, JSON.stringify(next));
  };

  const handleClear = () => {
    setBoxes(Array(BOX_COUNT).fill(''));
    localStorage.removeItem(BOXES_STORAGE_KEY);
  };

  const buildReport = (): string => {
    const studentName =
      localStorage.getItem(STUDENT_NAME_KEY)?.trim() || '—';
    const serviceUrl = SERVICE_URL.trim() || window.location.origin;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU');
    const timeStr = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let report = `=======================================================\n`;
    report += `ВЫГРУЗКА ИДЕИ — ИИ-СЕРВИС «ФАБРИКА ИДЕЙ»\n`;
    report += `=======================================================\n\n`;
    report += `Аффилиация: ${AFFILIATION}\n`;
    report += `Ссылка на сайт: ${serviceUrl}\n`;
    report += `Ученик: ${studentName}\n`;
    report += `Дата: ${dateStr} ${timeStr}\n\n`;

    const filledIdeas = boxes.map((b) => b.trim()).filter((b) => b.length > 0);
    if (filledIdeas.length === 0) {
      report += `[Идеи не заполнены]\n`;
    } else {
      filledIdeas.forEach((text, idx) => {
        report += `-------------------------------------------------------\n`;
        report += `Идея ${idx + 1}:\n`;
        report += `-------------------------------------------------------\n`;
        report += `${text}\n\n`;
      });
    }

    report += `=======================================================\n`;
    report += `Подпись наставника / Оценка: ___________________________\n`;
    report += `=======================================================\n`;
    return report;
  };

  const handleDownload = () => {
    const report = buildReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const studentName =
      localStorage.getItem(STUDENT_NAME_KEY)?.trim() || 'Ученик';
    const safeName = studentName.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
    link.href = url;
    link.download = `ФабрикаИдей_отчёт_${safeName}_${new Date()
      .toISOString()
      .slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadedNotice(true);
    setTimeout(() => setDownloadedNotice(false), 2500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
            <FileDown className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Выгрузка идеи
            </h2>
            <p className="text-xs text-slate-500">
              Вставьте скопированные фрагменты — они соберутся в отчёт
            </p>
          </div>
        </div>
      </div>

      {/* Idea Boxes */}
      <div className="p-3 sm:p-4 space-y-2">
        {boxes.map((value, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-12 shrink-0 pt-2.5 text-right">
              Идея {idx + 1}
            </span>
            <textarea
              value={value}
              onChange={(e) => setBox(idx, e.target.value)}
              placeholder="Вставьте сюда скопированный текст из диалога..."
              rows={2}
              className="flex-1 p-2.5 text-xs text-slate-800 bg-slate-50/50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y leading-relaxed"
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
        <button
          type="button"
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Сформировать и скачать отчёт</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-indigo-300 hover:text-indigo-700 rounded-xl transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Скопировано</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Скопировать отчёт</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-500 bg-white border border-slate-300 hover:border-rose-300 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Очистить</span>
          </button>
        </div>
        {downloadedNotice && (
          <p className="text-center text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Отчёт сформирован: аффилиация, ссылка на сайт и ваши идеи
          </p>
        )}
        <p className="text-[10px] text-slate-400 leading-snug">
          <ClipboardPaste className="w-3 h-3 inline mr-0.5" />
          В отчёт попадут только заполненные поля (идеи нумеруются по порядку).
          Черновики сохраняются в браузере — не пропадут при обновлении страницы.
        </p>
      </div>
    </div>
  );
}
