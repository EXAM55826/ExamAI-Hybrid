import { useLocation } from "wouter";
import { ArrowLeft, Ghost } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#000" }}>
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Ghost size={32} className="text-white/30" />
        </div>
        <h1 className="text-2xl font-bold text-white">Página no encontrada</h1>
        <p className="text-white/40 text-sm">Esta ruta no existe en ExamAI Híbrido.</p>
        <button onClick={() => navigate("/")} className="btn-primary mx-auto">
          <ArrowLeft size={14} />
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
