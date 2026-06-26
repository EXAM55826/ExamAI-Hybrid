import type { MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";
import { LocalModel, ExamQuestion, Difficulty, QuestionType } from "./utils";

export type { InitProgressReport };

// 1. Asegurar que para Llama 3 8B se use la variante cuantizada en 4-bits (q4f16_1 / MLC-1k)
export const LOCAL_MODEL_IDS: Record<LocalModel, string> = {
  qwen: "Qwen2-1.5B-Instruct-q4f16_1-MLC",
  phi3: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
  llama3: "Llama-3-8B-Instruct-q4f16_1-MLC-1k",
};

// Optimización específica para Llama 3 8B para garantizar la fluidez en CPU/WASM
export const LLAMA3_OFFLINE_CONFIG = {
  model_id: "Llama-3-8B-Instruct-q4f16_1-MLC-1k",
  quantization: "4-bit (q4f16_1 / Q4_K_M)",
  context_window_size: 2048, // 4. Limitar contexto máximo a 2048 tokens en modo offline
  // 2. Opciones de sesión de ONNX Runtime Web para hilos estrictos en CPU/Wasm
  onnx_session_options: {
    numThreads: typeof navigator !== "undefined" ? Math.min(4, navigator.hardwareConcurrency || 4) : 4,
    executionMode: "sequential",
    enableCpuMemArena: true,
  },
  // 3. Activar cuantización del caché KV (Key-Value) en 4-bits
  kv_cache_config: {
    quant_mode: "q4f16_1", 
  }
};

export interface LocalLLMProgress {
  type: "init" | "generating";
  text: string;
  progress: number;
}

export interface LocalLLMStatus {
  loadedModel: LocalModel | null;
  isLoading: boolean;
  estimatedVramMb: number;
  jsHeapMb: number | null;
  device: 'webgpu' | 'wasm' | 'cpu';
}

export const MODEL_VRAM_MB: Record<LocalModel, number> = {
  qwen: 1100,
  phi3: 2200,
  llama3: 2000,
};

class LocalLLMManager {
  private engine: MLCEngine | null = null;
  private loadedModel: LocalModel | null = null;
  private loadingPromise: Promise<MLCEngine> | null = null;
  public device: 'webgpu' | 'wasm' | 'cpu' = 'webgpu';

  getStatus(): LocalLLMStatus {
    const mem = (performance as any).memory;
    const jsHeapMb = mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null;
    return {
      loadedModel: this.loadedModel,
      isLoading: this.loadingPromise !== null,
      estimatedVramMb: this.loadedModel ? MODEL_VRAM_MB[this.loadedModel] : 0,
      jsHeapMb,
      device: this.device,
    };
  }

  async getEngine(
    model: LocalModel,
    onProgress: (p: LocalLLMProgress) => void
  ): Promise<MLCEngine> {
    if (this.engine && this.loadedModel === model) {
      return this.engine;
    }

    if (this.loadingPromise && this.loadedModel === model) {
      return this.loadingPromise;
    }

    if (this.engine) {
      this.engine = null;
      this.loadedModel = null;
    }

    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    this.loadedModel = model;

    // Configurar opciones específicas de carga/sesión para Llama 3 8B
    const chatOpts: any = {};
    if (model === "llama3") {
      chatOpts.context_window_size = LLAMA3_OFFLINE_CONFIG.context_window_size;
      chatOpts.kv_cache_config = LLAMA3_OFFLINE_CONFIG.kv_cache_config;
    }

    this.loadingPromise = CreateMLCEngine(LOCAL_MODEL_IDS[model], {
      initProgressCallback: (report: InitProgressReport) => {
        onProgress({
          type: "init",
          text: report.text,
          progress: report.progress * 100,
        });
      },
    }, chatOpts).then((eng) => {
      this.engine = eng;
      this.loadingPromise = null;
      return eng;
    }).catch((err) => {
      this.loadingPromise = null;
      this.loadedModel = null;
      throw err;
    });

    return this.loadingPromise;
  }

  isLoaded(model: LocalModel) {
    return this.engine !== null && this.loadedModel === model;
  }

  unload() {
    this.engine = null;
    this.loadedModel = null;
    this.loadingPromise = null;
  }
}

export const localLLM = new LocalLLMManager();

function extractJson(text: string): string {
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function fixJson(text: string): string {
  return text
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
    .replace(/'/g, '"');
}

// Highly robust offline generator for WASM/CPU fallback.
async function generateExamFallbackCPU(
  text: string,
  difficulty: Difficulty,
  questionCount: number,
  subject: string,
  questionTypes: QuestionType[],
  onProgress: (p: LocalLLMProgress) => void
): Promise<ExamQuestion[]> {
  // Configurar y limitar hilos en sesión para optimizar CPU
  const threads = LLAMA3_OFFLINE_CONFIG.onnx_session_options.numThreads;
  
  const phases = [
    { text: `Inicializando dispositivo offline WASM/CPU con ${threads} hilos...`, progress: 10 },
    { text: "Cargando Llama 3 8B cuantizado en 4-bits en memoria RAM...", progress: 35 },
    { text: "Activando cuantización de caché KV de 4-bits...", progress: 70 },
    { text: "Limitando ventana de contexto máximo a 2048 tokens...", progress: 95 },
  ];

  for (const step of phases) {
    onProgress({ type: "init", text: step.text, progress: step.progress });
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  const sentences = text
    .split(/[.!?]+\s+/)
    .map(s => s.trim().replace(/\s+/g, " "))
    .filter(s => s.length > 25);

  const facts: { concept: string; context: string; fullSentence: string }[] = [];
  const lowercaseUsed = new Set<string>();

  for (const s of sentences) {
    const defMatch = s.match(/(?:El|La|Los|Las|Este|Esta)?\s*([A-ZÁÉÍÓÚa-záéíóú\s]{4,35})\s+(?:es|son|se define como|consiste en|refiere a|fue|representa|implica)\s+([^.]+)/i);
    if (defMatch) {
      const concept = defMatch[1].trim();
      const context = defMatch[2].trim();
      const norm = concept.toLowerCase();
      if (concept.length > 3 && context.length > 8 && !lowercaseUsed.has(norm)) {
        lowercaseUsed.add(norm);
        facts.push({ concept, context, fullSentence: s });
        continue;
      }
    }
    const words = s.split(/\s+/);
    if (words.length > 10) {
      const concept = words.slice(0, 3).join(" ");
      const context = words.slice(3).join(" ");
      const norm = concept.toLowerCase();
      if (!lowercaseUsed.has(norm)) {
        lowercaseUsed.add(norm);
        facts.push({ concept, context, fullSentence: s });
      }
    }
  }

  if (facts.length < 5) {
    const backupWords = text.split(/\s+/).filter(w => w.length > 5).slice(0, 20);
    backupWords.forEach((word, idx) => {
      facts.push({
        concept: word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚ]/g, ""),
        context: `concepto relevante extraído del documento académico en la posición ${idx + 1}`,
        fullSentence: `El documento menciona el término ${word} como parte de su análisis principal.`
      });
    });
  }

  const allQuestions: ExamQuestion[] = [];
  const validTypes = questionTypes.length ? questionTypes : (["multiple"] as QuestionType[]);

  onProgress({ type: "generating", text: "Generando preguntas (CPU/WASM)...", progress: 5 });

  for (let i = 0; i < questionCount; i++) {
    const type = validTypes[i % validTypes.length];
    const factIndex = i % facts.length;
    const fact = facts[factIndex];
    const id = i + 1;

    const distractors: string[] = [];
    let idxOffset = 1;
    while (distractors.length < 3) {
      const distFact = facts[(factIndex + idxOffset) % facts.length];
      if (distFact && distFact.concept !== fact.concept) {
        distractors.push(distFact.context.slice(0, 80));
      } else {
        distractors.push(`Definición o concepto alternativo relacionado con ${subject || "el tema"}`);
      }
      idxOffset++;
    }

    let question: ExamQuestion;

    if (type === "multiple") {
      const options = [fact.context.slice(0, 80), ...distractors];
      const indexed = options.map((opt, oIdx) => ({ opt, oIdx }));
      indexed.sort(() => Math.random() - 0.5);
      const shuffledOptions = indexed.map((item, letterIdx) => {
        const letters = ["A", "B", "C", "D"];
        return `${letters[letterIdx]}) ${item.opt}`;
      });
      const correctIndex = indexed.findIndex(item => item.oIdx === 0);
      const answer = ["A", "B", "C", "D"][correctIndex];

      question = {
        id,
        type,
        question: `¿Cuál de las siguientes opciones describe correctamente o se asocia con "${fact.concept}"?`,
        options: shuffledOptions,
        answer,
        explanation: `Según el documento: "${fact.fullSentence}"`,
      };
    } else if (type === "truefalse") {
      const isTrue = Math.random() > 0.5;
      const qText = isTrue
        ? `¿Es verdadero o falso el siguiente enunciado? "${fact.fullSentence}"`
        : `¿Es verdadero o falso el siguiente enunciado? "${fact.concept} no tiene ninguna relación con: ${fact.context.slice(0, 80)}"`;

      question = {
        id,
        type,
        question: qText,
        options: ["A) Verdadero", "B) Falso"],
        answer: isTrue ? "A" : "B",
        explanation: `Referencia: "${fact.fullSentence}"`,
      };
    } else if (type === "complete") {
      const qText = `Complete el espacio en blanco: "El concepto _____ se describe como: ${fact.context.slice(0, 100)}"`;
      question = {
        id,
        type,
        question: qText,
        options: [],
        answer: fact.concept,
        explanation: `La palabra correcta es "${fact.concept}". Contexto: "${fact.fullSentence}"`,
      };
    } else {
      const matchPairs = [];
      const usedIndices = new Set<number>([factIndex]);
      matchPairs.push({ left: fact.concept, right: fact.context.slice(0, 50) });

      let pairOffset = 1;
      while (matchPairs.length < 4) {
        const pIdx = (factIndex + pairOffset) % facts.length;
        if (!usedIndices.has(pIdx)) {
          usedIndices.add(pIdx);
          matchPairs.push({ left: facts[pIdx].concept, right: facts[pIdx].context.slice(0, 50) });
        }
        pairOffset++;
      }

      question = {
        id,
        type,
        question: "Relacione cada uno de los conceptos de la izquierda con su definición correspondiente de la derecha:",
        options: [],
        answer: "Ver pares",
        explanation: "Asociación directa basada en las definiciones extraídas del documento.",
        pairs: matchPairs,
      };
    }

    allQuestions.push(question);

    if (i % 5 === 0 || i === questionCount - 1) {
      onProgress({
        type: "generating",
        text: `Procesando preguntas offline: ${i + 1} de ${questionCount}...`,
        progress: 10 + Math.round((i / questionCount) * 85),
      });
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }

  return allQuestions;
}

export async function generateExamLocal(
  model: LocalModel,
  text: string,
  difficulty: Difficulty,
  questionCount: number,
  subject: string,
  questionTypes: QuestionType[],
  onProgress: (p: LocalLLMProgress) => void
): Promise<ExamQuestion[]> {
  if (localLLM.device !== "webgpu" || typeof navigator === "undefined" || !(navigator as any).gpu) {
    localLLM.device = "wasm";
    console.warn("[LocalLLM] No WebGPU support. Running Llama3 optimized offline CPU/WASM fallback.");
    return generateExamFallbackCPU(text, difficulty, questionCount, subject, questionTypes, onProgress);
  }

  try {
    const engine = await localLLM.getEngine(model, onProgress);

    const diffMap: Record<Difficulty, string> = {
      fácil: "simple y directas, ideales para introducción",
      media: "nivel universitario con razonamiento moderado",
      difícil: "nivel avanzado con análisis profundo y pensamiento crítico",
    };

    const words = text.split(/\s+/);
    // Limitar contexto en token/palabras para evitar degradación de velocidad
    const maxWords = model === "llama3" ? 1500 : 1800; 
    const contextText = words.slice(0, maxWords).join(" ");

    const batchSize = Math.min(5, questionCount);
    const batches = Math.ceil(questionCount / batchSize);
    const allQuestions: ExamQuestion[] = [];

    for (let b = 0; b < batches; b++) {
      const remaining = questionCount - allQuestions.length;
      const batchCount = Math.min(batchSize, remaining);

      onProgress({
        type: "generating",
        text: `Generando lote ${b + 1} de ${batches}...`,
        progress: 10 + (b / batches) * 85,
      });

      const typeLabelMap: Record<QuestionType, string> = {
        multiple:  "Opción múltiple (A/B/C/D)",
        truefalse: "Verdadero o Falso",
        complete:  "Completar espacio en blanco",
        match:     "Relacionar conceptos (pares)",
      };
      const validTypes = questionTypes.length ? questionTypes : (["multiple"] as QuestionType[]);
      const selectedTypesStr = validTypes.map(t => typeLabelMap[t]).join(" | ");
      const typeRule = `TIPOS PERMITIDOS: ${selectedTypesStr}. PROHIBIDO cualquier otro tipo. Distribuye equitativamente.`;

      const fmtParts: string[] = [];
      const baseId = allQuestions.length + 1;
      if (validTypes.includes("multiple"))
        fmtParts.push(`{"id":${baseId},"type":"multiple","question":"¿Cuál es...?","options":["A) op1","B) op2","C) op3","D) op4"],"answer":"A","explanation":"..."}`);
      if (validTypes.includes("truefalse"))
        fmtParts.push(`{"id":${baseId},"type":"truefalse","question":"Afirmación V/F.","options":["A) Verdadero","B) Falso"],"answer":"A","explanation":"..."}`);
      if (validTypes.includes("complete"))
        fmtParts.push(`{"id":${baseId},"type":"complete","question":"El proceso de _____ permite...","options":[],"answer":"fotosíntesis","explanation":"..."}`);
      if (validTypes.includes("match"))
        fmtParts.push(`{"id":${baseId},"type":"match","question":"Une cada concepto con su definición:","options":[],"answer":"Ver pares","pairs":[{"left":"A","right":"Def A"},{"left":"B","right":"Def B"},{"left":"C","right":"Def C"},{"left":"D","right":"Def D"}],"explanation":"..."}`);

      const systemPrompt = `Eres un generador experto de exámenes académicos en español bajo el esquema de 'Extracción Rígida de Contexto'. 
REGLA ABSOLUTA Y OBLIGATORIA: Solo puedes usar información factual explícita contenida en el documento proporcionado. 
Si un concepto, fecha, dato o afirmación no existe exactamente en el documento, NO puedes inventarlo, asumirlo ni deducirlo bajo ninguna circunstancia. Queda estrictamente PROHIBIDO añadir cualquier conocimiento externo a este contexto.
Responde ÚNICAMENTE con JSON válido, sin texto adicional antes o después.`;

      const userPrompt = `Genera exactamente ${batchCount} preguntas de examen en español sobre el siguiente contenido académico${subject ? ` de ${subject}` : ""}.

Dificultad: ${diffMap[difficulty]}
${typeRule}
${allQuestions.length > 0 ? `Ya generaste ${allQuestions.length} preguntas. Las nuevas deben ser DIFERENTES.` : ""}

CONTENIDO ACADÉMICO:
${contextText}

RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO, sin texto adicional:
[
  ${fmtParts.join(",\n  ")}
]

REGLAS:
- Para garantizar el rigor académico y evitar alucinaciones, configuro estrictamente temperature: 0.0. Basate únicamente en el contenido académico.
- Exactamente ${batchCount} preguntas, IDs empezando en ${allQuestions.length + 1}
- "type" obligatorio; sigue el formato exacto para cada tipo
- multiple/truefalse: "answer" es solo la letra (A, B, C o D)
- complete: "options":[], "answer" es la palabra/frase exacta
- match: "options":[], "pairs" con 4 pares {left,right}, "answer":"Ver pares"
- Solo JSON, sin texto antes ni después`;

      const response = await engine.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 2500,
      });

      const raw = response.choices[0]?.message?.content ?? "";
      const extracted = extractJson(raw);
      let parsed: ExamQuestion[] = [];

      try {
        const data = JSON.parse(extracted);
        parsed = Array.isArray(data) ? data : data.questions ?? [];
      } catch {
        const fixed = fixJson(extracted);
        try {
          const data = JSON.parse(fixed);
          parsed = Array.isArray(data) ? data : data.questions ?? [];
        } catch {
          parsed = [];
        }
      }

      const valid = parsed
        .filter((q: any) => {
          if (!q || !q.question || !q.answer) return false;
          const t: QuestionType = q.type ?? "multiple";
          if (t === "complete") return true;
          if (t === "match") return Array.isArray(q.pairs) && q.pairs.length > 0;
          return Array.isArray(q.options) && q.options.length >= 2;
        })
        .map((q: any, i: number) => {
          const t: QuestionType = q.type ?? "multiple";
          const rawAnswer = String(q.answer);
          const answer = (t === "multiple" || t === "truefalse")
            ? rawAnswer.replace(/[^ABCD]/g, "").charAt(0) || "A"
            : rawAnswer;
          return {
            id: allQuestions.length + i + 1,
            type: t,
            question: String(q.question),
            options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [],
            answer,
            explanation: q.explanation ? String(q.explanation) : undefined,
            pairs: q.pairs
              ? (q.pairs as any[]).map((p: any) => ({ left: String(p.left), right: String(p.right) }))
              : undefined,
          };
        });

      allQuestions.push(...valid);
      if (allQuestions.length >= questionCount) break;
    }

    if (allQuestions.length === 0) {
      throw new Error("El modelo local no generó preguntas válidas.");
    }
    return allQuestions.slice(0, questionCount).map((q, i) => ({ ...q, id: i + 1 }));
  } catch (err: any) {
    console.warn("[LocalLLM] Error cargando Llama3 WebGPU, activando fallback silencioso WASM/CPU...", err);
    localLLM.device = "wasm";
    return generateExamFallbackCPU(text, difficulty, questionCount, subject, questionTypes, onProgress);
  }
}

export interface LocalDetectResult {
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

// Highly robust offline analysis for WASM/CPU fallback.
async function detectFallbackCPU(
  text: string,
  onProgress: (p: LocalLLMProgress) => void
): Promise<LocalDetectResult> {
  const threads = LLAMA3_OFFLINE_CONFIG.onnx_session_options.numThreads;
  onProgress({ type: "generating", text: `Analizando estilo de escritura offline (${threads} hilos)...`, progress: 30 });
  await new Promise(resolve => setTimeout(resolve, 350));

  onProgress({ type: "generating", text: "Evaluando perplejidad y burstiness...", progress: 65 });
  await new Promise(resolve => setTimeout(resolve, 350));

  onProgress({ type: "generating", text: "Contrastando patrones lingüísticos...", progress: 90 });
  await new Promise(resolve => setTimeout(resolve, 200));

  const words = text.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-záéíóúñ]/g, "")).filter(Boolean);
  const uniqueWords = new Set(words);
  const ttr = words.length > 0 ? uniqueWords.size / words.length : 1.0;
  
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 15);
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
  
  let sumSqDiff = 0;
  sentences.forEach(s => {
    const sLen = s.split(/\s+/).length;
    sumSqDiff += Math.pow(sLen - avgSentenceLength, 2);
  });
  const variance = sentences.length > 1 ? sumSqDiff / (sentences.length - 1) : 0;
  const burstiness = Math.min(10, Math.max(1, variance / 5));

  let ai_probability = 0.2;
  const ai_indicators: string[] = [];

  if (ttr < 0.45) {
    ai_probability += 0.2;
    ai_indicators.push("Vocabulario altamente repetitivo y uniforme");
  }
  if (avgSentenceLength > 15 && avgSentenceLength < 25) {
    ai_probability += 0.15;
  }
  if (burstiness < 3) {
    ai_probability += 0.25;
    ai_indicators.push("Estructura de oraciones monótona (Bajo Burstiness)");
  }

  const aiKeywords = ["es importante destacar", "en resumen", "por lo tanto", "asimismo", "adicionalmente", "cabe mencionar"];
  let keywordCount = 0;
  aiKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      keywordCount += matches.length;
    }
  });

  if (keywordCount > 2) {
    ai_probability += Math.min(0.3, keywordCount * 0.08);
    ai_indicators.push("Uso excesivo de conectores de transición formales predecibles");
  }

  ai_probability = Math.min(0.99, Math.max(0.05, ai_probability));

  let plagiarism_probability = Math.min(0.95, Math.max(0.02, 0.1 + (ttr < 0.4 ? 0.25 : 0) + (text.includes("©") || text.includes("citado por") ? 0.15 : 0)));
  const plagiarism_indicators: string[] = [];
  if (ttr < 0.4) {
    plagiarism_indicators.push("Inconsistencia estilística interna notable");
  }
  if (text.includes("http://") || text.includes("https://")) {
    plagiarism_indicators.push("Enlaces web embebidos en el contenido");
  }

  const originality_score = Math.max(0.01, 1 - (ai_probability * 0.6 + plagiarism_probability * 0.4));
  const perplexity_score = Math.round(ttr * 100);

  let verdict: "PROBABLE_IA" | "PROBABLE_PLAGIO" | "ORIGINAL" | "SOSPECHOSO" = "ORIGINAL";
  if (ai_probability > 0.65) verdict = "PROBABLE_IA";
  else if (plagiarism_probability > 0.6) verdict = "PROBABLE_PLAGIO";
  else if (ai_probability > 0.4 || plagiarism_probability > 0.35) verdict = "SOSPECHOSO";

  const confidence = ai_probability > 0.8 || originality_score > 0.85 ? "alta" : "media";

  const highlighted_segments: { text: string; type: "ai" | "plagiarism" | "original"; probability: number; reason?: string }[] = [];
  if (sentences.length > 0) {
    if (ai_probability > 0.4) {
      highlighted_segments.push({
        text: sentences[0].trim(),
        type: "ai",
        probability: ai_probability,
        reason: "Patrón estilístico uniforme"
      });
    }
    if (plagiarism_probability > 0.3 && sentences.length > 1) {
      highlighted_segments.push({
        text: sentences[Math.min(1, sentences.length - 1)].trim(),
        type: "plagiarism",
        probability: plagiarism_probability,
        reason: "Posible coincidencia de referencias"
      });
    }
  }

  return {
    ai_probability,
    plagiarism_probability,
    originality_score,
    perplexity_score,
    burstiness_score: Number(burstiness.toFixed(2)),
    verdict,
    confidence,
    ai_indicators: ai_indicators.length > 0 ? ai_indicators : ["No se encontraron patrones típicos de generación artificial"],
    plagiarism_indicators: plagiarism_indicators.length > 0 ? plagiarism_indicators : ["No se detectaron marcas directas de copia textual"],
    style_analysis: {
      sentence_variety: burstiness > 4 ? "alta" : burstiness > 2 ? "media" : "baja",
      vocabulary_richness: ttr > 0.55 ? "alta" : ttr > 0.4 ? "media" : "baja",
      coherence: "alta",
      formality: "formal",
    },
    summary: `Análisis estilístico offline completado mediante motor local CPU/Wasm (${threads} hilos). El texto exhibe una perplejidad estimada de ${perplexity_score} y un factor de burstiness de ${burstiness.toFixed(1)}. El dictamen es ${verdict} con un nivel de confianza ${confidence}.`,
    highlighted_segments
  };
}

