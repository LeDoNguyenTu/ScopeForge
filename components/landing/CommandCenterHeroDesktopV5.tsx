import AttackSurfaceSceneV5 from "@/components/landing/AttackSurfaceSceneV5";
import {
  CommandCenterV5Copy,
  CommandCenterV5Metrics,
  CommandCenterV5Overview,
  CommandCenterV5Runtime,
} from "@/components/landing/CommandCenterV5Primitives";

export default function CommandCenterHeroDesktopV5() {
  return (
    <section className="ccV5Desktop" data-testid="command-center-v5-desktop" aria-labelledby="command-hero-title-desktop">
      <div className="ccV5BackdropGrid" aria-hidden="true" />
      <div className="ccV5DesktopCopy" data-testid="command-copy"><CommandCenterV5Copy titleId="command-hero-title-desktop" /></div>
      <div className="ccV5DesktopScene" data-testid="command-scene"><AttackSurfaceSceneV5 variant="desktop" /></div>
      <div className="ccV5DesktopMetrics"><CommandCenterV5Metrics /></div>
      <div className="ccV5DesktopOverview"><CommandCenterV5Overview /></div>
      <div className="ccV5DesktopRuntime"><CommandCenterV5Runtime /></div>
    </section>
  );
}
