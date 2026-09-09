import { mkdirSync, writeFileSync } from "node:fs";

const webdriverBase = "http://127.0.0.1:9515";
const appBase = process.env.SCOPEFORGE_BROWSER_BASE_URL || "http://127.0.0.1:3000";
const screenshotDir = process.env.SCOPEFORGE_BROWSER_SCREENSHOT_DIR || ".artifacts/ui-acceptance";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function webdriver(method, path, body) {
  const response = await fetch(`${webdriverBase}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.value?.error) {
    throw new Error(`WebDriver ${method} ${path} failed: ${JSON.stringify(payload)}`);
  }
  return payload.value;
}

async function execute(sessionId, script) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, { script, args: [] });
}

async function waitFor(sessionId, label, script, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await execute(sessionId, script);
    if (lastValue) return lastValue;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
}

async function currentUrl(sessionId) {
  return webdriver("GET", `/session/${sessionId}/url`);
}

async function navigate(sessionId, path) {
  await webdriver("POST", `/session/${sessionId}/url`, { url: `${appBase}${path}` });
  await waitFor(sessionId, `document readiness for ${path}`, "return document.readyState === 'complete';");
}

async function captureScreenshot(sessionId, filename) {
  mkdirSync(screenshotDir, { recursive: true });
  const pngBase64 = await webdriver("GET", `/session/${sessionId}/screenshot`);
  if (typeof pngBase64 !== "string" || pngBase64.length < 100) {
    throw new Error(`ChromeDriver returned an invalid screenshot for ${filename}`);
  }
  writeFileSync(`${screenshotDir}/${filename}`, Buffer.from(pngBase64, "base64"));
}

async function browserLogs(sessionId) {
  try {
    return await webdriver("POST", `/session/${sessionId}/log`, { type: "browser" });
  } catch (error) {
    throw new Error(`Browser log collection is required for CSP acceptance: ${error.message}`);
  }
}

function isExpectedNotFoundDocumentLog(entry, route) {
  return route === "404"
    && entry.level === "SEVERE"
    && /\/__scopeforge_csp_browser_404__\s+-\s+Failed to load resource: the server responded with a status of 404 \(Not Found\)/i.test(entry.message);
}

function assertCleanLogs(logs, route) {
  const relevantLogs = logs.filter((entry) => !isExpectedNotFoundDocumentLog(entry, route));
  const severe = relevantLogs.filter((entry) => entry.level === "SEVERE");
  const csp = relevantLogs.filter((entry) => /content security policy|refused to (?:load|execute|apply|connect|frame)|violates the following content security policy directive/i.test(entry.message));
  const hydration = relevantLogs.filter((entry) => /hydration failed|hydration error|minified react error|uncaught/i.test(entry.message));
  const failures = [...new Map([...severe, ...csp, ...hydration].map((entry) => [entry.message, entry])).values()];
  if (failures.length) {
    throw new Error(`Browser console failures on ${route}:\n${failures.map((entry) => `[${entry.level}] ${entry.message}`).join("\n")}`);
  }
}

async function drainAndAssertLogs(sessionId, route) {
  assertCleanLogs(await browserLogs(sessionId), route);
}

function assertLandingVisualScale(metrics) {
  if (!metrics) throw new Error("Approved command-center landing metrics were unavailable");
  if (metrics.heroFontSize < 48) throw new Error(`Approved landing headline regressed below expected scale: ${metrics.heroFontSize}px`);
  if (metrics.metricFontSize < 18) throw new Error(`Approved landing metric values regressed below expected scale: ${metrics.metricFontSize}px`);
  if (metrics.sceneHeight < 500) throw new Error(`Approved landing attack surface regressed below expected height: ${metrics.sceneHeight}px`);
  if (metrics.sceneWidth < 720) throw new Error(`Approved landing attack surface regressed below expected width: ${metrics.sceneWidth}px`);
  if (!metrics.heroVisible) throw new Error("Approved command-center landing composition is not visible");
  if (!metrics.overviewVisible || !metrics.runtimeVisible) throw new Error("Approved command-center lower HUD is missing");
}

function assertDashboardVisualScale(metrics) {
  if (!metrics) throw new Error("Approved dashboard visual metrics were unavailable");
  if (!metrics.immersiveShell) throw new Error("Dashboard is not using the immersive AppShell variant");
  if (metrics.workspaceShell) throw new Error("Dashboard unexpectedly rendered the workspace sidebar shell");
  if (metrics.saasDashboard) throw new Error("Dashboard unexpectedly rendered the superseding SaaS composition");
  if (metrics.heroDisplay !== "block") throw new Error(`Dashboard hero was superseded by ${metrics.heroDisplay} layout`);
  if (metrics.scenePosition !== "absolute") throw new Error(`Dashboard scene is no longer the approved overlapping scene: ${metrics.scenePosition}`);
  if (metrics.lowerPosition !== "absolute") throw new Error(`Dashboard evidence rail is no longer anchored to the hero: ${metrics.lowerPosition}`);
  if (metrics.heroFontSize < 46) throw new Error(`Dashboard headline regressed below approved scale: ${metrics.heroFontSize}px`);
  if (metrics.sceneHeight < 600 || metrics.sceneWidth < 760) throw new Error(`Dashboard topology scene is too small: ${metrics.sceneWidth}x${metrics.sceneHeight}px`);
  if (metrics.topologyWidth < 720 || metrics.topologyHeight < 560) throw new Error(`Live dashboard topology is not occupying the approved scene: ${metrics.topologyWidth}x${metrics.topologyHeight}px`);
  if (metrics.lowerWidth < 600 || metrics.overviewWidth < 270) throw new Error("Dashboard evidence rail was compressed");
}

async function main() {
  const session = await webdriver("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        acceptInsecureCerts: false,
        "goog:loggingPrefs": { browser: "ALL" },
        "goog:chromeOptions": {
          args: [
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1440,1200",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  });

  const sessionId = session.sessionId;
  if (!sessionId) throw new Error("ChromeDriver did not return a session id");

  try {
    await navigate(sessionId, "/");
    await waitFor(sessionId, "approved command-center landing", "return Boolean(document.querySelector('.commandHero') && document.querySelector('[data-testid=\"command-center-surface\"]')); ");
    await waitFor(sessionId, "landing hydration", "return document.querySelector('.scopeForgeLandingBootHost')?.dataset.bootState === 'ready';", 12000);
    await waitFor(sessionId, "approved public WebGL renderer", "return document.querySelector('[data-testid=\"command-center-surface\"]')?.dataset.rendererState === 'webgl';", 15000);
    await waitFor(sessionId, "request nonce on framework script", "const script = document.querySelector('script[nonce]'); return script?.nonce?.length >= 16 ? script.nonce : false;");

    const landingMetrics = await execute(sessionId, `
      const heroRegion = document.querySelector('.commandHero');
      const hero = document.querySelector('.commandHeroCopy h1');
      const metric = document.querySelector('.commandMetricCard strong');
      const scene = document.querySelector('.commandHeroScene');
      const overview = document.querySelector('.commandOverviewPanel');
      const runtime = document.querySelector('.commandRuntimeBar');
      if (!heroRegion || !hero || !metric || !scene || !overview || !runtime) return null;
      const sceneRect = scene.getBoundingClientRect();
      return {
        heroFontSize: parseFloat(getComputedStyle(hero).fontSize),
        metricFontSize: parseFloat(getComputedStyle(metric).fontSize),
        sceneHeight: sceneRect.height,
        sceneWidth: sceneRect.width,
        heroVisible: getComputedStyle(heroRegion).display !== 'none' && heroRegion.getBoundingClientRect().width > 900,
        overviewVisible: overview.getBoundingClientRect().height > 120,
        runtimeVisible: runtime.getBoundingClientRect().width > 300,
      };
    `);
    assertLandingVisualScale(landingMetrics);
    await drainAndAssertLogs(sessionId, "/");
    await captureScreenshot(sessionId, "landing-approved-command-center.png");

    await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script: "document.querySelector('a[href=\"/resources\"]')?.click(); return true;",
      args: [],
    });
    await waitFor(sessionId, "client navigation to resources", "return location.pathname === '/resources';");
    await drainAndAssertLogs(sessionId, "/resources");

    await navigate(sessionId, "/preview/dashboard");
    await waitFor(sessionId, "approved immersive dashboard", "return Boolean(document.querySelector('.livingDashboard') && document.querySelector('.livingDashboardHero') && document.querySelector('.livingDashboardScene')); ");
    await waitFor(sessionId, "approved dashboard WebGL topology", "return document.querySelector('[data-testid=\"webgl-attack-surface\"]')?.dataset.rendererState === 'webgl';", 15000);

    const dashboardMetrics = await execute(sessionId, `
      const heroRegion = document.querySelector('.livingDashboardHero');
      const hero = document.querySelector('.livingDashboardEditorial h1');
      const scene = document.querySelector('.livingDashboardScene');
      const lower = document.querySelector('.livingDashboardLower');
      const overview = document.querySelector('.livingOverviewPanel');
      const topology = document.querySelector('[data-testid="webgl-attack-surface"]');
      if (!heroRegion || !hero || !scene || !lower || !overview || !topology) return null;
      const sceneRect = scene.getBoundingClientRect();
      const topologyRect = topology.getBoundingClientRect();
      return {
        immersiveShell: Boolean(document.querySelector('.immersiveAppShell')),
        workspaceShell: Boolean(document.querySelector('.workspaceAppShell')),
        saasDashboard: Boolean(document.querySelector('.saasDashboard')),
        heroDisplay: getComputedStyle(heroRegion).display,
        scenePosition: getComputedStyle(scene).position,
        lowerPosition: getComputedStyle(lower).position,
        heroFontSize: parseFloat(getComputedStyle(hero).fontSize),
        sceneHeight: sceneRect.height,
        sceneWidth: sceneRect.width,
        topologyWidth: topologyRect.width,
        topologyHeight: topologyRect.height,
        lowerWidth: lower.getBoundingClientRect().width,
        overviewWidth: overview.getBoundingClientRect().width,
      };
    `);
    assertDashboardVisualScale(dashboardMetrics);
    await drainAndAssertLogs(sessionId, "/preview/dashboard");
    await captureScreenshot(sessionId, "dashboard-approved-command-center.png");

    await navigate(sessionId, "/auth/sign-in");
    await waitFor(sessionId, "sign-in form", "return Boolean(document.querySelector('input[type=\"email\"]') && document.querySelector('input[type=\"password\"]') && document.querySelector('button[type=\"submit\"]')); ");
    await drainAndAssertLogs(sessionId, "/auth/sign-in");

    await navigate(sessionId, "/auth/sign-up");
    await waitFor(sessionId, "sign-up form", "return Boolean(document.querySelector('input[type=\"email\"]') && document.querySelector('input[type=\"password\"]') && document.querySelector('button[type=\"submit\"]')); ");
    await drainAndAssertLogs(sessionId, "/auth/sign-up");

    await navigate(sessionId, "/__scopeforge_csp_browser_404__");
    await waitFor(sessionId, "application-owned 404", "return Boolean(document.querySelector('.scopeForgeNotFound') && document.querySelector('#scopeforge-not-found-title')); ");
    await drainAndAssertLogs(sessionId, "404");

    await navigate(sessionId, "/dashboard");
    await waitFor(sessionId, "unauthenticated dashboard boundary", "return location.pathname === '/auth/sign-in' || Boolean(document.querySelector('input[type=\"email\"]'));", 15000);
    const dashboardUrl = await currentUrl(sessionId);
    if (!new URL(dashboardUrl).pathname.startsWith("/auth/sign-in")) {
      throw new Error(`Unauthenticated dashboard did not resolve to the sign-in boundary: ${dashboardUrl}`);
    }
    await drainAndAssertLogs(sessionId, "/dashboard -> /auth/sign-in");

    console.log("CSP and approved Command Center browser acceptance passed: public composition, live WebGL before and after login, navigation, auth, 404, nonce execution, and console are healthy.");
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