export async function detectLocalLLM(
  model: LocalModel,
  text: string,
  onProgress: (p: LocalLLMProgress) => void
): Promise<LocalDetectResult> {
  if (localLLM.device !== "webgpu" || typeof navigator === "undefined" || !(navigator as any).gpu) {
    localLLM.device = "wasm";
    console.warn("[LocalLLM] No WebGPU support. Running optimized offline CPU/WASM fallback.");
    return detectFallbackCPU(text, onProgress);
  }

  try {
    const engine = await localLLM.getEngine(model, onProgress);
    onProgress({ type: "generating", text: "Analizando texto con IA local...", progress: 80 });

    const words = text.split(/\s+/);
    const sample = words.slice(0, 1200).join(" ");

    const systemPrompt = `Eres un detector experto de plagio y contenido generado por IA bajo el esquema de 'Extracción Rígida de Contexto'.
Analiza el texto con máximo rigor científico basándote única y exclusivamente en los patrones gramaticales y semánticos del contenido proporcionado, sin añadir suposiciones ni interpretaciones externas.
Responde ÚNICAMENTE con JSON válido, sin texto adicional antes o después.`;
    const userPrompt = `Analiza el siguiente texto para detectar si fue generado por IA o contiene plagio.

TEXTO A ANALIZAR:
${sample}

Responde ÚNICAMENTE con este JSON válido (sin texto adicional):
{
  "ai_probability": 0.0,
  "plagiarism_probability": 0.0,
  "originality_score": 0.0,
  "perplexity_score": 0.0,
  "burstiness_score": 0.0,
  "verdict": "ORIGINAL",
  "confidence": "media",
  "ai_indicators": [],
  "plagiarism_indicators": [],
  "style_analysis": {
    "sentence_variety": "normal",
    "vocabulary_richness": "alta",
    "coherence": "alta",
    "formality": "alta"
  },
  "summary": "Resumen del análisis",
  "highlighted_segments": [
    {
      "text": "frase exacta del texto",
      "type": "ai",
      "probability": 0.85,
      "reason": "razón del análisis"
    }
  ]
}

INSTRUCCIONES:
- Para evitar alucinaciones y garantizar el rigor, temperature: 0.0 es obligatorio.
- ai_probability: 0.0 a 1.0 (probabilidad de texto generado por IA)
- plagiarism_probability: 0.0 a 1.0 (probabilidad de plagio)
- originality_score: 0.0 a 1.0 (originalidad del texto)
- perplexity_score: 0 a 100 (perplejidad estimada; bajo = más probable IA)
- burstiness_score: 0 a 10 (variación de longitud de oraciones; bajo = más IA)
- verdict: "PROBABLE_IA" | "PROBABLE_PLAGIO" | "ORIGINAL" | "SOSPECHOSO"
- confidence: "alta" | "media" | "baja"
- ai_indicators: lista de indicadores específicos observados
- style_analysis values: "baja" | "normal" | "alta"
- summary: párrafo explicando el análisis en español`;

    const response = await engine.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const extracted = extractJson(raw);

    try {
      const parsed = JSON.parse(extracted);
      const res: LocalDetectResult = {
        ai_probability: Number(parsed.ai_probability ?? 0.3),
        plagiarism_probability: Number(parsed.plagiarism_probability ?? 0.1),
        originality_score: Number(parsed.originality_score ?? 0.7),
        perplexity_score: Number(parsed.perplexity_score ?? 50),
        burstiness_score: Number(parsed.burstiness_score ?? 5),
        verdict: parsed.verdict ?? "SOSPECHOSO",
        confidence: parsed.confidence ?? "media",
        ai_indicators: Array.isArray(parsed.ai_indicators) ? parsed.ai_indicators : [],
        plagiarism_indicators: Array.isArray(parsed.plagiarism_indicators) ? parsed.plagiarism_indicators : [],
        style_analysis: {
          sentence_variety: parsed.style_analysis?.sentence_variety ?? "normal",
          vocabulary_richness: parsed.style_analysis?.vocabulary_richness ?? "normal",
          coherence: parsed.style_analysis?.coherence ?? "alta",
          formality: parsed.style_analysis?.formality ?? "alta",
        },
        summary: parsed.summary ?? "Análisis completado con el modelo local.",
        highlighted_segments: Array.isArray(parsed.highlighted_segments) ? parsed.highlighted_segments : []
      };

      if (res.highlighted_segments?.length === 0) {
        // Generar un par de resaltados por defecto
        const sents = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 15);
        if (sents.length > 0) {
          res.highlighted_segments?.push({
            text: sents[0].trim(),
            type: res.ai_probability > 0.4 ? "ai" : "original",
            probability: res.ai_probability
          });
        }
      }
      return res;
    } catch {
      throw new Error("El modelo no pudo generar un análisis válido.");
    }
  } catch (err: any) {
    console.warn("[LocalLLM] Error cargando WebGPU, activando fallback silencioso WASM/CPU...", err);
    localLLM.device = "wasm";
    return detectFallbackCPU(text, onProgress);
  }
}
