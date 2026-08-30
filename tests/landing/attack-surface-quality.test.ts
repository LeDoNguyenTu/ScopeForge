import { describe, expect, it } from "vitest";
import { selectAttackSurfaceQuality } from "@/components/landing/attack-surface/quality";

describe("selectAttackSurfaceQuality", () => {
  it("uses high quality for large capable desktops", () => {
    expect(selectAttackSurfaceQuality({ width: 1536, dpr: 2, reducedMotion: false, deviceMemory: 8 })).toBe("high");
  });

  it("uses balanced quality for constrained desktop/tablet layouts", () => {
    expect(selectAttackSurfaceQuality({ width: 1180, dpr: 2, reducedMotion: false, deviceMemory: 8 })).toBe("balanced");
    expect(selectAttackSurfaceQuality({ width: 1536, dpr: 2, reducedMotion: false, deviceMemory: 4 })).toBe("balanced");
  });

  it("uses mobile quality below 768px", () => {
    expect(selectAttackSurfaceQuality({ width: 430, dpr: 3, reducedMotion: false, deviceMemory: 6 })).toBe("mobile");
  });

  it("always honors reduced motion", () => {
    expect(selectAttackSurfaceQuality({ width: 1536, dpr: 2, reducedMotion: true, deviceMemory: 8 })).toBe("reduced");
  });
});
