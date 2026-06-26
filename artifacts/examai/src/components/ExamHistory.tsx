import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Trash2, Download, Search, X, Clock, BookOpen } from "lucide-react";
import { loadHistory, removeHistoryEntry, saveHistory, ExamEntry, formatRelativeTime, ExamQuestion } from "@/lib/utils";
import { exportToWord } from "@/lib/wordExport";

interface Props {
  refreshKey?: number;
}

export default function ExamHistory({ refreshKey }: Props) {
  const [history, setHistory] = useState<ExamEntry[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (e) =>
        e.filename.toLowerCase().includes(q) ||
        e.provider.toLowerCase().includes(q) ||
        (e.subject || "").toLowerCase().includes(q)
    );
  }, [history, search]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeHistoryEntry(id);
    setHistory(loadHistory());
    if (expanded === id) setExpanded(null);
  };

  const handleDownload = (entry: ExamEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    exportToWord(entry.questions, entry.filename, entry.provider);
  };

  const handleClearAll = () => {
    if (confirm("¿Borrar todo el historial? Esta acción no se puede deshacer.")) {
      saveHistory([]);
      setHistory([]);
      setExpanded(null);
    }
  };

  if (history.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          <BookOpen size={24} className="text-white/30" />
        </div>
        <p className="text-white/40 text-sm">No hay exámenes generados aún.</p>
        <p className="text-white/25 text-xs mt-1">Los exámenes guardados aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-white/06">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-white/40" />
          <span className="text-sm font-semibold text-white/70">Historial Reciente</span>
          <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "none" }}>
            {history.length}
          </span>
        </div>
        <button onClick={handleClearAll} className="text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1">
          <Trash2 size={11} />
          Limpiar todo
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/05">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por archivo, IA, materia..."
            className="input-glass pl-8 pr-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-white/05" style={{ maxHeight: 420, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-white/30 text-sm">Sin resultados para "{search}"</div>
        ) : (
          filtered.map((entry, idx) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              isExpanded={expanded === entry.id}
              showAnswers={showAnswers}
              onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
              onDelete={(e) => handleDelete(entry.id, e)}
              onDownload={(e) => handleDownload(entry, e)}
              onToggleAnswers={() => setShowAnswers((v) => !v)}
              idx={idx}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryRow({
  entry, isExpanded, showAnswers, onToggle, onDelete, onDownload, onToggleAnswers, idx,
}: {
  entry: ExamEntry; isExpanded: boolean; showAnswers: boolean;
  onToggle: () => void; onDelete: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void; onToggleAnswers: () => void; idx: number;
}) {
  const diffClass = entry.difficulty === "fácil" ? "badge-easy" : entry.difficulty === "difícil" ? "badge-hard" : "badge-medium";
  const provClass = `badge-${entry.provider}`;

  return (
    <div>
      <div
        className="history-row"
        onClick={onToggle}
        style={{ animationDelay: `${idx * 40}ms` }}
      >
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)" }}>
          <BookOpen size={15} className="text-white/40" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-white/85 truncate max-w-36">{entry.filename}</span>
            <span className={`badge ${provClass}`}>{entry.provider}</span>
            <span className={`badge ${diffClass}`}>{entry.difficulty}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-white/35">{entry.questionCount} preguntas</span>
            <span className="text-white/15 text-xs">·</span>
            <span className="text-xs text-white/30">{formatRelativeTime(entry.timestamp)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onDownload}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: "rgba(10,132,255,0.1)" }}
            title="Descargar Word"
          >
            <Download size={13} className="text-blue-400" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: "rgba(255,69,58,0.1)" }}
            title="Eliminar"
          >
            <Trash2 size={13} className="text-red-400" />
          </button>
          {isExpanded ? (
            <ChevronUp size={15} className="text-white/30" />
          ) : (
            <ChevronDown size={15} className="text-white/30" />
          )}
        </div>
      </div>

      {/* Expanded Questions */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/05 mt-1 animate-fade-in">
          <div className="flex items-center justify-between my-3">
            <span className="text-xs text-white/40 font-medium">{entry.questions.length} preguntas</span>
            <button
              onClick={onToggleAnswers}
              className="text-xs px-3 py-1 rounded-lg transition-all"
              style={{
                background: showAnswers ? "rgba(10,132,255,0.15)" : "rgba(255,255,255,0.06)",
                color: showAnswers ? "#0A84FF" : "rgba(255,255,255,0.5)",
              }}
            >
              {showAnswers ? "Ocultar respuestas" : "Mostrar respuestas"}
            </button>
          </div>
          <div className="space-y-2" style={{ maxHeight: 300, overflowY: "auto" }}>
            {entry.questions.map((q: ExamQuestion, i: number) => (
              <div key={i} className="question-card">
                <p className="text-xs font-semibold text-white/80 mb-2">
                  {i + 1}. {q.question}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {q.options.map((opt, j) => {
                    const letter = ["A", "B", "C", "D"][j];
                    const isCorrect = showAnswers && letter === q.answer;
                    return (
                      <div
                        key={j}
                        className="text-xs px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: isCorrect ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isCorrect ? "rgba(52,199,89,0.3)" : "rgba(255,255,255,0.06)"}`,
                          color: isCorrect ? "#6EE08B" : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {opt}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
