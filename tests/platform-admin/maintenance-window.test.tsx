import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MaintenanceWindowStatus from "@/components/maintenance/MaintenanceWindowStatus";
import { zonedLocalDateTimeToIso } from "@/lib/platform-settings/time-zone";

afterEach(() => {
  vi.useRealTimers();
});

describe("maintenance window scheduling", () => {
  it("converts an administrator's zoned wall clock to one UTC instant", () => {
    expect(zonedLocalDateTimeToIso("2027-01-15T10:30", "Asia/Singapore"))
      .toBe("2027-01-15T02:30:00.000Z");
    expect(zonedLocalDateTimeToIso("2027-01-15T10:30", "Not/A_Timezone")).toBeNull();
  });

  it("shows a live shared countdown and explains manual completion", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-15T02:00:00.000Z"));
    render(<MaintenanceWindowStatus
      endsAt="2027-01-15T02:30:00.000Z"
      timeZone="Asia/Singapore"
      autoDisable={false}
      serverNow={Date.parse("2027-01-15T02:00:00.000Z")}
    />);
    expect(screen.getByText("30m 0s remaining")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("29m 59s remaining")).toBeInTheDocument();
  });
});
