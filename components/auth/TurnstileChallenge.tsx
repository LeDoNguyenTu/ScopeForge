"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  size: "flexible";
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

export default function TurnstileChallenge({
  siteKey,
  onToken
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (widgetIdRef.current || !containerRef.current) return;

    const api = (window as TurnstileWindow).turnstile;
    if (!api) return;

    onToken(null);
    widgetIdRef.current = api.render(containerRef.current, {
      sitekey: siteKey,
      size: "flexible",
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null)
    });
  }, [onToken, siteKey]);

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
        onLoad={renderWidget}
      />
      <div ref={containerRef} data-turnstile-container />
    </>
  );
}
