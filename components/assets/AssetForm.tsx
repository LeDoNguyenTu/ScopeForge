"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { registerAsset } from "@/app/dashboard/assets/actions";

export default function AssetForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await registerAsset(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    router.push(`/dashboard/assets/${result.data.assetId}`);
  }

  return (
    <form className="assetForm panel" onSubmit={onSubmit}>
      <div className="formIntro">
        <span className="moduleIcon"><ShieldCheck size={18} /></span>
        <div><h2>Register an authorized asset</h2><p>Registration records the target only. It does not start a security scan.</p></div>
      </div>

      <label>
        <span>Asset name</span>
        <input name="name" required maxLength={120} placeholder="Production web app" autoComplete="off" />
      </label>

      <label>
        <span>Asset type</span>
        <select name="kind" defaultValue="web_application" aria-label="Asset type">
          <option value="web_application">Web application</option>
          <option value="api">API</option>
          <option value="repository">GitHub repository</option>
        </select>
      </label>

      <label>
        <span>Target URL</span>
        <input name="target" type="url" inputMode="url" required placeholder="https://example.com" aria-describedby="target-help" />
      </label>
      <p className="fieldHelp" id="target-help">Hosted web and API verification accepts HTTPS only. Register only systems you own or are authorized to test.</p>

      {message && <div className="formError" role="alert">{message}</div>}

      <div className="formActions">
        <button className="primaryButton" disabled={pending} type="submit">
          {pending ? "Registering..." : "Register asset"} {!pending && <ArrowRight size={15} />}
        </button>
      </div>
    </form>
  );
}
