import { Cpu, Download, Zap, AlertCircle } from "lucide-react";
import { LocalModel, LOCAL_MODELS } from "@/lib/utils";
import { LOCAL_MODEL_IDS } from "@/lib/localLLM";

interface Props {
  model: LocalModel;
  progressText: string;
  progressPct: number;
  phase: "init" | "generating" | "error";
  error?: string;
  onCancel?: () => void;
}

const MODEL_SIZES: Record<LocalModel, string> = {
  qwen: "~1.1 GB",
  phi3: "~2.2 GB",
  llama3: "~2.0 GB",
};

export default function LocalModelLoader({
  model, progressText, progressPct, phase, error, onCancel,
}: Props) {
  const info = LOCAL_MODELS[model];
  const modelId = LOCAL_MODEL_IDS[model];
  const size = MODEL_SIZES[model];
  const isDownloading = phase === "init" && progressPct < 99;
  const isLoading = phase === "init" && progressPct >= 99;

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,69,58,0.12)", border: "1px solid rgba(255,69,58,0.25)" }}
        >
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-base font-semibold text-white">Error al cargar el modelo</p>
          <p className="text-sm text-white/50">{error}</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="btn-secondary text-sm">
            Volver al modo API
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-7 animate-fade-in">
      {/* Animated icon */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: 90,
            height: 90,
            border: "2px solid rgba(52,199,89,0.3)",
            animation: "pulse-green 2s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 115,
            height: 115,
            border: "1px solid rgba(52,199,89,0.12)",
            animation: "pulse-green 2s ease-in-out infinite 0.6s",
          }}
        />
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(52,199,89,0.1)",
            border: "1px solid rgba(52,199,89,0.3)",
          }}
        >
          {isDownloading ? (
            <Download size={26} className="text-emerald-400" style={{ animation: "bounce-slow 1.4s ease-in-out infinite" }} />
          ) : (
            <Cpu size={26} className="text-emerald-400" />
          )}
        </div>
      </div>

      {/* Model info */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Zap size={12} className="text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Modo Local Activo
          </span>
        </div>
        <p className="text-lg font-bold text-white">{info.label}</p>
        <p className="text-sm text-white/45">{info.sublabel}</p>
      </div>

      {/* Status */}
      <div
        className="w-full max-w-xs rounded-2xl p-4 space-y-3"
        style={{ background: "rgba(52,199,89,0.06)", border: "1px solid rgba(52,199,89,0.15)" }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">
            {isDownloading ? "Descargando modelo..." : isLoading ? "Cargando en VRAM..." : "Generando respuesta..."}
          </span>
          <span className="font-semibold text-emerald-400">{Math.round(progressPct)}%</span>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(2, progressPct)}%`,
              background: "linear-gradient(90deg, #34C759, #30D158)",
            }}
          />
        </div>

        <p
          className="text-xs text-white/35 truncate"
          title={progressText}
        >
          {progressText || "Inicializando..."}
        </p>
      </div>

      {/* Info row */}
      {isDownloading && (
        <div className="flex items-center gap-4 text-xs text-white/30">
          <span>Tamaño: <span className="text-white/50">{size}</span></span>
          <span>·</span>
          <span>Se descarga una vez y queda en caché</span>
        </div>
      )}

      {/* Model ID */}
      <p className="text-xs text-white/20 font-mono">{modelId}</p>

      {onCancel && (
        <button
          onClick={onCancel}
          className="text-xs text-white/30 hover:text-white/60 transition-colors mt-2"
        >
          Cancelar y usar Modo API
        </button>
      )}

      <style>{`
        @keyframes pulse-green {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.06); opacity: 0.6; }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
