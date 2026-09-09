import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TurnstileChallenge from "@/components/auth/TurnstileChallenge";

const turnstile = vi.hoisted(() => ({
  render: vi.fn(),
  remove: vi.fn(),
  options: null as null | {
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
    sitekey: string;
    size: string;
  },
  scriptProps: null as null | {
    nonce?: string;
    src?: string;
    strategy?: string;
  }
}));

vi.mock("next/script", async () => {
  const React = await import("react");
  return {
    default: ({ onLoad, ...props }: { onLoad?: () => void; nonce?: string; src?: string; strategy?: string }) => {
      turnstile.scriptProps = props;
      React.useEffect(() => {
        onLoad?.();
      }, [onLoad]);
      return null;
    }
  };
});

beforeEach(() => {
  turnstile.render.mockReset();
  turnstile.remove.mockReset();
  turnstile.options = null;
  turnstile.scriptProps = null;
  turnstile.render.mockImplementation((_container, options) => {
    turnstile.options = options;
    return "widget-1";
  });

  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024
  });
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    value: {
      render: turnstile.render,
      remove: turnstile.remove
    }
  });
});

describe("TurnstileChallenge", () => {
  it("passes the request nonce to the official Turnstile script", async () => {
    render(<TurnstileChallenge siteKey="site-key" nonce="request-nonce-123" onToken={vi.fn()} />);

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(turnstile.scriptProps).toMatchObject({
      nonce: "request-nonce-123",
      src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
      strategy: "afterInteractive"
    });
  });

  it("renders one explicit widget and emits the verified token", async () => {
    const onToken = vi.fn();
    render(<TurnstileChallenge siteKey="site-key" onToken={onToken} />);

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(turnstile.options).toMatchObject({ sitekey: "site-key", size: "flexible" });

    act(() => turnstile.options?.callback("token-123"));
    expect(onToken).toHaveBeenLastCalledWith("token-123");
  });

  it("uses the compact widget on very narrow production viewports", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360
    });

    render(<TurnstileChallenge siteKey="site-key" onToken={vi.fn()} />);

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(turnstile.options).toMatchObject({ sitekey: "site-key", size: "compact" });
  });

  it("clears the token when the challenge expires", async () => {
    const onToken = vi.fn();
    render(<TurnstileChallenge siteKey="site-key" onToken={onToken} />);

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    act(() => turnstile.options?.["expired-callback"]());

    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it("clears the token when Turnstile reports an error", async () => {
    const onToken = vi.fn();
    render(<TurnstileChallenge siteKey="site-key" onToken={onToken} />);

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    act(() => turnstile.options?.["error-callback"]());

    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it("removes the widget on unmount and does not duplicate it on rerender", async () => {
    const onToken = vi.fn();
    const view = render(<TurnstileChallenge siteKey="site-key" onToken={onToken} />);

    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    view.rerender(<TurnstileChallenge siteKey="site-key" onToken={onToken} />);
    expect(turnstile.render).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(turnstile.remove).toHaveBeenCalledWith("widget-1");
  });
});
