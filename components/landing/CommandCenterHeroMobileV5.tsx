import AttackSurfaceSceneV5 from "@/components/landing/AttackSurfaceSceneV5";
import {
  CommandCenterV5Copy,
  CommandCenterV5Metrics,
  CommandCenterV5Overview,
  CommandCenterV5Runtime,
} from "@/components/landing/CommandCenterV5Primitives";

export default function CommandCenterHeroMobileV5() {
  return (
    <section className="ccV5Mobile" data-testid="command-center-v5-mobile" aria-labelledby="command-hero-title-mobile">
      <div className="ccV5BackdropGrid" aria-hidden="true" />
      <div className="ccV5MobileCopy" data-testid="command-copy"><CommandCenterV5Copy titleId="command-hero-title-mobile" mobile /></div>
      <div className="ccV5MobileScene" data-testid="command-scene"><AttackSurfaceSceneV5 variant="mobile" /></div>
      <CommandCenterV5Metrics mobile />
      <CommandCenterV5Runtime mobile />
      <CommandCenterV5Overview mobile />
    </section>
  );
}
