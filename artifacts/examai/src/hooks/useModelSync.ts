import { useState, useEffect } from "react";
import { LocalModel } from "@/lib/utils";

// Shared module-level state for synchronous updates across routes
let globalMode: "cloud" | "local" = (localStorage.getItem("examai_mode") as any) || "cloud";
let globalLocalModel: LocalModel = (localStorage.getItem("examai_local_model") as any) || "phi3";
const listeners = new Set<() => void>();

export function useModelSync() {
  const [mode, setModeState] = useState(globalMode);
  const [localModel, setLocalModelState] = useState(globalLocalModel);

  useEffect(() => {
    const handleChange = () => {
      setModeState(globalMode);
      setLocalModelState(globalLocalModel);
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const setMode = (newMode: "cloud" | "local") => {
    globalMode = newMode;
    localStorage.setItem("examai_mode", newMode);
    listeners.forEach((l) => l());
  };

  const setLocalModel = (newModel: LocalModel) => {
    globalLocalModel = newModel;
    localStorage.setItem("examai_local_model", newModel);
    listeners.forEach((l) => l());
  };

  return { mode, setMode, localModel, setLocalModel };
}
