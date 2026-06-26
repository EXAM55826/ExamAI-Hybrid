import { useState, useEffect, useRef } from "react";
import { X, Key, Eye, EyeOff, Save, Sparkles } from "lucide-react";
import { loadSettings, saveSettings, AppSettings } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [showKeys, setShowKeys] = useState({ gemini: false, groq: false, cohere: false });
  const [saved, setSaved] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const InputField = ({
    label, value, onChange, placeholder, keyName, hint,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder: string; keyName: "gemini" | "groq" | "cohere"; hint?: string;
  }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
        <Key size={11} />
        {label}
      </label>
      <div className="relative">
        <input
          type={showKeys[keyName] ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-glass pr-10 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setShowKeys((s) => ({ ...s, [keyName]: !s[keyName] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
        >
          {showKeys[keyName] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-xs text-white/35">{hint}</p>}
    </div>
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="glass rounded-3xl w-full max-w-md animate-fade-in-up relative"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/08">
          <div>
            <h2 className="text-lg font-bold text-white">Configuración</h2>
            <p className="text-xs text-white/45 mt-0.5">Llaves API para servicios en la nube</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="rounded-2xl p-4" style={{ background: "rgba(10,132,255,0.08)", border: "1px solid rgba(10,132,255,0.2)" }}>
            <p className="text-xs text-blue-300/90 flex items-center gap-2">
              <Sparkles size={12} />
              Puedes ingresar múltiples llaves separadas por comas para rotación automática anti-cuota.
            </p>
          </div>

          <InputField
            label="Google Gemini"
            keyName="gemini"
            value={settings.geminiKeys}
            onChange={(v) => setSettings((s) => ({ ...s, geminiKeys: v }))}
            placeholder="AIza..., AIza..."
            hint="Modelo: gemini-1.5-flash · API v1"
          />
          <InputField
            label="Groq"
            keyName="groq"
            value={settings.groqKeys}
            onChange={(v) => setSettings((s) => ({ ...s, groqKeys: v }))}
            placeholder="gsk_..., gsk_..."
            hint="Modelo: llama-3.3-70b-versatile"
          />
          <InputField
            label="Cohere"
            keyName="cohere"
            value={settings.cohereKeys}
            onChange={(v) => setSettings((s) => ({ ...s, cohereKeys: v }))}
            placeholder="Co..., Co..."
            hint="Modelo: command-r-plus-08-2024"
          />
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button onClick={handleSave} className="btn-primary w-full justify-center">
            {saved ? (
              <span className="flex items-center gap-2">✓ Guardado</span>
            ) : (
              <span className="flex items-center gap-2"><Save size={15} />Guardar configuración</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
