import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/phase12-provider-linux-containment.sh";

describe("Phase 12 provider Linux containment helper", () => {
  it("is target-free and requires immutable local images", async () => {
    const source = await readFile(SCRIPT, "utf8");
    expect(source).toContain("provider-image@sha256");
    expect(source).toContain("sidecar-image@sha256");
    expect(source).toContain("podman image inspect");
    expect(source).toContain("git -C");
    expect(source).toContain("status --porcelain");
    expect(source).not.toContain("curl ");
    expect(source).not.toContain("wget ");
    expect(source).not.toContain("SCOPEFORGE_SUPABASE");
  });

  it("keeps only the sidecar networkless socket authority and shares its namespace with the probe provider", async () => {
    const source = await readFile(SCRIPT, "utf8");
    for (const required of [
      "--network=none",
      "--network=\"container:$sidecar_name\"",
      "dst=/run/scopeforge/egress.sock,ro",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--read-only",
      "--pids-limit=8",
      "--pids-limit=32",
      "--memory=256m",
      "memory.swap.max=0",
      "--cpus=0.5",
      "nosuid,nodev,noexec",
    ]) {
      expect(source).toContain(required);
    }
  });

  it("proves direct DNS, public TCP and metadata access fail while the fixed loopback proxy is reachable", async () => {
    const source = await readFile(SCRIPT, "utf8");
    expect(source).toContain('dns.lookup("example.com"');
    expect(source).toContain('denied("1.1.1.1",443,"publicTcpBlocked")');
    expect(source).toContain('denied("169.254.169.254",80,"metadataBlocked")');
    expect(source).toContain('net.connect({host:"127.0.0.1",port:17777})');
    expect(source).toContain('!fs.existsSync("/run/scopeforge/egress.sock")');
    expect(source).toContain('!fs.existsSync("/run/podman/podman.sock")');
    expect(source).toContain('!fs.existsSync("/var/run/docker.sock")');
  });

  it("does not register workers, mutate queues or execute a provider scan", async () => {
    const source = await readFile(SCRIPT, "utf8");
    for (const forbidden of [
      "worker_nodes",
      "worker_tasks",
      "phase11_http_worker_tasks",
      "/opt/scopeforge/bin/httpx",
      "/opt/scopeforge/bin/nuclei",
      "metasploit",
      "msfconsole",
    ]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
  });
});
