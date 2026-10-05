import {
  Compass,
  GraduationCap,
  Lightbulb,
  Gavel,
  Mic,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Scenario } from '../types';

interface AssistantPickerProps {
  assistants: Scenario[];
  selected: Scenario;
  onSelect: (scenario: Scenario) => void;
}

function renderAssistantIcon(iconName: string) {
  switch (iconName) {
    case 'GraduationCap':
      return <GraduationCap className="w-4 h-4 text-indigo-600" />;
    case 'Lightbulb':
      return <Lightbulb className="w-4 h-4 text-amber-600" />;
    case 'Gavel':
      return <Gavel className="w-4 h-4 text-rose-600" />;
    case 'Mic':
      return <Mic className="w-4 h-4 text-emerald-600" />;
    case 'BookOpen':
      return <BookOpen className="w-4 h-4 text-blue-600" />;
    default:
      return <Sparkles className="w-4 h-4 text-purple-600" />;
  }
}

export function AssistantPicker({
  assistants,
  selected,
  onSelect,
}: AssistantPickerProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              ИИ-помощники
            </h2>
            <p className="text-xs text-slate-500">
              Выберите собеседника для обсуждения идеи
            </p>
          </div>
        </div>
      </div>

      {/* Assistant List */}
      <div className="p-3 sm:p-4 space-y-2">
        {assistants.map((s) => {
          const isActive = s.id === selected.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                isActive
                  ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/30 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isActive ? 'bg-white border border-indigo-200' : 'bg-slate-100 border border-slate-200'
                }`}
              >
                {renderAssistantIcon(s.icon)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold ${isActive ? 'text-indigo-900' : 'text-slate-900'}`}>
                    {s.title}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {s.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  {s.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Assistant Goal */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
        <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            {renderAssistantIcon(selected.icon)}
            <span>Задача бота:</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            {selected.taskGoal}
          </p>
        </div>
        <p className="text-[10px] text-slate-400 text-center">
          Правила поведения помощника зашиты в системный промпт под капотом. При смене помощника диалог очищается.
        </p>
      </div>
    </div>
  );
}
