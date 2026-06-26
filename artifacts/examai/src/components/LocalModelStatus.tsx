import { useState, useEffect, useCallback } from "react";
import { Cpu, Zap, Trash2, CheckCircle, Circle, RefreshCw } from "lucide-react";
import { LocalModel, LOCAL_MODELS } from "@/lib/utils";
import { localLLM, LocalLLMStatus, MODEL_VRAM_MB } from "@/lib/localLLM";

interface Props {
  webGpuAvailable: boolean;
  localModel: LocalModel;
  onLocalModelChange?: (model: LocalModel) => void;
}

function VramBar({ usedMb, totalMb }: { usedMb: number; totalMb: number }) {
  const pct = Math.min(100, Math.round((usedMb / totalMb) * 100));
  const color = pct > 80 ? "#FF453A" : pct > 55 ? "#FF9F0A" : "#34C759";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "rgba(255,255,255,0.4)" }}>VRAM estimada</span>
        <span style={{ color }} className="font-semibold tabular-nums">
          {(usedMb / 1024).toFixed(1)} GB&nbsp;/&nbsp;{(totalMb / 1024).toFixed(1)} GB
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
    </div>
  );
}

const ASSUMED_TOTAL_VRAM_MB = 8192;

export default function LocalModelStatus({ webGpuAvailable, localModel, onLocalModelChange }: Props) {
  const [status, setStatus] = useState<LocalLLMStatus>(localLLM.getStatus());
  const [releasing, setReleasing] = useState(false);

  const refresh = useCallback(() => setStatus(localLLM.getStatus()), []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  const handleRelease = async () => {
    setReleasing(true);
    await new Promise((r) => setTimeout(r, 300));
    localLLM.unload();
    refresh();
    setReleasing(false);
  };

  const loaded = status.loadedModel;
  const modelInfo = loaded ? LOCAL_MODELS[loaded] : null;

  return (
    <div
      className="rounded-3xl p-5 space-y-4"
      style={{
        background: loaded
          ? "rgba(52,199,89,0.05)"
          : "rgba(255,255,255,0.03)",
        border: loaded
          ? "1px solid rgba(52,199,89,0.18)"
          : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: loaded ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.05)",
              border: loaded ? "1px solid rgba(52,199,89,0.25)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Cpu size={15} className={loaded ? "text-emerald-400" : "text-white/30"} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Motor Local</p>
            <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>
              {webGpuAvailable ? "WebGPU disponible" : "WebGPU no disponible"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/08"
            title="Actualizar estado"
          >
            <RefreshCw size={12} className="text-white/30" />
          </button>
          {loaded && (
            <button
              onClick={handleRelease}
              disabled={releasing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: releasing ? "rgba(255,69,58,0.05)" : "rgba(255,69,58,0.10)",
                border: "1px solid rgba(255,69,58,0.25)",
                color: "#FF6961",
                opacity: releasing ? 0.6 : 1,
              }}
            >
              <Trash2 size={11} />
              {releasing ? "Liberando..." : "Liberar memoria"}
            </button>
          )}
        </div>
      </div>

      {/* Model list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(Object.keys(LOCAL_MODELS) as LocalModel[]).map((key) => {
          const info = LOCAL_MODELS[key];
          const isLoaded = loaded === key;
          const isCurrent = localModel === key;
          const vramGb = (MODEL_VRAM_MB[key] / 1024).toFixed(1);

          return (
            <button
              key={key}
              onClick={() => onLocalModelChange?.(key)}
              className="rounded-2xl p-3 flex items-start gap-2.5 transition-all text-left w-full"
              style={{
                background: isLoaded
                  ? "rgba(52,199,89,0.08)"
                  : isCurrent
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.02)",
                border: isLoaded
                  ? "1px solid rgba(52,199,89,0.28)"
                  : isCurrent
                  ? "1px solid rgba(255,255,255,0.12)"
                  : "1px solid rgba(255,255,255,0.05)",
                cursor: onLocalModelChange ? "pointer" : "default",
              }}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isLoaded ? (
                  <CheckCircle size={14} className="text-emerald-400" />
                ) : (
                  <Circle size={14} className="text-white/15" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-semibold leading-tight truncate"
                  style={{ color: isLoaded ? "#34C759" : "rgba(255,255,255,0.65)" }}
                >
                  {info.label}
                  {isCurrent && !isLoaded && (
                    <span className="ml-1.5 text-[10px] font-normal text-white/30">(seleccionado)</span>
                  )}
                </p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {info.sublabel}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      background: isLoaded ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.04)",
                      color: isLoaded ? "#34C759" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {vramGb} GB
                  </span>
                  {isLoaded && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(52,199,89,0.15)", color: "#34C759" }}
                    >
                      EN MEMORIA
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* VRAM bar — only if something is loaded */}
      {loaded && (
        <VramBar usedMb={status.estimatedVramMb} totalMb={ASSUMED_TOTAL_VRAM_MB} />
      )}

      {/* JS Heap + WebGPU info row */}
      <div className="flex items-center gap-4 flex-wrap">
        {status.jsHeapMb !== null && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#0A84FF" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Heap JS: <span className="text-white/55 font-medium">{status.jsHeapMb} MB</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: webGpuAvailable ? "#34C759" : "#FF453A" }}
          />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            WebGPU:{" "}
            <span
              className="font-medium"
              style={{ color: webGpuAvailable ? "#34C759" : "#FF6961" }}
            >
              {webGpuAvailable ? "Activo" : "No disponible"}
            </span>
          </span>
        </div>
        {!loaded && (
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-white/20" />
            <span className="text-xs text-white/25">
              Ningún modelo en memoria · Se carga al generar
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
