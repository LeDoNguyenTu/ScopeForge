import PublicNav from "@/components/landing/PublicNav";
import PublicFooter from "@/components/landing/PublicFooter";
import ResourceLibrary from "@/components/ResourceLibrary";

export const metadata = { title: "Resources", description: "Asset readiness and finding review templates, plus ScopeForge project guides." };

export default function ResourcesPage() {
  return (
    <div className="forgeLanding commandLanding">
      <PublicNav />
      <main className="publicResourceContent"><ResourceLibrary /></main>
      <PublicFooter />
    </div>
  );
}
