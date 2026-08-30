"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ScopeForgeBootScreen from "@/components/landing/ScopeForgeBootScreen";
import { READY_STORAGE_KEY, SCENE_VERSION } from "@/components/landing/attack-surface/progress";

type LandingBootContextValue = Readonly<{
  reportProgress: (progress: number, stage: string) => void;
  markReady: () => void;
  isCold: boolean;
}>;

const LandingBootContext = createContext<LandingBootContextValue>({
  reportProgress: () => undefined,
  markReady: () => undefined,
  isCold: false,
});

export function useLandingBoot() {
  return useContext(LandingBootContext);
}

export default function LandingBootGate({ children }: { children: ReactNode }) {
  const [bootVisible, setBootVisible] = useState(true);
  const [isCold, setIsCold] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Checking browser capabilities");
  const readyRef = useRef(false);

  useEffect(() => {
    let warm = false;
    try {
      warm = window.localStorage.getItem(READY_STORAGE_KEY) === SCENE_VERSION;
    } catch {
      warm = false;
    }

    setIsCold(!warm);
    if (warm) {
      readyRef.current = true;
      setBootVisible(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!readyRef.current) {
        setStage("Continuing with optimized visual mode");
        setBootVisible(false);
      }
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, []);

  const reportProgress = useCallback((nextProgress: number, nextStage: string) => {
    setProgress((current) => Math.max(current, Math.max(0, Math.min(100, Math.round(nextProgress)))));
    if (nextStage) setStage(nextStage);
  }, []);

  const markReady = useCallback(() => {
    readyRef.current = true;
    setProgress(100);
    setStage("Attack surface ready");
    try {
      window.localStorage.setItem(READY_STORAGE_KEY, SCENE_VERSION);
    } catch {
      // Storage can be unavailable in privacy modes. Readiness still succeeds.
    }
    setBootVisible(false);
  }, []);

  const contextValue = useMemo<LandingBootContextValue>(() => ({
    reportProgress,
    markReady,
    isCold,
  }), [isCold, markReady, reportProgress]);

  return (
    <LandingBootContext.Provider value={contextValue}>
      <div className="scopeForgeLandingBootHost" data-boot-state={bootVisible ? "loading" : "ready"}>
        {children}
        {bootVisible ? <ScopeForgeBootScreen progress={progress} stage={stage} /> : null}
      </div>
    </LandingBootContext.Provider>
  );
}
