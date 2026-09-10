import Link from "next/link";
import AppShell from "@/components/AppShell";
import { demoIdentity } from "@/lib/demo/fixtures";
export default function DemoRegistrationPage() {
  return <AppShell {...demoIdentity}><section className="pageHeader"><div><span className="sectionEyebrow">Portfolio demo</span><h1>Explore the sample inventory</h1><p>This demo is read-only. Its eight sample assets include six simulated verified assets and two awaiting proof.</p></div></section><section className="panel"><p className="demoNote">Asset registration, verification requests and scans are unavailable here. You can review the inventory, filter findings and inspect sample evidence.</p><Link className="primaryButton compact" href="/dashboard/assets">View sample assets</Link></section></AppShell>;
}
