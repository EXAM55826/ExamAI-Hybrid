import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days < 7) return `Hace ${days} días`;
  return new Date(timestamp).toLocaleDateString("es-ES");
}

export function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = end - overlap;
  }
  return chunks;
}

export function parseApiKeys(raw: string): string[] {
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

export function getWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export type Difficulty = "fácil" | "media" | "difícil";
export type Provider = "gemini" | "groq" | "cohere" | "qwen" | "phi3" | "llama3";
export type LocalModel = "qwen" | "phi3" | "llama3";
export type QuestionType = "multiple" | "truefalse" | "complete" | "match";

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; sublabel: string }> = {
  multiple: { label: "Alternativas", sublabel: "Opción múltiple A·B·C·D" },
  truefalse: { label: "V / F", sublabel: "Verdadero o Falso" },
  complete: { label: "Completar", sublabel: "Llenar espacios en blanco" },
  match: { label: "Relacionar", sublabel: "Unir conceptos" },
};

export const LOCAL_MODELS: Record<LocalModel, { label: string; sublabel: string }> = {
  qwen: { label: "Qwen 1.5B", sublabel: "Ultra veloz · Ideal móviles" },
  phi3: { label: "Phi-3 Mini", sublabel: "Balanceado y Lógico" },
  llama3: { label: "Llama 3 8B", sublabel: "Máxima Complejidad" },
};

export interface ExamQuestion {
  id: number;
  type?: QuestionType;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  pairs?: { left: string; right: string }[];
}

export interface ExamEntry {
  id: string;
  filename: string;
  provider: Provider;
  questionCount: number;
  difficulty: Difficulty;
  timestamp: number;
  questions: ExamQuestion[];
  subject?: string;
}

export interface AppSettings {
  geminiKeys: string;
  groqKeys: string;
  cohereKeys: string;
}

export interface UsageStats {
  totalQuestions: number;
  providerCounts: Record<string, number>;
  avgTime: number;
  dailyActivity: number[];
}

const STORAGE_KEY_HISTORY = "examai_history";
const STORAGE_KEY_SETTINGS = "examai_settings";
const STORAGE_KEY_STATS = "examai_stats";

export function loadHistory(): ExamEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: ExamEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(entries.slice(0, 50)));
  } catch {}
}

export function addHistoryEntry(entry: ExamEntry): void {
  const existing = loadHistory();
  saveHistory([entry, ...existing]);
}

export function removeHistoryEntry(id: string): void {
  const existing = loadHistory();
  saveHistory(existing.filter((e) => e.id !== id));
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return raw ? JSON.parse(raw) : { geminiKeys: "", groqKeys: "", cohereKeys: "" };
  } catch {
    return { geminiKeys: "", groqKeys: "", cohereKeys: "" };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {}
}

export function loadStats(): UsageStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATS);
    return raw
      ? JSON.parse(raw)
      : { totalQuestions: 0, providerCounts: {}, avgTime: 0, dailyActivity: Array(7).fill(0) };
  } catch {
    return { totalQuestions: 0, providerCounts: {}, avgTime: 0, dailyActivity: Array(7).fill(0) };
  }
}

export function updateStats(provider: string, questionCount: number, timeMs: number): void {
  try {
    const stats = loadStats();
    stats.totalQuestions += questionCount;
    stats.providerCounts[provider] = (stats.providerCounts[provider] || 0) + 1;
    const totalCalls = Object.values(stats.providerCounts).reduce((a, b) => a + b, 0);
    stats.avgTime = Math.round((stats.avgTime * (totalCalls - 1) + timeMs / 1000) / totalCalls);
    const todayIdx = new Date().getDay();
    const activity =
      Array.isArray(stats.dailyActivity) && stats.dailyActivity.length === 7
        ? [...stats.dailyActivity]
        : Array(7).fill(0);
    activity[todayIdx] = (activity[todayIdx] || 0) + questionCount;
    stats.dailyActivity = activity;
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
  } catch {}
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const API_BASE = "/api";
