import { useState, useMemo } from "react";
import {
  Eye, EyeOff, RefreshCw, Upload, ChevronDown, ChevronUp,
  FileText, File, CheckCircle2, XCircle, Trophy,
} from "lucide-react";
import { ExamQuestion, Provider, Difficulty, QuestionType } from "@/lib/utils";
import { exportToWord } from "@/lib/wordExport";
import { exportToPdf } from "@/lib/pdfExport";

interface Props {
  questions: ExamQuestion[];
  filename: string;
  provider: Provider;
  difficulty: Difficulty;
  onRegenerateWithSameDoc: () => void;
  onUploadDifferentDoc: () => void;
}

const LETTERS = ["A", "B", "C", "D"] as const;

function highlightBlanks(text: string): React.ReactNode {
  const parts = text.split(/(_{3,})/g);
  return parts.map((part, i) =>
    /^_{3,}$/.test(part)
      ? <span key={i} className="inline-block px-2 mx-0.5 font-mono border-b-2 border-blue-500 text-blue-400/40">_____</span>
      : <span key={i}>{part}</span>
  );
}

function TypeBadge({ type }: { type: QuestionType }) {
  const cfg = {
    multiple:  { label: "Alternativas", bg: "rgba(10,132,255,0.12)",   text: "#409CFF", border: "rgba(10,132,255,0.22)" },
    truefalse: { label: "V / F",        bg: "rgba(52,199,89,0.10)",    text: "#34C759", border: "rgba(52,199,89,0.2)"  },
    complete:  { label: "Completar",    bg: "rgba(255,159,10,0.10)",   text: "#FF9F0A", border: "rgba(255,159,10,0.2)" },
    match:     { label: "Relacionar",   bg: "rgba(175,82,222,0.10)",   text: "#BF5AF2", border: "rgba(175,82,222,0.2)"},
  }[type];
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

interface ChoiceProps {
  q: ExamQuestion; idx: number; chosen: string | undefined;
  isAnswered: boolean; showAnswers: boolean; isTrueFalse: boolean;
  onAnswer: (idx: number, letter: string) => void;
}
function ChoiceOptions({ q, idx, chosen, isAnswered, showAnswers, isTrueFalse, onAnswer }: ChoiceProps) {
  const letters = isTrueFalse ? (["A", "B"] as const) : LETTERS;
  const displayText = (opt: string, j: number) =>
    isTrueFalse ? (j === 0 ? "Verdadero" : "Falso") : opt.replace(/^[ABCD]\)\s*/, "");

  return (
    <div className={isTrueFalse ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-2"}>
      {letters.map((letter, j) => {
        const opt = q.options[j] ?? "";
        const isCorrect = letter === q.answer;
        const isChosen = chosen === letter;
        let cls = "";
        let style: React.CSSProperties = {};

        if (isAnswered) {
          if (isChosen && isCorrect)          cls = "bg-green-950/40 border-green-500 text-green-200";
          else if (isChosen && !isCorrect)    cls = "bg-red-950/40 border-red-500 text-red-200";
          else if (!isChosen && isCorrect)    cls = "bg-green-950/40 border-green-500 text-green-200";
          else                               style = { opacity: 0.3 };
        } else if (showAnswers && isCorrect) {
          cls = "bg-green-950/40 border-green-500 text-green-200";
        }

        return (
          <button key={j} disabled={isAnswered}
            onClick={() => onAnswer(idx, letter)}
            style={style}
            className={[
              "option-btn w-full text-left transition-all duration-200",
              isTrueFalse ? "py-3.5 font-semibold" : "",
              cls,
              !isAnswered && !showAnswers ? "hover:border-white/25 hover:bg-white/08 cursor-pointer" : "cursor-default",
            ].join(" ")}
          >
            <div className={`flex items-center gap-1.5 w-full ${isTrueFalse ? "justify-center" : ""}`}>
              {!isTrueFalse && <span className="font-bold opacity-60 flex-shrink-0">{letter})</span>}
              <span className={isTrueFalse ? "text-sm" : "flex-1"}>{displayText(opt, j)}</span>
              {isAnswered && isCorrect  && <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />}
              {isAnswered && isChosen && !isCorrect && <XCircle size={13} className="text-red-400 flex-shrink-0" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getShuffledRight(pairs: any[], qId: number, idx: number) {
  const seed = (qId ?? idx) + 3;
  const list = pairs.map((p, i) => ({ text: p.right, originalIndex: i }));
  for (let i = list.length - 1; i > 0; i--) {
    const j = ((seed * 7 + i * 13) % (i + 1) + (i + 1)) % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function CompleteQuestion({
  q, idx, userAnswer, onValidate, showAnswers
}: {
  q: ExamQuestion; idx: number; userAnswer: string | undefined; onValidate: (i: number, answer: string) => void; showAnswers: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const isAnswered = userAnswer !== undefined;

  const normalize = (str: string) =>
    str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isCorrect = isAnswered && userAnswer && normalize(userAnswer) === normalize(q.answer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onValidate(idx, inputValue);
  };

  return (
    <div className="space-y-3">
      {isAnswered ? (
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl"
          style={{
            background: isCorrect ? "rgba(52,199,89,0.06)" : "rgba(255,69,58,0.06)",
            border: isCorrect ? "1px solid rgba(52,199,89,0.2)" : "1px solid rgba(255,69,58,0.2)"
          }}>
          <div className="flex items-start gap-2.5">
            {isCorrect ? (
              <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: isCorrect ? "#34C759" : "#FF453A" }}>
                {isCorrect ? "Respuesta Correcta" : "Respuesta Incorrecta"}
              </p>
              <p className="text-sm font-semibold text-white/80">Tu respuesta: {userAnswer}</p>
              {!isCorrect && (
                <p className="text-xs font-medium text-red-300 mt-1">
                  Respuesta correcta: <span className="underline font-semibold">{q.answer}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Escribe tu respuesta aquí..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button type="submit" className="btn-primary py-2 px-4 text-xs font-semibold rounded-xl">
            Validar respuesta
          </button>
        </form>
      )}
      {showAnswers && !isAnswered && (
        <div className="text-xs text-emerald-400/80 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
          Solución: <span className="font-semibold">{q.answer}</span>
        </div>
      )}
    </div>
  );
}

function MatchQuestion({
  q, idx, userAnswer, onValidate, showAnswers
}: {
  q: ExamQuestion; idx: number; userAnswer: string | undefined; onValidate: (i: number, answer: string) => void; showAnswers: boolean;
}) {
  const pairs = q.pairs ?? [];
  const isAnswered = userAnswer !== undefined;

  const shuffledRight = useMemo(() => {
    return getShuffledRight(pairs, q.id, idx);
  }, [pairs, q.id, idx]);

  const [choices, setChoices] = useState<Record<number, number>>({});

  const parsedUserAnswers = useMemo(() => {
    if (!userAnswer) return null;
    try {
      return JSON.parse(userAnswer) as Record<number, number>;
    } catch {
      return null;
    }
  }, [userAnswer]);

  const handleSelectChange = (leftIdx: number, valStr: string) => {
    const val = parseInt(valStr, 10);
    setChoices(prev => ({ ...prev, [leftIdx]: val }));
  };

  const handleValidate = () => {
    onValidate(idx, JSON.stringify(choices));
  };

  const letters = ["A", "B", "C", "D"];

  if (!pairs.length) {
    return (
      <p className="text-xs text-white/30 italic">Sin pares de correspondencia disponibles.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column A */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-1">Columna A (Conceptos)</p>
          {pairs.map((pair, leftIdx) => {
            const chosenOptionIdx = isAnswered ? parsedUserAnswers?.[leftIdx] : choices[leftIdx];
            const isCorrect = isAnswered && chosenOptionIdx !== undefined && shuffledRight[chosenOptionIdx]?.originalIndex === leftIdx;

            return (
              <div key={leftIdx} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs font-semibold text-white/90 flex-1">{leftIdx + 1}. {pair.left}</span>
                <select
                  disabled={isAnswered}
                  value={chosenOptionIdx !== undefined ? chosenOptionIdx : ""}
                  onChange={(e) => handleSelectChange(leftIdx, e.target.value)}
                  className={`bg-black/40 border text-xs rounded-lg px-2 py-1.5 focus:outline-none transition-colors ${
                    isAnswered
                      ? isCorrect
                        ? "border-green-500/50 text-green-200"
                        : "border-red-500/50 text-red-200"
                      : "border-white/10 text-white/80 focus:border-blue-500"
                  }`}
                >
                  <option value="" disabled className="bg-neutral-900">[Seleccionar...]</option>
                  {shuffledRight.map((r, rIdx) => (
                    <option key={rIdx} value={rIdx} className="bg-neutral-900">
                      Definición {letters[rIdx]}
                    </option>
                  ))}
                </select>
                {isAnswered && (
                  isCorrect ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <XCircle size={14} className="text-red-400" />
                      <span className="text-[10px] font-bold text-emerald-400/80">
                        ({letters[shuffledRight.findIndex(r => r.originalIndex === leftIdx)]})
                      </span>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Column B */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-1">Columna B (Definiciones)</p>
          {shuffledRight.map((r, rIdx) => (
            <div key={rIdx} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-start gap-2 min-h-[50px]">
              <span className="font-bold text-blue-400/80 mt-0.5">{letters[rIdx]}.</span>
              <span className="text-white/70 leading-relaxed">{r.text}</span>
            </div>
          ))}
        </div>
      </div>

      {!isAnswered && (
        <button
          onClick={handleValidate}
          disabled={Object.keys(choices).length < pairs.length}
          className="btn-primary w-full justify-center gap-2 py-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
        >
          Validar uniones
        </button>
      )}

      {showAnswers && !isAnswered && (
        <div className="text-xs space-y-1 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300">
          <p className="font-bold mb-1">Correspondencias correctas:</p>
          {pairs.map((p, pIdx) => {
            const letter = letters[shuffledRight.findIndex(r => r.originalIndex === pIdx)];
            return <div key={pIdx}>{pIdx + 1}. {p.left} &rarr; <span className="font-semibold text-emerald-400">Definición {letter}</span></div>;
          })}
        </div>
      )}
    </div>
  );
}

export default function ExamResult({
  questions, filename, provider, difficulty,
  onRegenerateWithSameDoc, onUploadDifferentDoc,
}: Props) {
  const [showAnswers, setShowAnswers]   = useState(false);
  const [expandedIds, setExpandedIds]   = useState<Set<number>>(new Set());
  const [userAnswers, setUserAnswers]   = useState<Record<number, string>>({});

  const toggleExpand = (idx: number) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });

  const handleAnswer = (idx: number, letter: string) => {
    if (userAnswers[idx] !== undefined) return;
    setUserAnswers((p) => ({ ...p, [idx]: letter }));
    setExpandedIds((p) => new Set(p).add(idx));
  };

  const score = useMemo(() => {
    let quizTotal = 0, answered = 0, correct = 0;
    
    const normalize = (str: string) =>
      str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    questions.forEach((q, i) => {
      const t = q.type ?? "multiple";
      quizTotal++;
      const ans = userAnswers[i];
      if (ans !== undefined) {
        answered++;
        if (t === "multiple" || t === "truefalse") {
          if (ans === q.answer) correct++;
        } else if (t === "complete") {
          if (normalize(ans) === normalize(q.answer)) correct++;
        } else if (t === "match") {
          try {
            const choices = JSON.parse(ans) as Record<number, number>;
            const pairs = q.pairs ?? [];
            const shuffledRight = getShuffledRight(pairs, q.id, i);
            let allCorrect = true;
            for (let leftIdx = 0; leftIdx < pairs.length; leftIdx++) {
              const chosenRightIdx = choices[leftIdx];
              if (chosenRightIdx === undefined || shuffledRight[chosenRightIdx]?.originalIndex !== leftIdx) {
                allCorrect = false;
                break;
              }
            }
            if (allCorrect) correct++;
          } catch {}
        }
      }
    });
    return { quizTotal, answered, correct, totalInteracted: Object.keys(userAnswers).length };
  }, [userAnswers, questions]);

  const allQuizAnswered = score.answered === score.quizTotal && score.quizTotal > 0;

  const provClass  = `badge-${provider}`;
  const diffClass  = difficulty === "fácil" ? "badge-easy" : difficulty === "difícil" ? "badge-hard" : "badge-medium";

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="glass rounded-3xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h2 className="text-lg font-bold text-white">Quiz Interactivo</h2>
              <span className={`badge ${provClass}`}>{provider}</span>
              <span className={`badge ${diffClass}`}>{difficulty}</span>
            </div>
            <p className="text-sm text-white/45 truncate max-w-72">{filename}</p>
            <p className="text-xs text-white/30 mt-0.5">
              {questions.length} preguntas · {score.totalInteracted} respondidas
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAnswers((v) => !v)} className="btn-secondary text-sm gap-2">
              {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
              {showAnswers ? "Ocultar clave" : "Ver clave"}
            </button>
            <button onClick={() => exportToWord(questions, filename, provider, userAnswers)} className="btn-secondary text-sm">
              <FileText size={14} /><span className="hidden sm:inline">Word</span>
            </button>
            <button onClick={() => exportToPdf(questions, filename, provider, difficulty, userAnswers)} className="btn-primary text-sm">
              <File size={14} />PDF
            </button>
          </div>
        </div>

        {/* Score bar */}
        {score.quizTotal > 0 && score.answered > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Puntuación</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: allQuizAnswered ? "#34C759" : "#0A84FF" }}>
                {score.correct} / {score.quizTotal} correctas
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${(score.answered / score.quizTotal) * 100}%`,
                background: allQuizAnswered
                  ? score.correct === score.quizTotal  ? "linear-gradient(90deg,#34C759,#30D158)"
                    : score.correct >= score.quizTotal * 0.6 ? "linear-gradient(90deg,#FF9F0A,#FFB340)"
                    : "linear-gradient(90deg,#FF453A,#FF6961)"
                  : "linear-gradient(90deg,#0A84FF,#409CFF)",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Final score banner */}
      {allQuizAnswered && (
        <div className="rounded-3xl p-5 flex items-center gap-4 animate-fade-in-up" style={{
          background: score.correct === score.quizTotal ? "rgba(52,199,89,0.08)" : score.correct >= score.quizTotal * 0.6 ? "rgba(255,159,10,0.07)" : "rgba(255,69,58,0.07)",
          border: `1px solid ${score.correct === score.quizTotal ? "rgba(52,199,89,0.25)" : score.correct >= score.quizTotal * 0.6 ? "rgba(255,159,10,0.22)" : "rgba(255,69,58,0.22)"}`,
        }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{
            background: score.correct === score.quizTotal ? "rgba(52,199,89,0.15)" : score.correct >= score.quizTotal * 0.6 ? "rgba(255,159,10,0.14)" : "rgba(255,69,58,0.12)",
          }}>
            <Trophy size={22} className={score.correct === score.quizTotal ? "text-emerald-400" : score.correct >= score.quizTotal * 0.6 ? "text-amber-400" : "text-red-400"} />
          </div>
          <div>
            <p className="text-base font-bold text-white">
              {score.correct === score.quizTotal ? "Perfecto — Excelente dominio del tema"
                : score.correct >= score.quizTotal * 0.6 ? "Bien — Revisa las respuestas incorrectas"
                : "Sigue practicando — Repasa el documento"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {score.correct} de {score.quizTotal} preguntas de selección correctas · {Math.round((score.correct / score.quizTotal) * 100)}%
            </p>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q, i) => {
          const qType: QuestionType = q.type ?? "multiple";
          const chosen     = userAnswers[i];
          const isAnswered = chosen !== undefined;
          const isExpanded = expandedIds.has(i) || showAnswers;

          const headerIcon = () => {
            if (!isAnswered) return null;
            if (chosen === "revealed") return <Eye size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />;
            
            const normalize = (str: string) =>
              str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            if (qType === "complete") {
              const isCorrect = normalize(chosen) === normalize(q.answer);
              return isCorrect
                ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                : <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />;
            }

            if (qType === "match") {
              try {
                const choices = JSON.parse(chosen) as Record<number, number>;
                const pairs = q.pairs ?? [];
                const shuffledRight = getShuffledRight(pairs, q.id, i);
                let allCorrect = true;
                for (let leftIdx = 0; leftIdx < pairs.length; leftIdx++) {
                  const chosenRightIdx = choices[leftIdx];
                  if (chosenRightIdx === undefined || shuffledRight[chosenRightIdx]?.originalIndex !== leftIdx) {
                    allCorrect = false;
                    break;
                  }
                }
                return allCorrect
                  ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />;
              } catch {
                return <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />;
              }
            }

            return chosen === q.answer
              ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              : <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />;
          };

          return (
            <div key={q.id ?? i} className="question-card">
              <div className="flex items-start justify-between cursor-pointer gap-2" onClick={() => toggleExpand(i)}>
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {headerIcon()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-blue-400 text-sm font-bold">#{i + 1}</span>
                      <TypeBadge type={qType} />
                    </div>
                    <p className="text-sm font-semibold text-white/85 leading-relaxed">
                      {qType === "complete" ? highlightBlanks(q.question) : q.question}
                    </p>
                  </div>
                </div>
                <button className="text-white/20 flex-shrink-0 mt-0.5">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  {(qType === "multiple" || qType === "truefalse") && (
                    <ChoiceOptions q={q} idx={i} chosen={chosen} isAnswered={isAnswered}
                      showAnswers={showAnswers} isTrueFalse={qType === "truefalse"} onAnswer={handleAnswer} />
                  )}
                  {qType === "complete" && (
                    <CompleteQuestion q={q} idx={i} userAnswer={chosen} onValidate={handleAnswer} showAnswers={showAnswers} />
                  )}
                  {qType === "match" && (
                    <MatchQuestion q={q} idx={i} userAnswer={chosen} onValidate={handleAnswer} showAnswers={showAnswers} />
                  )}

                  {(isAnswered || showAnswers) && q.explanation && (
                    <div className="text-xs text-white/50 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <span className="font-semibold text-blue-400/80">Explicación: </span>
                      {q.explanation}
                    </div>
                  )}
                  {!isAnswered && !showAnswers && (qType === "multiple" || qType === "truefalse") && (
                    <p className="text-[11px] text-white/25 text-center pt-0.5">
                      Selecciona una opción para validar tu respuesta
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="glass rounded-3xl p-5">
        <p className="text-xs text-white/40 text-center mb-4 font-medium">¿Qué deseas hacer ahora?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={onRegenerateWithSameDoc} className="btn-primary justify-center py-3.5 text-sm"
            style={{ background: "rgba(10,132,255,0.85)" }}>
            <RefreshCw size={15} />Otro examen · mismo documento
          </button>
          <button onClick={onUploadDifferentDoc} className="btn-secondary justify-center py-3.5 text-sm">
            <Upload size={15} />Subir documento diferente
          </button>
        </div>
      </div>
    </div>
  );
}
