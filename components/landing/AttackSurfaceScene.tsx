"use client";

import { useEffect, useRef, useState } from "react";
import AttackSurfaceFallback from "@/components/landing/AttackSurfaceFallback";
import { useLandingBoot } from "@/components/landing/LandingBootGate";
import { QUALITY_PROFILES } from "@/components/landing/attack-surface/constants";
import { selectAttackSurfaceQuality } from "@/components/landing/attack-surface/quality";
import { createSceneProgress, type BootMilestone } from "@/components/landing/attack-surface/progress";
import type { AttackSurfaceController, SceneMilestone } from "@/components/landing/attack-surface/createAttackSurfaceScene";

type RendererState = "fallback" | "webgl";

const STAGE_LABELS: Readonly<Record<BootMilestone, string>> = Object.freeze({
  module: "Initializing renderer",
  capability: "Checking browser capabilities",
  geometry: "Building attack surface",
  materials: "Preparing materials",
  "first-frame": "Rendering first frame",
});

export default function AttackSurfaceScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendererState, setRendererState] = useState<RendererState>("fallback");
  const { reportProgress, markReady, releaseFallback } = useLandingBoot();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let cancelled = false;
    let controller: AttackSurfaceController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let raf = 0;
    let pageVisible = typeof document === "undefined" ? true : !document.hidden;
    let inViewport = true;
    const progress = createSceneProgress();

    const publish = (milestone: BootMilestone) => {
      reportProgress(progress.mark(milestone), STAGE_LABELS[milestone]);
    };

    const requestFrame = () => {
      if (cancelled || raf || !pageVisible || !inViewport || !controller) return;
      raf = window.requestAnimationFrame((time) => {
        raf = 0;
        if (cancelled || !controller || !pageVisible || !inViewport) return;
        controller.render(time);
        requestFrame();
      });
    };

    const syncVisibility = () => {
      const active = pageVisible && inViewport;
      controller?.setVisible(active);
      if (active) requestFrame();
      else if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onDocumentVisibility = () => {
      pageVisible = !document.hidden;
      syncVisibility();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!controller) return;
      const bounds = container.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2;
      const y = -(((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2);
      controller.setPointer(x, y);
    };

    const onPointerLeave = () => controller?.setPointer(0, 0);

    const start = async () => {
      try {
        const module = await import("@/components/landing/attack-surface/createAttackSurfaceScene");
        if (cancelled) return;
        publish("module");

        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const width = Math.max(1, container.clientWidth || window.innerWidth);
        const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
        const quality = selectAttackSurfaceQuality({
          width,
          dpr: window.devicePixelRatio || 1,
          reducedMotion,
          deviceMemory: memory,
        });

        const onMilestone = (milestone: SceneMilestone) => publish(milestone);
        controller = module.createAttackSurfaceScene({ canvas, quality, onMilestone });
        if (cancelled) {
          controller.dispose();
          controller = null;
          return;
        }

        const profile = QUALITY_PROFILES[quality];
        const resize = (nextWidth: number, nextHeight: number) => {
          controller?.resize(
            Math.max(1, nextWidth),
            Math.max(1, nextHeight),
            Math.min(window.devicePixelRatio || 1, profile.dprCap),
          );
        };
        resize(container.clientWidth || width, container.clientHeight || Math.round(width * 0.72));

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            resize(entry.contentRect.width, entry.contentRect.height);
          });
          resizeObserver.observe(container);
        } else {
          const onWindowResize = () => resize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight * 0.72);
          window.addEventListener("resize", onWindowResize, { passive: true });
          // Assign a cleanup-compatible shim when ResizeObserver is absent.
          resizeObserver = { disconnect: () => window.removeEventListener("resize", onWindowResize) } as ResizeObserver;
        }

        if (typeof IntersectionObserver !== "undefined") {
          intersectionObserver = new IntersectionObserver((entries) => {
            const entry = entries[0];
            inViewport = entry ? entry.isIntersecting : true;
            syncVisibility();
          }, { rootMargin: "120px" });
          intersectionObserver.observe(container);
        }

        document.addEventListener("visibilitychange", onDocumentVisibility);
        container.addEventListener("pointermove", onPointerMove, { passive: true });
        container.addEventListener("pointerleave", onPointerLeave, { passive: true });

        setRendererState("webgl");
        requestFrame();
        controller.firstFrame.then(() => {
          if (cancelled) return;
          publish("first-frame");
          markReady();
        });
      } catch {
        if (cancelled) return;
        setRendererState("fallback");
        reportProgress(100, "Optimized fallback ready");
        releaseFallback();
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onDocumentVisibility);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      controller?.dispose();
    };
  }, [markReady, releaseFallback, reportProgress]);

  return (
    <div
      ref={containerRef}
      className="commandSurface commandSurfaceV4"
      data-testid="attack-surface-scene"
      data-renderer-state={rendererState}
      data-scene-depth="3d"
      aria-label="Illustrative ScopeForge living attack surface"
    >
      <canvas ref={canvasRef} className="commandSurfaceCanvas commandSurfaceCanvasV4" aria-hidden="true" />
      <AttackSurfaceFallback />

      <div className="commandSurfaceLabel commandSurfaceLabelWeb">
        <strong>WEB APPLICATION</strong>
        <span>2 Findings</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelSandbox">
        <strong>SANDBOX</strong>
        <span>Isolated</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelThird">
        <strong>THIRD PARTY</strong>
        <span>Monitored</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelData">
        <strong>DATA STORE</strong>
        <span>At Risk</span>
      </div>
      <div className="commandSurfaceLabel commandSurfaceLabelIdentity">
        <strong>IDENTITY</strong>
        <span>Healthy</span>
      </div>
    </div>
  );
}
