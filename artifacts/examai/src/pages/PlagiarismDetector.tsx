import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, AlertTriangle, CheckCircle, Info, FileText, Download } from "lucide-react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import LoadingScreen from "@/components/LoadingScreen";
import LocalModelLoader from "@/components/LocalModelLoader";
import { Provider, AppSettings, LocalModel, loadSettings, parseApiKeys } from "@/lib/utils";
import { detectLocalLLM } from "@/lib/localLLM";
import { useModelSync } from "@/hooks/useModelSync";
import { exportPlagiarismToPdf } from "@/lib/plagiarismPdfExport";
import { exportPlagiarismToWord } from "@/lib/plagiarismWordExport";

type Step = "upload" | "config" | "loading" | "result";

interface DetectResult {
  ai_probability: number;
  plagiarism_probability: number;
  originality_score: number;
  perplexity_score: number;
  burstiness_score: number;
  verdict: "PROBABLE_IA" | "PROBABLE_PLAGIO" | "ORIGINAL" | "SOSPECHOSO";
  confidence: "alta" | "media" | "baja";
  ai_indicators: string[];
  plagiarism_indicators: string[];
  style_analysis: {
    sentence_variety: string;
    vocabulary_richness: string;
    coherence: string;
    formality: string;
  };
  summary: string;
  highlighted_segments?: {
    text: string;
    type: "ai" | "plagiarism" | "original";
    probability: number;
    reason?: string;
  }[];
}

