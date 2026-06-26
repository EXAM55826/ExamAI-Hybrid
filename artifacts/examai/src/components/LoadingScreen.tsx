import { useEffect, useState } from "react";

const EXAM_MESSAGES = [
  "Leyendo documento...",
  "Analizando contenido académico...",
  "Generando preguntas con IA...",
  "Estructurando el examen...",
  "Aplicando control de calidad...",
  "Verificando rigor académico...",
  "Finalizando preguntas...",
];

const DETECT_MESSAGES = [
  "Analizando patrones de escritura...",
  "Midiendo métricas de perplejidad...",
  "Calculando burstiness del texto...",
  "Comparando estilos lingüísticos...",
  "Procesando con IA...",
  "Generando reporte final...",
];

interface Props {
  mode?: "exam" | "detect";
  progress?: number;
}

export default function LoadingScreen({ mode = "exam", progress }: Props) {
  const messages = mode === "exam" ? EXAM_MESSAGES : DETECT_MESSAGES;
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    setMsgIdx(0);
    const id = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % messages.length);
    }, 2800);
    return () => clearInterval(id);
  }, [mode]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-8 animate-fade-in">
      {/* Animated Logo Rings */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full opacity-20"
          style={{
            width: 100, height: 100,
            border: "2px solid #0A84FF",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full opacity-10"
          style={{
            width: 130, height: 130,
            border: "1px solid #7B61FF",
            animation: "pulse 2s ease-in-out infinite 0.5s",
          }}
        />
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(10,132,255,0.2), rgba(123,97,255,0.2))",
            border: "1px solid rgba(10,132,255,0.3)",
          }}
        >
          <div className="loading-spinner" />
        </div>
      </div>

      {/* Message */}
      <div className="text-center space-y-2">
        <p
          key={msgIdx}
          className="text-base font-medium text-white/80 animate-fade-in"
          style={{ minHeight: 28 }}
        >
          {messages[msgIdx]}
        </p>
        {progress !== undefined && (
          <p className="text-xs text-white/40">{Math.round(progress)}% completado</p>
        )}
      </div>

      {/* Progress Bar */}
      {progress !== undefined ? (
        <div className="progress-bar w-48">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <div className="progress-bar w-48">
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #0A84FF, #7B61FF, #0A84FF)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s linear infinite",
              width: "60%",
            }}
          />
        </div>
      )}

      <p className="text-xs text-white/25 max-w-xs text-center">
        {mode === "exam"
          ? "Las preguntas se generan en lotes para evitar interrupciones"
          : "Análisis determinístico en proceso"}
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.08); opacity: 0.35; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
