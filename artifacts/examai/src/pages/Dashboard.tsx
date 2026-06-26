import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Shield, ArrowRight, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import StatsPanel from "@/components/StatsPanel";
import ExamHistory from "@/components/ExamHistory";
import LocalModelStatus from "@/components/LocalModelStatus";
import { LocalModel } from "@/lib/utils";

import { useModelSync } from "@/hooks/useModelSync";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { mode, setMode, localModel, setLocalModel } = useModelSync();
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    const checkGpu = async () => {
      try {
        if (typeof navigator !== "undefined" && "gpu" in navigator) {
          const adapter = await (navigator as any).gpu.requestAdapter();
          setWebGpuAvailable(!!adapter);
        }
      } catch {
        setWebGpuAvailable(false);
      }
    };
    checkGpu();
    // refresh history when coming back
    setHistoryKey((k) => k + 1);
  }, []);

  const handleModeToggle = () => {
    if (!webGpuAvailable && mode === "cloud") return;
    setMode(mode === "cloud" ? "local" : "cloud");
  };

  return (
    <div className="min-h-screen" style={{ background: "#000" }}>
      <Header
        mode={mode}
        onModeToggle={handleModeToggle}
        webGpuAvailable={webGpuAvailable}
        localModel={localModel}
        onLocalModelChange={setLocalModel}
      />

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(10,132,255,0.12)", color: "#0A84FF", border: "1px solid rgba(10,132,255,0.2)" }}
            >
              <Sparkles size={10} className="inline mr-1" />
              Powered by Gemini · Groq · Cohere
            </span>
            {mode === "local" && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full badge-local">
                Modo Local Activo
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            ExamAI <span style={{ color: "#0A84FF" }}>Híbrido</span>
          </h1>
          <p className="text-white/40 text-base mt-2 max-w-xl">
            Generador académico de exámenes y detector de plagio + IA con tecnología de vanguardia.
          </p>
        </div>

        {/* Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <ActionCard
            icon={<BookOpen size={22} className="text-blue-400" />}
            iconBg="rgba(10,132,255,0.12)"
            iconBorder="rgba(10,132,255,0.2)"
            title="Generador de Exámenes"
            description="Sube un documento y genera hasta 40 preguntas de opción múltiple con rigor académico y clave de respuestas."
            tags={["PDF", "DOCX", "PPTX", "TXT"]}
            tagClass="text-blue-400/70"
            cta="Generar examen"
            ctaColor="#0A84FF"
            onClick={() => navigate("/exam")}
          />
          <ActionCard
            icon={<Shield size={22} className="text-purple-400" />}
            iconBg="rgba(123,97,255,0.12)"
            iconBorder="rgba(123,97,255,0.2)"
            title="Detector Antiplagio + IA"
            description="Analiza textos para detectar contenido generado por IA y posibles plagios con métricas de perplejidad y burstiness."
            tags={["Perplejidad", "Burstiness", "Originalidad"]}
            tagClass="text-purple-400/70"
            cta="Analizar texto"
            ctaColor="#7B61FF"
            onClick={() => navigate("/detect")}
          />
        </div>

        {/* WebGPU Banner */}
        {!webGpuAvailable && (
          <div className="webgpu-banner animate-fade-in-up flex items-start gap-3" style={{ animationDelay: "120ms" }}>
            <span className="text-lg">⚡</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">Modo Local no disponible</p>
              <p className="text-xs text-white/45 mt-0.5">
                Tu dispositivo no soporta WebGPU. El Modo API (Nube) está listo para usar con tus llaves configuradas.
              </p>
            </div>
          </div>
        )}

        {/* Local Model Status */}
        <section className="animate-fade-in-up" style={{ animationDelay: "140ms" }}>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Motor local
          </h2>
          <LocalModelStatus webGpuAvailable={webGpuAvailable} localModel={localModel} onLocalModelChange={setLocalModel} />
        </section>

        {/* Stats Panel */}
        <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Estadísticas de uso
          </h2>
          <StatsPanel />
        </section>

        {/* History */}
        <section className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Historial de exámenes
          </h2>
          <ExamHistory refreshKey={historyKey} />
        </section>
      </main>
    </div>
  );
}

function ActionCard({
  icon, iconBg, iconBorder, title, description, tags, tagClass, cta, ctaColor, onClick,
}: {
  icon: React.ReactNode; iconBg: string; iconBorder: string;
  title: string; description: string; tags: string[]; tagClass: string;
  cta: string; ctaColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass glass-hover rounded-3xl p-6 text-left w-full group"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
      >
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/45 leading-relaxed mb-4">{description}</p>
      <div className="flex items-center gap-1.5 flex-wrap mb-5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs ${tagClass} font-medium px-2 py-0.5 rounded-lg`}
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div
        className="flex items-center gap-2 text-sm font-semibold transition-all group-hover:gap-3"
        style={{ color: ctaColor }}
      >
        {cta}
        <ArrowRight size={15} />
      </div>
    </button>
  );
}
