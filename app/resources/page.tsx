import PublicNav from "@/components/landing/PublicNav";
import ResourceLibrary from "@/components/ResourceLibrary";

export const metadata = { title: "Resources", description: "Asset readiness and finding review templates, plus ScopeForge project guides." };

export default function ResourcesPage() {
  return <main className="forgeLanding commandLanding"><PublicNav /><div className="publicResourceContent"><ResourceLibrary /></div></main>;
}
