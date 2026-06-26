import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, Settings } from "lucide-react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import LoadingScreen from "@/components/LoadingScreen";
import LocalModelLoader from "@/components/LocalModelLoader";
import ExamResult from "@/components/ExamResult";
import {
  ExamQuestion, Provider, Difficulty, AppSettings, LocalModel,
  QuestionType, QUESTION_TYPE_META,
  loadSettings, addHistoryEntry, updateStats,
  parseApiKeys, generateId, getWordCount,
} from "@/lib/utils";
import { useModelSync } from "@/hooks/useModelSync";
import { generateExamLocal } from "@/lib/localLLM";

type Step = "upload" | "config" | "loading" | "result";

export default function ExamGenerator() {
  const [, navigate] = useLocation();
  const { mode, setMode, localModel, setLocalModel } = useModelSync();
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  const [localProgress, setLocalProgress] = useState<{
    text: string; pct: number; phase: "init" | "generating" | "error"; error?: string;
  }>({ text: "", pct: 0, phase: "init" });
  const [step, setStep] = useState<Step>("upload");
  const [resultProvider, setResultProvider] = useState<Provider>("gemini");
  const [selectedFiles, setSelectedFiles] = useState<{
    text: string;
    filename: string;
    wordCount: number;
  }[]>([]);
  const [rotateProviders, setRotateProviders] = useState(false);

  const extractedText = selectedFiles.map(f => `--- DOCUMENTO: ${f.filename} ---\n${f.text}`).join("\n\n");
  const filename = selectedFiles.map(f => f.filename).join(", ");
  const wordCount = selectedFiles.reduce((acc, f) => acc + f.wordCount, 0);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [variationSeed, setVariationSeed] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());

  const [config, setConfig] = useState<{
    provider: Provider; difficulty: Difficulty; questionCount: number; subject: string;
    questionTypes: QuestionType[];
  }>({
    provider: "gemini", difficulty: "media", questionCount: 40, subject: "",
    questionTypes: ["multiple", "truefalse", "complete", "match"],
  });

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

  // Reload settings when navigating here
  useEffect(() => { setSettings(loadSettings()); }, []);

  const handleFileReady = (text: string, fname: string, wc: number) => {
    setSelectedFiles((prev) => [...prev, { text, filename: fname, wordCount: wc }]);
  };

  const getApiKeys = (provider: Provider): string[] => {
    const raw =
      provider === "gemini" ? settings.geminiKeys :
      provider === "groq" ? settings.groqKeys :
      settings.cohereKeys;
    return parseApiKeys(raw);
  };

  const generateExam = async (seed = 0) => {
    setError(null);
    setStep("loading");
    const startTime = Date.now();

    if (mode === "local") {
      setLocalProgress({ text: "Preparando motor local...", pct: 0, phase: "init" });
      try {
        const qs = await generateExamLocal(
          localModel,
          extractedText,
          config.difficulty,
          config.questionCount,
          config.subject,
          config.questionTypes,
          (p) => setLocalProgress({
            text: p.text,
            pct: p.progress,
            phase: p.type === "init" ? "init" : "generating",
          })
        );
        const elapsed = Date.now() - startTime;
        setQuestions(qs);
        setResultProvider(localModel);
        addHistoryEntry({
          id: generateId(),
          filename,
          provider: localModel,
          questionCount: qs.length,
          difficulty: config.difficulty,
          timestamp: Date.now(),
          questions: qs,
          subject: config.subject,
        });
        updateStats(localModel, qs.length, elapsed);
        setStep("result");
      } catch (e: any) {
        setLocalProgress((prev) => ({ ...prev, phase: "error", error: e.message || "Error desconocido" }));
      }
      return;
    }

    const keys = getApiKeys(config.provider);
    if (!keys.length) {
      setError(`No hay llaves API configuradas para ${config.provider}. Ve a Ajustes.`);
      setStep("config");
      return;
    }
    try {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const apiKeysDict = {
        gemini: getApiKeys("gemini"),
        groq: getApiKeys("groq"),
        cohere: getApiKeys("cohere"),
      };
      const res = await fetch(`${apiBase}/api/generate-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          provider: config.provider,
          api_keys: keys,
          difficulty: config.difficulty,
          subject: config.subject,
          question_count: config.questionCount,
          question_types: config.questionTypes,
          variation_seed: seed,
          rotate_providers: rotateProviders && selectedFiles.length > 1,
          api_keys_dict: apiKeysDict,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error generando examen");

      const elapsed = Date.now() - startTime;
      setQuestions(data.questions);
      setResultProvider(config.provider);
      addHistoryEntry({
        id: generateId(),
        filename,
        provider: config.provider,
        questionCount: data.questions.length,
        difficulty: config.difficulty,
        timestamp: Date.now(),
        questions: data.questions,
        subject: config.subject,
      });
      updateStats(config.provider, data.questions.length, elapsed);
      setStep("result");
    } catch (e: any) {
      setError(e.message || "Error desconocido");
      setStep("config");
    }
  };

  const handleRegenerateSameDoc = () => {
    const newSeed = variationSeed + 1;
    setVariationSeed(newSeed);
    generateExam(newSeed);
  };

  const handleUploadDifferent = () => {
    setSelectedFiles([]);
    setQuestions([]);
    setError(null);
    setVariationSeed(0);
    setStep("upload");
  };

  const settingsExist = mode === "local" || getApiKeys(config.provider).length > 0;

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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-white/40">
          <button onClick={() => navigate("/")} className="hover:text-white/70 transition-colors flex items-center gap-1">
            <ArrowLeft size={14} />
            Dashboard
          </button>
          <ChevronRight size={12} />
          <span className="text-white/70">Generador de Exámenes</span>
          {step !== "upload" && (
            <>
              <ChevronRight size={12} />
              <span className="text-white/50 capitalize">{step === "config" ? "Configurar" : step === "loading" ? "Generando" : "Resultado"}</span>
            </>
          )}
        </div>

        {/* Step Indicator */}
        <StepBar current={step} />

        <div className="mt-8">
          {step === "upload" && (
            <div className="animate-fade-in-up space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Sube tus documentos</h1>
                <p className="text-white/45 text-sm mt-1">
                  El texto se extrae localmente y se procesa de forma segura.
                </p>
              </div>
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
          )}

          {step === "config" && (
            <div className="animate-fade-in-up space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Configura el examen</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/45 text-sm">Documento: <strong className="text-white/65">{filename}</strong></span>
                  <span className="text-white/25">·</span>
                  <span className="text-white/40 text-sm">{wordCount.toLocaleString()} palabras</span>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl" style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.25)" }}>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {!settingsExist && (
                <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "rgba(255,159,10,0.08)", border: "1px solid rgba(255,159,10,0.25)" }}>
                  <Settings size={15} className="text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-300/80">
                    Configura tu API key para <strong>{config.provider}</strong> en el botón de ajustes del header.
                  </p>
                </div>
              )}

              {mode === "local" && (
                <div className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "rgba(52,199,89,0.07)", border: "1px solid rgba(52,199,89,0.2)" }}>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">Modo Local activado</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Inferencia en tu dispositivo · No necesita API key · Sin privacidad de datos
                    </p>
                  </div>
                  <div className="text-right">
                    </div>
                </div>
              )}

              <div className="glass rounded-3xl p-6 space-y-5">
                {/* Provider (cloud only) */}
                {mode === "local" ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Motor Local</label>
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.2)" }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(52,199,89,0.15)" }}
                      >
                        <span className="text-emerald-400 text-sm font-bold">
                          {localModel === "qwen" ? "Q" : localModel === "phi3" ? "Φ" : "L"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-300">
                          {localModel === "qwen" ? "Qwen 1.5B" : localModel === "phi3" ? "Phi-3 Mini" : "Llama 3 8B"}
                        </p>
                        <p className="text-xs text-white/35">
                          {localModel === "qwen" ? "Ultra veloz · Ideal móviles" : localModel === "phi3" ? "Balanceado y Lógico" : "Máxima Complejidad"}
                        </p>
                      </div>
                      <p className="text-xs text-white/30 ml-auto">Cambiar desde el header</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Motor de IA</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["gemini", "groq", "cohere"] as Provider[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => setConfig((c) => ({ ...c, provider: p }))}
                            className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${
                              config.provider === p
                                ? "text-white"
                                : "text-white/40 hover:text-white/70"
                            }`}
                            style={{
                              background: config.provider === p
                                ? p === "gemini" ? "rgba(66,133,244,0.25)" : p === "groq" ? "rgba(124,77,255,0.25)" : "rgba(255,159,10,0.2)"
                                : "rgba(255,255,255,0.05)",
                              border: `1px solid ${config.provider === p
                                ? p === "gemini" ? "rgba(66,133,244,0.5)" : p === "groq" ? "rgba(124,77,255,0.5)" : "rgba(255,159,10,0.4)"
                                : "rgba(255,255,255,0.08)"}`,
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200"
                      style={{
                        background: rotateProviders ? "rgba(10,132,255,0.08)" : "rgba(255,255,255,0.02)",
                        borderColor: rotateProviders ? "rgba(10,132,255,0.25)" : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="space-y-0.5 pr-2">
                        <p className="text-sm font-semibold text-white/90">Activar Rotación de Motores API</p>
                        <p className="text-xs text-white/40 leading-tight">Evita límites de tokens alternando proveedores en Round-Robin</p>
                      </div>
                      <button
                        onClick={() => setRotateProviders(!rotateProviders)}
                        className={`w-10 h-6 rounded-full relative transition-colors duration-200 focus:outline-none flex items-center flex-shrink-0 ${
                          rotateProviders ? "bg-blue-500" : "bg-white/20"
                        }`}
                        title="Activar Rotación de Motores API (Evitar límites de tokens)"
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            rotateProviders ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Difficulty */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Dificultad</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["fácil", "media", "difícil"] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setConfig((c) => ({ ...c, difficulty: d }))}
                        className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                          config.difficulty === d ? "text-white" : "text-white/40 hover:text-white/60"
                        }`}
                        style={{
                          background: config.difficulty === d
                            ? d === "fácil" ? "rgba(52,199,89,0.18)" : d === "difícil" ? "rgba(255,69,58,0.18)" : "rgba(255,159,10,0.16)"
                            : "rgba(255,255,255,0.05)",
                          border: `1px solid ${config.difficulty === d
                            ? d === "fácil" ? "rgba(52,199,89,0.4)" : d === "difícil" ? "rgba(255,69,58,0.35)" : "rgba(255,159,10,0.35)"
                            : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Types */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Tipos de pregunta
                    </label>
                    <span className="text-xs text-white/30">
                      {config.questionTypes.length} de 4 seleccionados
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(QUESTION_TYPE_META) as QuestionType[]).map((t) => {
                      const meta = QUESTION_TYPE_META[t];
                      const active = config.questionTypes.includes(t);
                      const isLast = config.questionTypes.length === 1 && active;
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            if (isLast) return;
                            setConfig((c) => ({
                              ...c,
                              questionTypes: active
                                ? c.questionTypes.filter((x) => x !== t)
                                : [...c.questionTypes, t],
                            }));
                          }}
                          className={`flex items-start gap-2.5 p-3 rounded-2xl text-left transition-all ${isLast ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                          style={{
                            background: active
                              ? t === "multiple"  ? "rgba(10,132,255,0.12)"
                              : t === "truefalse" ? "rgba(52,199,89,0.10)"
                              : t === "complete"  ? "rgba(255,159,10,0.10)"
                              :                    "rgba(175,82,222,0.10)"
                              : "rgba(255,255,255,0.03)",
                            border: `1px solid ${active
                              ? t === "multiple"  ? "rgba(10,132,255,0.35)"
                              : t === "truefalse" ? "rgba(52,199,89,0.30)"
                              : t === "complete"  ? "rgba(255,159,10,0.30)"
                              :                    "rgba(175,82,222,0.30)"
                              : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition-all"
                            style={{
                              background: active
                                ? t === "multiple"  ? "#0A84FF"
                                : t === "truefalse" ? "#34C759"
                                : t === "complete"  ? "#FF9F0A"
                                :                    "#BF5AF2"
                                : "transparent",
                              borderColor: active
                                ? t === "multiple"  ? "#0A84FF"
                                : t === "truefalse" ? "#34C759"
                                : t === "complete"  ? "#FF9F0A"
                                :                    "#BF5AF2"
                                : "rgba(255,255,255,0.2)",
                            }}
                          >
                            {active && (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-white/35"}`}>
                              {meta.label}
                            </p>
                            <p className="text-[10px] mt-0.5 leading-tight text-white/25">{meta.sublabel}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Count */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Cantidad de preguntas
                    </label>
                    <span className="text-blue-400 font-bold text-sm">{config.questionCount}</span>
                  </div>
                  <input
                    type="range"
                    min={5} max={40} step={5}
                    value={config.questionCount}
                    onChange={(e) => setConfig((c) => ({ ...c, questionCount: Number(e.target.value) }))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-white/25">
                    <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span><span>35</span><span>40</span>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Área / Materia <span className="normal-case text-white/25">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={config.subject}
                    onChange={(e) => setConfig((c) => ({ ...c, subject: e.target.value }))}
                    placeholder="Ej: Biología, Historia Universal, Cálculo..."
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("upload")} className="btn-secondary">
                  <ArrowLeft size={14} />
                  Volver
                </button>
                <button
                  onClick={() => generateExam(variationSeed)}
                  className="btn-primary flex-1 justify-center"
                >
                  Generar {config.questionCount} preguntas
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
              <LoadingScreen mode="exam" />
            )
          )}

          {step === "result" && (
            <ExamResult
              questions={questions}
              filename={filename}
              provider={resultProvider}
              difficulty={config.difficulty}
              onRegenerateWithSameDoc={handleRegenerateSameDoc}
              onUploadDifferentDoc={handleUploadDifferent}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StepBar({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Documento" },
    { key: "config", label: "Configurar" },
    { key: "loading", label: "Generando" },
    { key: "result", label: "Resultado" },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: i < idx ? "#0A84FF" : i === idx ? "rgba(10,132,255,0.25)" : "rgba(255,255,255,0.06)",
                border: `2px solid ${i <= idx ? "#0A84FF" : "rgba(255,255,255,0.1)"}`,
                color: i < idx ? "white" : i === idx ? "#0A84FF" : "rgba(255,255,255,0.2)",
              }}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${i === idx ? "text-white/70" : "text-white/25"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all"
              style={{ background: i < idx ? "#0A84FF" : "rgba(255,255,255,0.08)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
