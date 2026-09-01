"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLandingBoot } from "@/components/landing/LandingBootGate";
import { ATTACK_SURFACE_PAUSE_EVENT } from "@/components/landing/SceneMonitoringToggle";
import { createIllustrativeAttackSurfaceV5Model } from "@/components/landing/attack-surface-v5/model";
import { getAttackSurfaceV5QualitySettings, selectAttackSurfaceV5Quality } from "@/components/landing/attack-surface-v5/quality";
import type { AttackSurfaceV5Controller, AttackSurfaceV5ProjectedAnchor, AttackSurfaceV5Variant } from "@/components/landing/attack-surface-v5/controller";

type RendererState = "poster" | "webgl" | "fallback";

const PROGRESS = Object.freeze({ module: 20, capability: 32, geometry: 62, materials: 82, firstFrame: 100 });
const POSTER_SOURCE: Record<AttackSurfaceV5Variant, string> = {
  desktop: "/command-center-v5-poster-desktop.webp",
  mobile: "/command-center-v5-poster-mobile.webp",
};

export default function AttackSurfaceSceneV5({ variant = "desktop" }: { variant?: AttackSurfaceV5Variant }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const model = useMemo(() => createIllustrativeAttackSurfaceV5Model(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaQuery = variant === "desktop" ? "(min-width: 900px)" : "(max-width: 899px)";
  const [mediaActive, setMediaActive] = useState(false);
  const [rendererState, setRendererState] = useState<RendererState>("poster");
  const [posterVisible, setPosterVisible] = useState(true);
  const { reportProgress, markReady, releaseFallback } = useLandingBoot();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia) {
      setMediaActive(variant === "desktop" ? window.innerWidth >= 900 : window.innerWidth < 900);
      return;
    }
    const query = window.matchMedia(mediaQuery);
    const sync = () => setMediaActive(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, [mediaQuery, variant]);

  useEffect(() => {
    if (!mediaActive) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let cancelled = false;
    let controller: AttackSurfaceV5Controller | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let raf = 0;
    let pageVisible = !document.hidden;
    let inViewport = true;
    let userPaused = false;
    let reducedMotion = false;

    const updateLabels = (anchors: readonly AttackSurfaceV5ProjectedAnchor[]) => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      for (const anchor of anchors) {
        const label = container.querySelector<HTMLElement>(`[data-entity-id="${anchor.id}"]`);
        if (!label) continue;
        const centered = Math.abs(anchor.x - width / 2) < width * 0.13;
        const side = centered ? "center" : anchor.x < width / 2 ? "left" : "right";
        const labelWidth = variant === "mobile" ? 112 : 142;
        const outward = variant === "mobile" ? 24 : 34;
        const offsetX = side === "left" ? -(labelWidth + outward) : side === "right" ? outward : -labelWidth / 2;
        const offsetY = side === "center" ? (anchor.y < height / 2 ? -74 : 24) : -24;
        label.style.setProperty("--cc-v52-anchor-x", `${anchor.x.toFixed(2)}px`);
        label.style.setProperty("--cc-v52-anchor-y", `${anchor.y.toFixed(2)}px`);
        label.style.setProperty("--cc-v52-label-dx", `${offsetX}px`);
        label.style.setProperty("--cc-v52-label-dy", `${offsetY}px`);
        label.dataset.anchorReady = "true";
        label.dataset.anchorSide = side;
        label.style.opacity = anchor.visible ? "1" : "0";
      }
    };

    const requestFrame = () => {
      if (cancelled || raf || !controller || !pageVisible || !inViewport || userPaused || reducedMotion) return;
      raf = window.requestAnimationFrame((time) => {
        raf = 0;
        if (!controller || cancelled || !pageVisible || !inViewport || userPaused) return;
        controller.render(time);
        requestFrame();
      });
    };

    const syncActivity = () => {
      const active = pageVisible && inViewport;
      controller?.setVisible(active);
      controller?.setPaused(userPaused || reducedMotion);
      if (active && !userPaused && !reducedMotion) requestFrame();
      else if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onDocumentVisibility = () => { pageVisible = !document.hidden; syncActivity(); };
    const onPause = (event: Event) => { userPaused = Boolean((event as CustomEvent<{ paused?: boolean }>).detail?.paused); syncActivity(); };
    const onPointerMove = (event: PointerEvent) => {
      if (!controller || reducedMotion) return;
      const bounds = container.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2;
      const y = -(((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2);
      controller.setPointer(x, y);
    };
    const onPointerLeave = () => controller?.setPointer(0, 0);

    const start = async () => {
      try {
        reportProgress(PROGRESS.module, "Initializing Three.js renderer");
        const webgl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!webgl) {
          setRendererState("fallback");
          reportProgress(100, "Polished static scene ready");
          releaseFallback();
          return;
        }

        reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const width = Math.max(1, container.clientWidth || window.innerWidth);
        const dpr = window.devicePixelRatio || 1;
        const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
        const quality = selectAttackSurfaceV5Quality({ width, dpr, reducedMotion, deviceMemory: memory });
        const settings = getAttackSurfaceV5QualitySettings(quality);
        reportProgress(PROGRESS.capability, `Renderer quality: ${quality}`);

        const module = await import("@/components/landing/attack-surface-v5/controller");
        if (cancelled) return;
        controller = module.createAttackSurfaceV5Controller({ canvas, model, quality, variant, onAnchorFrame: updateLabels });
        reportProgress(PROGRESS.geometry, "Building premium citadel attack surface");
        reportProgress(PROGRESS.materials, "Preparing scene lighting and materials");

        const resize = (nextWidth: number, nextHeight: number) => controller?.resize(
          Math.max(1, nextWidth),
          Math.max(1, nextHeight),
          Math.min(window.devicePixelRatio || 1, settings.dprCap),
        );
        resize(container.clientWidth || width, container.clientHeight || (variant === "mobile" ? Math.round(width * 1.04) : Math.round(width * 0.72)));

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) resize(entry.contentRect.width, entry.contentRect.height);
          });
          resizeObserver.observe(container);
        }
        if (typeof IntersectionObserver !== "undefined") {
          intersectionObserver = new IntersectionObserver((entries) => {
            inViewport = entries[0]?.isIntersecting ?? true;
            syncActivity();
          }, { rootMargin: "120px" });
          intersectionObserver.observe(container);
        }

        document.addEventListener("visibilitychange", onDocumentVisibility);
        window.addEventListener(ATTACK_SURFACE_PAUSE_EVENT, onPause);
        container.addEventListener("pointermove", onPointerMove, { passive: true });
        container.addEventListener("pointerleave", onPointerLeave, { passive: true });

        controller.setVisible(true);
        controller.setPaused(false);
        const now = performance.now();
        controller.render(now);
        controller.render(now + 16);
        if (reducedMotion) controller.setPaused(true);
        else requestFrame();

        controller.firstStableFrame.then(() => {
          if (cancelled) return;
          setRendererState("webgl");
          setPosterVisible(false);
          reportProgress(PROGRESS.firstFrame, "Attack surface ready");
          markReady();
        });
      } catch {
        if (cancelled) return;
        setRendererState("fallback");
        setPosterVisible(true);
        reportProgress(100, "Polished static scene ready");
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
      window.removeEventListener(ATTACK_SURFACE_PAUSE_EVENT, onPause);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      controller?.dispose();
      controller = null;
    };
  }, [markReady, mediaActive, model, releaseFallback, reportProgress, variant]);

  return (
    <div ref={containerRef} className={`ccV5Scene ccV5Scene-${variant}`} data-testid="attack-surface-v5-scene" data-renderer-state={rendererState} data-media-active={mediaActive ? "true" : "false"} aria-label="Illustrative ScopeForge living attack surface">
      <div className={`ccV5Poster${posterVisible ? " ccV5Poster-visible" : ""}`} data-testid="attack-surface-v5-poster" aria-hidden="true">
        <div className="ccV5PosterCore"><i /><i /><i /><i /></div>
        {model.entities.map((entity) => <span key={entity.id} data-state={entity.state} data-arm={entity.armIndex} />)}
        <img src={POSTER_SOURCE[variant]} alt="" draggable={false} decoding="async" style={{ position: "absolute", inset: 0, zIndex: 2, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
      </div>
      <canvas ref={canvasRef} className="ccV5Canvas" aria-hidden="true" />
      <div className="ccV5SceneLabels" aria-label="Illustrative scene entities">
        {model.entities.map((entity) => (
          <div className="ccV5SceneLabel" data-state={entity.state} data-entity-id={entity.id} data-arm={entity.armIndex} key={entity.id}>
            <strong>{entity.label}</strong>
            <span>{entity.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
