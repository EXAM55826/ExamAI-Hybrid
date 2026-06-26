import { useState, useEffect } from "react";
import { BarChart3, Zap, Clock, Brain } from "lucide-react";
import { loadStats, UsageStats } from "@/lib/utils";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#4285F4",
  groq: "#7C4DFF",
  cohere: "#FF9F0A",
};

export default function StatsPanel() {
  const [stats, setStats] = useState<UsageStats>(loadStats());

  useEffect(() => {
    const id = setInterval(() => setStats(loadStats()), 5000);
    return () => clearInterval(id);
  }, []);

  const topProvider = Object.entries(stats.providerCounts).sort(([, a], [, b]) => b - a)[0];
  const maxActivity = Math.max(...(stats.dailyActivity || []), 1);
  const today = new Date().getDay();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Questions */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(10,132,255,0.15)" }}>
            <Brain size={14} className="text-blue-400" />
          </div>
          <span className="text-xs text-white/45 font-medium">Preguntas</span>
        </div>
        <div className="text-2xl font-bold text-white">{stats.totalQuestions.toLocaleString()}</div>
        <div className="text-xs text-white/35 mt-0.5">generadas en total</div>
      </div>

      {/* Top Provider */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,77,255,0.15)" }}>
            <Zap size={14} className="text-purple-400" />
          </div>
          <span className="text-xs text-white/45 font-medium">IA Favorita</span>
        </div>
        <div className="text-lg font-bold text-white capitalize">
          {topProvider ? topProvider[0] : "—"}
        </div>
        <div className="text-xs text-white/35 mt-0.5">
          {topProvider ? `${topProvider[1]} usos` : "Sin datos aún"}
        </div>
        {topProvider && (
          <div className="flex gap-1 mt-2">
            {Object.entries(stats.providerCounts).map(([p, count]) => {
              const total = Object.values(stats.providerCounts).reduce((a, b) => a + b, 0);
              const pct = Math.round((count / total) * 100);
              return (
                <div
                  key={p}
                  className="h-1.5 rounded-full"
                  style={{ width: `${pct}%`, background: PROVIDER_COLORS[p] || "#ccc", minWidth: 4 }}
                  title={`${p}: ${pct}%`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Avg Time */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,199,89,0.12)" }}>
            <Clock size={14} className="text-emerald-400" />
          </div>
          <span className="text-xs text-white/45 font-medium">Tiempo Prom.</span>
        </div>
        <div className="text-2xl font-bold text-white">{stats.avgTime || "—"}</div>
        <div className="text-xs text-white/35 mt-0.5">{stats.avgTime ? "segundos por generación" : "Sin datos aún"}</div>
      </div>

      {/* Daily Activity */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,159,10,0.15)" }}>
            <BarChart3 size={14} className="text-amber-400" />
          </div>
          <span className="text-xs text-white/45 font-medium">Actividad</span>
        </div>
        <div className="mini-bar">
          {(stats.dailyActivity || Array(7).fill(0)).map((val, i) => {
            const height = maxActivity > 0 ? Math.max((val / maxActivity) * 100, 8) : 8;
            return (
              <div
                key={i}
                className="mini-bar-item"
                style={{
                  height: `${height}%`,
                  background: i === today
                    ? "rgba(10,132,255,0.7)"
                    : val > 0
                    ? "rgba(10,132,255,0.35)"
                    : "rgba(255,255,255,0.06)",
                }}
                title={`${DAYS[i]}: ${val} preguntas`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {DAYS.map((d, i) => (
            <span key={i} className="text-[9px] text-white/20" style={{ color: i === today ? "rgba(10,132,255,0.7)" : undefined }}>
              {d[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
