import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/feedback/ToastProvider";

function Harness() {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.success("Role updated.")}>Success</button>
      <button type="button" onClick={() => toast.error("The change could not be saved.")}>Error</button>
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("dismisses a success notification after five seconds", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Harness /></ToastProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    expect(screen.getByRole("status")).toHaveTextContent("Role updated.");
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText("Role updated.")).not.toBeInTheDocument();
  });

  it("pauses and resumes dismissal while the notification is hovered", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Harness /></ToastProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const notification = screen.getByRole("status");
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.mouseEnter(notification);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Role updated.")).toBeInTheDocument();

    fireEvent.mouseLeave(notification);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText("Role updated.")).not.toBeInTheDocument();
  });

  it("allows an error notification to be closed immediately", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Harness /></ToastProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The change could not be saved.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("The change could not be saved.")).not.toBeInTheDocument();
  });

  it("keeps only the three newest notifications", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Harness /></ToastProvider>);

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Success" }));
    }

    expect(screen.getAllByRole("status")).toHaveLength(3);
  });
});
