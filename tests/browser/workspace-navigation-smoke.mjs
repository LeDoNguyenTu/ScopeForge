import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const appBase = process.env.SCOPEFORGE_BROWSER_BASE_URL || "http://127.0.0.1:3000";
const webdriverBase = "http://127.0.0.1:9515";
const screenshotDir = process.env.SCOPEFORGE_BROWSER_SCREENSHOT_DIR || ".artifacts/ui-acceptance";
async function command(method, path, body) {
  const response = await fetch(`${webdriverBase}${path}`, {
    method, headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(response.ok && !result.value?.error, `WebDriver command failed: ${path}`);
  return result.value;
}
const session = await command("POST", "/session", { capabilities: { alwaysMatch: {
  browserName: "chrome", "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] },
} } });
const id = session.sessionId;
try {
  for (const width of [390, 768, 1440]) {
    await command("POST", `/session/${id}/window/rect`, { width, height: 1100 });
    for (const [route, destination] of [["security-runs", "/dashboard/security-runs"], ["workspace", "/dashboard/workspace"]]) {
      await command("POST", `/session/${id}/url`, { url: `${appBase}/preview/${route}` });
      let geometry;
      for (let attempt = 0; attempt < 50; attempt++) {
        geometry = await command("POST", `/session/${id}/execute/sync`, { args: [], script: `
          const rail=document.querySelector('.immersiveDashboardLinks');
          const track=rail?.querySelector('.sideNav');
          const active=track?.querySelector('[aria-current="page"]');
          if(!rail||!track||!active) return null;
          const rr=rail.getBoundingClientRect(), ar=active.getBoundingClientRect();
          const desired=rail.scrollLeft+(ar.left-rr.left)-(rail.clientWidth-ar.width)/2;
          const expected=Math.min(rail.scrollWidth-rail.clientWidth,Math.max(0,desired));
          return { href:active.getAttribute('href'), owner:getComputedStyle(rail).overflowX,
            trackOverflow:getComputedStyle(track).overflowX,
            contained:ar.left>=rr.left-1&&ar.right<=rr.right+1,
            centered:Math.abs(rail.scrollLeft-expected)<=2,
            pageOverflow:document.documentElement.scrollWidth>innerWidth+1 };
        ` });
        if (geometry?.contained && geometry?.centered) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(geometry, `${route}/${width}: active navigation did not render`);
      assert.equal(geometry.href, destination);
      assert.equal(geometry.owner, "auto");
      assert.equal(geometry.trackOverflow, "visible");
      assert.ok(geometry.contained && geometry.centered && !geometry.pageOverflow,
        `${route}/${width}: ${JSON.stringify(geometry)}`);
      mkdirSync(screenshotDir, { recursive: true });
      const png = await command("GET", `/session/${id}/screenshot`);
      writeFileSync(`${screenshotDir}/workspace-rail-${route}-${width}.png`, Buffer.from(png, "base64"));
    }
  }
  console.log("Workspace rail has one scroll owner and correctly positioned active destinations at mobile, tablet and desktop widths.");
} finally {
  await command("DELETE", `/session/${id}`);
}