export default function PlagiarismDetector() {
  const [, navigate] = useLocation();
  const { mode, setMode, localModel, setLocalModel } = useModelSync();
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  const [localProgress, setLocalProgress] = useState<{
    text: string; pct: number; phase: "init" | "generating" | "error"; error?: string;
  }>({ text: "", pct: 0, phase: "init" });
  const [step, setStep] = useState<Step>("upload");
  const [selectedFiles, setSelectedFiles] = useState<{
    text: string;
    filename: string;
    wordCount: number;
  }[]>([]);
  const [textInput, setTextInput] = useState("");
  const text = selectedFiles.map(f => `--- DOCUMENTO: ${f.filename} ---\n${f.text}`).join("\n\n");
  const filename = selectedFiles.map(f => f.filename).join(", ");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [result, setResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings] = useState<AppSettings>(loadSettings());
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");

  useEffect(() => {
    const checkGpu = async () => {
      try {
        if (typeof navigator !== "undefined" && "gpu" in navigator) {
          const a = await (navigator as any).gpu.requestAdapter();
          setWebGpuAvailable(!!a);
        }
      } catch { setWebGpuAvailable(false); }
    };
    checkGpu();
  }, []);

  const handleFileReady = (t: string, fname: string, wc?: number) => {
    setSelectedFiles((prev) => [...prev, { text: t, filename: fname, wordCount: wc || t.split(/\s+/).filter(Boolean).length }]);
  };

  const handleAnalyze = async () => {
    const finalText = inputMode === "paste" ? textInput : text;
    if (!finalText.trim()) return;
    setError(null);
    setStep("loading");

    if (mode === "local") {
      setLocalProgress({ text: "Preparando motor local...", pct: 0, phase: "init" });
      try {
        const data = await detectLocalLLM(
          localModel,
          finalText,
          (p) => setLocalProgress({
            text: p.text,
            pct: p.progress,
            phase: p.type === "init" ? "init" : "generating",
          })
        );
        setResult(data);
        setStep("result");
      } catch (e: any) {
        setLocalProgress((prev) => ({ ...prev, phase: "error", error: e.message || "Error desconocido" }));
      }
      return;
    }

    const rawKey =
      provider === "gemini" ? settings.geminiKeys :
      provider === "groq" ? settings.groqKeys :
      settings.cohereKeys;
    const keys = parseApiKeys(rawKey);

    if (!keys.length) {
      setError(`No hay llaves API para ${provider}. Configura en Ajustes.`);
      setStep("config");
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiBase}/api/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalText, provider, api_keys: keys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error en detección");
      setResult(data);
      setStep("result");
    } catch (e: any) {
      setError(e.message);
      setStep("config");
    }
  };

  const handleReset = () => {
    setSelectedFiles([]); setTextInput(""); setResult(null); setError(null);
    setStep("upload");
  };

  return (
    <div className="min-h-screen" style={{ background: "#000" }}>
      <Header
        mode={mode}
        onModeToggle={() => setMode(mode === "cloud" ? "local" : "cloud")}
        webGpuAvailable={webGpuAvailable}
        localModel={localModel}
        onLocalModelChange={setLocalModel}
      />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm text-white/40">
          <button onClick={() => navigate("/")} className="hover:text-white/70 transition-colors flex items-center gap-1">
            <ArrowLeft size={14} />
            Dashboard
          </button>
          <ChevronRight size={12} />
          <span className="text-white/70">Detector Antiplagio + IA</span>
        </div>

        {step === "upload" && (
          <div className="animate-fade-in-up space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Detector Antiplagio + IA</h1>
              <p className="text-white/45 text-sm mt-1">
                Detecta contenido generado por IA y posibles plagios con análisis de perplejidad y burstiness.
              </p>
            </div>

            {/* Input Mode Toggle */}
            <div className="flex gap-2 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              {(["file", "paste"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setInputMode(m)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: inputMode === m ? "rgba(10,132,255,0.2)" : "transparent",
                    color: inputMode === m ? "#0A84FF" : "rgba(255,255,255,0.4)",
                    border: inputMode === m ? "1px solid rgba(10,132,255,0.35)" : "1px solid transparent",
                  }}
                >
                  {m === "file" ? "Subir archivo" : "Pegar texto"}
                </button>
              ))}
            </div>

            {inputMode === "file" ? (
              <div className="space-y-4">
                <Dropzone onFileReady={handleFileReady} />

                {selectedFiles.length > 0 && (
                  <div className="space-y-3 animate-fade-in">
                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Documentos Cargados ({selectedFiles.length})</h3>
                    <div className="space-y-2">
                      {selectedFiles.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3.5 rounded-2xl border animate-fade-in"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderColor: "rgba(255,255,255,0.08)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.15)" }}
                            >
                              <span className="text-blue-400 text-xs font-bold">DOC</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white/95 truncate max-w-[200px] sm:max-w-xs">{f.filename}</p>
                              <p className="text-xs text-white/40 mt-0.5">{f.wordCount.toLocaleString()} palabras</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Eliminar archivo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setStep("config")}
                        className="btn-primary"
                      >
                        Continuar a la Configuración
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Pega aquí el texto a analizar..."
                  rows={10}
                  className="input-glass resize-none"
                  style={{ borderRadius: 16 }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">{textInput.split(/\s+/).filter(Boolean).length} palabras</span>
                  <button
                    onClick={() => { if (textInput.trim()) setStep("config"); }}
                    disabled={!textInput.trim()}
                    className="btn-primary"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "config" && (
          <div className="animate-fade-in-up space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white">Selecciona el motor</h1>
              <p className="text-white/45 text-sm mt-1">
                {filename ? `Documento: ${filename}` : "Texto pegado para análisis"}
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl" style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.25)" }}>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="glass rounded-3xl p-6 space-y-4">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Motor de IA</label>
              <div className="grid grid-cols-3 gap-2">
                {(["gemini", "groq", "cohere"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`py-3 rounded-xl text-sm font-semibold capitalize transition-all ${provider === p ? "text-white" : "text-white/40 hover:text-white/70"}`}
                    style={{
                      background: provider === p
                        ? p === "gemini" ? "rgba(66,133,244,0.25)" : p === "groq" ? "rgba(124,77,255,0.25)" : "rgba(255,159,10,0.2)"
                        : "rgba(255,255,255,0.05)",
                      border: `1px solid ${provider === p
                        ? p === "gemini" ? "rgba(66,133,244,0.5)" : p === "groq" ? "rgba(124,77,255,0.5)" : "rgba(255,159,10,0.4)"
                        : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-xs text-white/40 flex items-center gap-2">
                  <Info size={11} className="text-blue-400/60" />
                  El análisis usa temperatura 0.0 para máximo determinismo y precisión científica.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("upload")} className="btn-secondary">
                <ArrowLeft size={14} />
                Volver
              </button>
              <button onClick={handleAnalyze} className="btn-primary flex-1 justify-center">
                Analizar texto
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          mode === "local" ? (
            <LocalModelLoader
              model={localModel}
              progressText={localProgress.text}
              progressPct={localProgress.pct}
              phase={localProgress.phase}
              error={localProgress.error}
              onCancel={() => { setStep("config"); setError(null); }}
            />
          ) : (
            <LoadingScreen mode="detect" />
          )
        )}

        {step === "result" && result && (
          <DetectResultView
            result={result}
            onReset={handleReset}
            provider={provider}
            mode={mode}
            localModel={localModel}
            text={inputMode === "paste" ? textInput : text}
            filename={inputMode === "paste" ? "texto_pegado.txt" : filename}
          />
        )}
      </main>
    </div>
  );
}

function HighlightedTextPreview({ text, segments }: { text: string; segments?: any[] }) {
  if (!segments || segments.length === 0) {
    return <p className="text-sm text-white/70 whitespace-pre-wrap">{text}</p>;
  }

  // Map segments and find their occurrence indexes
  const sortedSegments = [...segments]
    .map(seg => {
      const idx = text.toLowerCase().indexOf(seg.text.toLowerCase());
      return { ...seg, index: idx };
    })
    .filter(seg => seg.index !== -1)
    .sort((a, b) => a.index - b.index);

  if (sortedSegments.length === 0) {
    return <p className="text-sm text-white/70 whitespace-pre-wrap">{text}</p>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedSegments.forEach((seg, i) => {
    // Add plain text before this segment
    if (seg.index > lastIndex) {
      elements.push(
        <span key={`text-${i}`}>
          {text.substring(lastIndex, seg.index)}
        </span>
      );
    }

    const typeColorMap = {
      ai: { bg: "rgba(255,159,10,0.18)", border: "rgba(255,159,10,0.35)", text: "#FF9F0A" },
      plagiarism: { bg: "rgba(255,69,58,0.18)", border: "rgba(255,69,58,0.35)", text: "#FF453A" },
      original: { bg: "rgba(48,209,88,0.18)", border: "rgba(48,209,88,0.35)", text: "#30D158" }
    };
    const c = typeColorMap[seg.type as "ai" | "plagiarism" | "original"] || typeColorMap.original;

    elements.push(
      <span
        key={`seg-${i}`}
        className="px-1 py-0.5 rounded border inline cursor-help transition-all duration-200 hover:brightness-110"
        style={{
          backgroundColor: c.bg,
          borderColor: c.border,
          color: c.text,
        }}
        title={seg.reason || `Probabilidad: ${Math.round((seg.probability || 1) * 100)}%`}
      >
        {text.substring(seg.index, seg.index + seg.text.length)}
      </span>
    );

    lastIndex = seg.index + seg.text.length;
  });

  if (lastIndex < text.length) {
    elements.push(
      <span key="text-end">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return (
    <div
      className="p-4 rounded-2xl border text-sm text-white/75 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {elements}
    </div>
  );
}

function DetectResultView({
  result, onReset, provider, mode, localModel, text, filename
}: {
  result: DetectResult;
  onReset: () => void;
  provider: Provider;
  mode: "cloud" | "local";
  localModel: string;
  text: string;
  filename: string;
}) {
  const [downloading, setDownloading] = useState<"pdf" | "word" | null>(null);
  const verdictConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    PROBABLE_IA: { label: "Probable IA", color: "#FF9F0A", bg: "rgba(255,159,10,0.1)", border: "rgba(255,159,10,0.3)", icon: <AlertTriangle size={18} /> },
    PROBABLE_PLAGIO: { label: "Probable Plagio", color: "#FF453A", bg: "rgba(255,69,58,0.1)", border: "rgba(255,69,58,0.3)", icon: <AlertTriangle size={18} /> },
    ORIGINAL: { label: "Texto Original", color: "#30D158", bg: "rgba(48,209,88,0.1)", border: "rgba(48,209,88,0.3)", icon: <CheckCircle size={18} /> },
    SOSPECHOSO: { label: "Sospechoso", color: "#FF9F0A", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.25)", icon: <AlertTriangle size={18} /> },
  };
  const v = verdictConfig[result.verdict] || verdictConfig["SOSPECHOSO"];

  const getModelLabel = () => {
    if (mode === "local") {
      const labels: Record<string, string> = {
        qwen: "Qwen 1.5B (WASM)",
        phi3: "Phi-3 Mini (WASM)",
        llama3: "Llama 3 8B (WASM)",
      };
      return `motor local ${labels[localModel] || localModel}`;
    } else {
      const labels: Record<string, string> = {
        gemini: "Gemini 1.5 Pro (API Nube)",
        groq: "Llama 3.3 70B (API Nube)",
        cohere: "Command R+ (API Nube)",
      };
      return labels[provider] || `${provider} (API Nube)`;
    }
  };

  const GaugeBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50 font-medium">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );

  const handleDownloadPdf = async () => {
    try {
      setDownloading("pdf");
      const activeProviderName = mode === "local"
        ? (localModel === "qwen" ? "Qwen 1.5B (Local)" : localModel === "phi3" ? "Phi-3 Mini (Local)" : localModel === "llama3" ? "Llama 3 8B (Local)" : localModel)
        : provider;
      await exportPlagiarismToPdf(result, filename, activeProviderName, mode);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadWord = async () => {
    try {
      setDownloading("word");
      const activeProviderName = mode === "local"
        ? (localModel === "qwen" ? "Qwen 1.5B (Local)" : localModel === "phi3" ? "Phi-3 Mini (Local)" : localModel === "llama3" ? "Llama 3 8B (Local)" : localModel)
        : provider;
      await exportPlagiarismToWord(result, filename, activeProviderName, mode);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Verdict Card */}
      <div
        className="glass rounded-3xl p-6"
        style={{ border: `1px solid ${v.border}`, background: v.bg }}
      >
        <div className="flex items-center gap-3 mb-3" style={{ color: v.color }}>
          {v.icon}
          <h2 className="text-xl font-bold">{v.label}</h2>
          <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.25)" }}>
            Confianza: {result.confidence}
          </span>
        </div>
        <p className="text-sm text-white/65 leading-relaxed">
          <strong>{mode === "local" ? "Análisis estilístico offline completado mediante " : "Análisis completado mediante "}{getModelLabel()}</strong>. {result.summary}
        </p>

        {/* Report downloads */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading !== null}
            className="btn-secondary py-2 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} />
            {downloading === "pdf" ? "Exportando..." : "Descargar PDF"}
          </button>
          <button
            onClick={handleDownloadWord}
            disabled={downloading !== null}
            className="btn-secondary py-2 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={13} />
            {downloading === "word" ? "Exportando..." : "Descargar Word"}
          </button>
        </div>
      </div>

      {/* Highlights Preview */}
      <div className="glass rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Texto Analizado y Resaltado</h3>
        <HighlightedTextPreview text={text} segments={result.highlighted_segments} />
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF9F0A" }} />
            <span className="text-white/40">Patrón IA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF453A" }} />
            <span className="text-white/40">Sospecha de Plagio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#30D158" }} />
            <span className="text-white/40">Original</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="glass rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Métricas de análisis</h3>
        <GaugeBar label="Probabilidad de IA" value={result.ai_probability} color="#FF9F0A" />
        <GaugeBar label="Probabilidad de Plagio" value={result.plagiarism_probability} color="#FF453A" />
        <GaugeBar label="Puntuación de Originalidad" value={result.originality_score} color="#30D158" />

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-lg font-bold text-white">{result.perplexity_score?.toFixed(1) ?? "—"}</div>
            <div className="text-xs text-white/40 mt-0.5">Perplejidad</div>
          </div>
          <div className="p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-lg font-bold text-white">{result.burstiness_score?.toFixed(2) ?? "—"}</div>
            <div className="text-xs text-white/40 mt-0.5">Burstiness</div>
          </div>
        </div>
      </div>

      {/* Style Analysis */}
      {result.style_analysis && (
        <div className="glass rounded-3xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Análisis de estilo</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(result.style_analysis).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-xs text-white/45 capitalize">{key.replace("_", " ")}</span>
                <span className="text-xs font-semibold text-white/75 capitalize">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicators */}
      {(result.ai_indicators?.length > 0 || result.plagiarism_indicators?.length > 0) && (
        <div className="glass rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Señales detectadas</h3>
          {result.ai_indicators?.length > 0 && (
            <div>
              <p className="text-xs text-amber-400/80 font-medium mb-2">Indicadores de IA:</p>
              <ul className="space-y-1.5">
                {result.ai_indicators.map((ind, i) => (
                  <li key={i} className="text-xs text-white/55 flex items-start gap-2">
                    <span className="text-amber-400/60 mt-0.5">•</span>
                    {ind}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.plagiarism_indicators?.length > 0 && (
            <div>
              <p className="text-xs text-red-400/80 font-medium mb-2">Indicadores de plagio:</p>
              <ul className="space-y-1.5">
                {result.plagiarism_indicators.map((ind, i) => (
                  <li key={i} className="text-xs text-white/55 flex items-start gap-2">
                    <span className="text-red-400/60 mt-0.5">•</span>
                    {ind}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button onClick={onReset} className="btn-secondary w-full justify-center">
        <ArrowLeft size={14} />
        Analizar otro texto
      </button>
    </div>
  );
}
