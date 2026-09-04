import CommandCenterHeroDesktopV5 from "@/components/landing/CommandCenterHeroDesktopV5";
import CommandCenterHeroMobileV5 from "@/components/landing/CommandCenterHeroMobileV5";

export default function CommandCenterLandingHero() {
  return (
    <div className="ccV5HeroShell">
      <CommandCenterHeroDesktopV5 />
      <CommandCenterHeroMobileV5 />
    </div>
  );
}
