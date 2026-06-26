import { useState, useRef, useEffect } from "react";
import { Settings, Wifi, WifiOff, ChevronDown, Cpu } from "lucide-react";
import { useLocation } from "wouter";
import Logo from "./Logo";
import SettingsModal from "./SettingsModal";
import { LocalModel, LOCAL_MODELS } from "@/lib/utils";

interface Props {
  mode: "cloud" | "local";
  onModeToggle: () => void;
  webGpuAvailable: boolean;
  localModel?: LocalModel;
  onLocalModelChange?: (model: LocalModel) => void;
}

export default function Header({
  mode,
  onModeToggle,
  webGpuAvailable,
  localModel = "phi3",
  onLocalModelChange,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [, navigate] = useLocation();
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setModelDropOpen(false);
      }
    }
    if (modelDropOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelDropOpen]);

  const handleSettingsClick = () => setSettingsOpen((v) => !v);

  const currentModel = LOCAL_MODELS[localModel];

  return (
    <>
      <header
        className="sticky top-0 z-40 px-4 md:px-6"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
          {/* Logo + Title */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Logo size={34} />
            <div className="text-left hidden sm:block">
              <div className="text-sm font-bold text-white leading-tight tracking-tight">ExamAI</div>
              <div className="text-xs text-white/40 leading-tight">Híbrido</div>
            </div>
          </button>

          {/* Center - Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavBtn href="/" label="Dashboard" />
            <NavBtn href="/exam" label="Exámenes" />
            <NavBtn href="/detect" label="Antiplagio" />
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Local model dropdown — visible when in local mode */}
            {mode === "local" && (
              <div ref={dropRef} className="relative">
                <button
                  onClick={() => setModelDropOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-xl text-xs font-medium transition-all duration-200"
                  style={{
                    background: modelDropOpen
                      ? "rgba(52,199,89,0.18)"
                      : "rgba(52,199,89,0.10)",
                    border: modelDropOpen
                      ? "1px solid rgba(52,199,89,0.45)"
                      : "1px solid rgba(52,199,89,0.2)",
                    color: "#34C759",
                  }}
                >
                  <Cpu size={11} />
                  <span className="hidden sm:inline max-w-[110px] truncate">
                    {currentModel.label}
                  </span>
                  <ChevronDown
                    size={10}
                    style={{
                      transform: modelDropOpen ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>

                {modelDropOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] origin-top-right z-50 rounded-2xl overflow-hidden animate-fade-in"
                    style={{
                      background: "rgba(28,28,30,0.96)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      backdropFilter: "blur(24px)",
                      boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
                    }}
                  >
                    <div
                      className="px-3 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      Motor Local
                    </div>
                    {(Object.keys(LOCAL_MODELS) as LocalModel[]).map((key) => {
                      const m = LOCAL_MODELS[key];
                      const isActive = key === localModel;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            onLocalModelChange?.(key);
                            setModelDropOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 transition-colors duration-100 flex items-center justify-between group"
                          style={{
                            background: isActive ? "rgba(52,199,89,0.14)" : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLElement).style.background =
                                "rgba(255,255,255,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                          }}
                        >
                          <div>
                            <div
                              className="text-sm font-semibold leading-tight"
                              style={{ color: isActive ? "#34C759" : "rgba(255,255,255,0.85)" }}
                            >
                              {m.label}
                            </div>
                            <div
                              className="text-xs mt-0.5 leading-tight"
                              style={{ color: "rgba(255,255,255,0.38)" }}
                            >
                              {m.sublabel}
                            </div>
                          </div>
                          {isActive && (
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: "#34C759" }}
                            />
                          )}
                        </button>
                      );
                    })}
                    <div className="h-2" />
                  </div>
                )}
              </div>
            )}

            {/* Mode Switch */}
            <button
              onClick={webGpuAvailable ? onModeToggle : undefined}
              className="mode-switch"
              title={
                webGpuAvailable
                  ? `Cambiar a modo ${mode === "cloud" ? "Local" : "API"}`
                  : "WebGPU no disponible en este dispositivo"
              }
              style={{
                opacity: webGpuAvailable ? 1 : 0.5,
                cursor: webGpuAvailable ? "pointer" : "not-allowed",
              }}
            >
              <span className="text-xs font-medium text-white/70 whitespace-nowrap">
                {mode === "cloud" ? (
                  <span className="flex items-center gap-1.5">
                    <Wifi size={12} className="text-blue-400" />
                    <span className="hidden sm:inline">Modo API</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <WifiOff size={12} className="text-emerald-400" />
                    <span className="hidden sm:inline">Modo Local</span>
                  </span>
                )}
              </span>
              <div className={`toggle-pill ${mode === "local" ? "active" : ""}`} />
            </button>

            {/* Settings */}
            <button
              onClick={handleSettingsClick}
              className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-200"
              style={{
                background: settingsOpen
                  ? "rgba(10,132,255,0.2)"
                  : "rgba(255,255,255,0.07)",
                border: settingsOpen
                  ? "1px solid rgba(10,132,255,0.4)"
                  : "1px solid rgba(255,255,255,0.1)",
              }}
              title="Ajustes"
            >
              <Settings
                size={16}
                className="text-white/70"
                style={{
                  transform: settingsOpen ? "rotate(45deg)" : "rotate(0)",
                  transition: "transform 0.3s",
                }}
              />
            </button>

            {/* Mobile Nav Menu */}
            <MobileMenu />
          </div>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function NavBtn({ href, label }: { href: string; label: string }) {
  const [location, navigate] = useLocation();
  const active = location === href;
  return (
    <button
      onClick={() => navigate(href)}
      className="px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
      style={{
        background: active ? "rgba(10,132,255,0.15)" : "transparent",
        color: active ? "#0A84FF" : "rgba(255,255,255,0.55)",
      }}
    >
      {label}
    </button>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="md:hidden w-9 h-9 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <ChevronDown size={16} className="text-white/70" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
      <div className="absolute top-16 right-4 z-40 glass rounded-2xl p-2 min-w-36 animate-fade-in">
        {[
          { href: "/", label: "Dashboard" },
          { href: "/exam", label: "Exámenes" },
          { href: "/detect", label: "Antiplagio" },
        ].map((item) => (
          <button
            key={item.href}
            onClick={() => {
              navigate(item.href);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/08 transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
