"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  size: "flexible" | "compact";
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

export type TurnstileChallengeStatus = "loading" | "ready" | "verified" | "expired" | "error";

export default function TurnstileChallenge({
  siteKey,
  nonce,
  onToken,
  onStatus
}: {
  siteKey: string;
  nonce?: string | null;
  onToken: (token: string | null) => void;
  onStatus?: (status: TurnstileChallengeStatus) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (widgetIdRef.current || !containerRef.current) return;

    const api = (window as TurnstileWindow).turnstile;
    if (!api) return;

    const size = window.innerWidth <= 380 ? "compact" : "flexible";
    onToken(null);
    widgetIdRef.current = api.render(containerRef.current, {
      sitekey: siteKey,
      size,
      callback: (token) => {
        onToken(token);
        onStatus?.("verified");
      },
      "expired-callback": () => {
        onToken(null);
        onStatus?.("expired");
      },
      "error-callback": () => {
        onToken(null);
        onStatus?.("error");
      }
    });
    onStatus?.("ready");
  }, [onStatus, onToken, siteKey]);

  useEffect(() => {
    renderWidget();

    return () => {
      const widgetId = widgetIdRef.current;
      const api = (window as TurnstileWindow).turnstile;
      if (widgetId && api) api.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce ?? undefined}
        onLoad={renderWidget}
      />
      <div
        ref={containerRef}
        data-turnstile-container
        className="authTurnstileContainer"
      />
    </>
  );
}
