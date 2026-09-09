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
  const logs = await browserLogs(sessionId);
  assertCleanLogs(logs, route);
}

function assertLandingVisualScale(metrics) {
  if (!metrics) throw new Error("Landing visual metrics were unavailable");
  if (metrics.heroFontSize < 60) throw new Error(`V5 landing hero regressed below approved scale: ${metrics.heroFontSize}px`);
  if (metrics.metricFontSize < 31) throw new Error(`V5 landing metric values regressed below approved scale: ${metrics.metricFontSize}px`);
  if (metrics.sceneHeight < 650) throw new Error(`V5 landing scene regressed below approved height: ${metrics.sceneHeight}px`);
  if (!metrics.desktopVisible) throw new Error("V5 desktop composition is not visible at the desktop acceptance viewport");
}

function assertDashboardVisualScale(metrics) {
  if (!metrics) throw new Error("Dashboard visual metrics were unavailable");
  if (!metrics.immersiveShell) throw new Error("Restored dashboard is not using the immersive AppShell variant");
  if (metrics.workspaceShell) throw new Error("Restored dashboard unexpectedly rendered the later workspace sidebar shell");
  if (metrics.saasDashboard) throw new Error("Restored dashboard unexpectedly rendered the superseding SaaS dashboard composition");
  if (metrics.heroDisplay !== "block") throw new Error(`Restored dashboard hero was superseded by ${metrics.heroDisplay} layout`);
  if (metrics.editorialDisplay !== "block") throw new Error(`Restored dashboard editorial was superseded by ${metrics.editorialDisplay} layout`);
  if (metrics.scenePosition !== "absolute") throw new Error(`Restored dashboard scene is no longer the approved overlapping scene: ${metrics.scenePosition}`);
  if (metrics.lowerPosition !== "absolute") throw new Error(`Restored dashboard evidence rail is no longer anchored to the hero: ${metrics.lowerPosition}`);
  if (metrics.heroFontSize < 46) throw new Error(`Restored dashboard headline regressed below approved scale: ${metrics.heroFontSize}px`);
  if (metrics.sceneHeight < 600) throw new Error(`Restored dashboard topology regressed below approved height: ${metrics.sceneHeight}px`);
  if (metrics.sceneWidth < 760) throw new Error(`Restored dashboard topology regressed below approved width: ${metrics.sceneWidth}px`);
  if (metrics.sceneTopOffset > 70) throw new Error(`Restored dashboard topology was pushed below the editorial composition: ${metrics.sceneTopOffset}px`);
  if (metrics.lowerLeftOffset > 36) throw new Error(`Restored dashboard evidence rail drifted away from the left anchor: ${metrics.lowerLeftOffset}px`);
  if (metrics.lowerWidth < 600) throw new Error(`Restored dashboard evidence rail was compressed: ${metrics.lowerWidth}px`);
  if (metrics.overviewWidth < 270) throw new Error(`Restored dashboard overview card was compressed: ${metrics.overviewWidth}px`);
  if (metrics.topologyWidth < 760 || metrics.topologyHeight < 600) {
    throw new Error(`Restored topology artwork is not occupying the approved scene: ${metrics.topologyWidth}x${metrics.topologyHeight}px`);
  }
  if (metrics.metricValueFontSize < 19) throw new Error(`Restored dashboard metric values regressed below approved scale: ${metrics.metricValueFontSize}px`);
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
    await waitFor(sessionId, "V5 desktop composition", "return Boolean(document.querySelector('[data-testid=\"command-center-v5-desktop\"]')); ");
    await waitFor(sessionId, "landing hydration", "return document.querySelector('.scopeForgeLandingBootHost')?.dataset.bootState === 'ready';", 12000);
    await waitFor(
      sessionId,
      "active V5 WebGL renderer",
      "const scene = [...document.querySelectorAll('[data-testid=\"attack-surface-v5-scene\"]')].find((node) => node.dataset.mediaActive === 'true'); return scene?.dataset.rendererState === 'webgl' ? scene.dataset.rendererState : false;",
      15000,
    );
    await waitFor(sessionId, "request nonce on framework script", "const script = document.querySelector('script[nonce]'); return script?.nonce?.length >= 16 ? script.nonce : false;");
    const landingMetrics = await execute(sessionId, `
      const hero = document.querySelector('.ccV5Desktop .ccV5Copy h1');
      const metric = document.querySelector('.ccV5Desktop .ccV5MetricCard > strong');
      const scene = document.querySelector('.ccV5DesktopScene');
      const desktop = document.querySelector('[data-testid="command-center-v5-desktop"]');
      if (!hero || !metric || !scene || !desktop) return null;
      return {
        heroFontSize: parseFloat(getComputedStyle(hero).fontSize),
        metricFontSize: parseFloat(getComputedStyle(metric).fontSize),
        sceneHeight: scene.getBoundingClientRect().height,
        desktopVisible: getComputedStyle(desktop).display !== 'none' && desktop.getBoundingClientRect().width > 900,
      };
    `);
    assertLandingVisualScale(landingMetrics);
    await drainAndAssertLogs(sessionId, "/");
    await captureScreenshot(sessionId, "landing-v5-desktop.png");

    await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script: "document.querySelector('a[href=\"/resources\"]')?.click(); return true;",
      args: [],
    });
    await waitFor(sessionId, "client navigation to resources", "return location.pathname === '/resources';");
    await drainAndAssertLogs(sessionId, "/resources");

    await navigate(sessionId, "/preview/dashboard");
    await waitFor(sessionId, "restored immersive dashboard", "return Boolean(document.querySelector('.livingDashboard') && document.querySelector('.livingDashboardHero') && document.querySelector('.livingDashboardScene')); ");
    await waitFor(sessionId, "CSP-safe restored topology", "return document.querySelector('[data-testid=\"webgl-attack-surface\"]')?.dataset.rendererState === 'svg';");
    const dashboardMetrics = await execute(sessionId, `
      const dashboard = document.querySelector('.livingDashboard');
      const heroRegion = document.querySelector('.livingDashboardHero');
      const editorial = document.querySelector('.livingDashboardEditorial');
      const hero = document.querySelector('.livingDashboardEditorial h1');
      const scene = document.querySelector('.livingDashboardScene');
      const lower = document.querySelector('.livingDashboardLower');
      const overview = document.querySelector('.livingOverviewPanel');
      const topology = document.querySelector('.workspaceTopologyArt');
      const metric = document.querySelector('.livingMetricCard strong');
      if (!dashboard || !heroRegion || !editorial || !hero || !scene || !lower || !overview || !topology || !metric) return null;
      const heroRect = heroRegion.getBoundingClientRect();
      const sceneRect = scene.getBoundingClientRect();
      const lowerRect = lower.getBoundingClientRect();
      const overviewRect = overview.getBoundingClientRect();
      const topologyRect = topology.getBoundingClientRect();
      return {
        immersiveShell: Boolean(document.querySelector('.immersiveAppShell')),
        workspaceShell: Boolean(document.querySelector('.workspaceAppShell')),
        saasDashboard: Boolean(document.querySelector('.saasDashboard')),
        heroDisplay: getComputedStyle(heroRegion).display,
        editorialDisplay: getComputedStyle(editorial).display,
        scenePosition: getComputedStyle(scene).position,
        lowerPosition: getComputedStyle(lower).position,
        heroFontSize: parseFloat(getComputedStyle(hero).fontSize),
        sceneHeight: sceneRect.height,
        sceneWidth: sceneRect.width,
        sceneTopOffset: sceneRect.top - heroRect.top,
        lowerLeftOffset: lowerRect.left - heroRect.left,
        lowerWidth: lowerRect.width,
        overviewWidth: overviewRect.width,
        topologyWidth: topologyRect.width,
        topologyHeight: topologyRect.height,
        metricValueFontSize: parseFloat(getComputedStyle(metric).fontSize),
      };
    `);
    assertDashboardVisualScale(dashboardMetrics);
    await drainAndAssertLogs(sessionId, "/preview/dashboard");
    await captureScreenshot(sessionId, "dashboard-v5-desktop.png");

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
    await waitFor(
      sessionId,
      "unauthenticated dashboard boundary",
      "return location.pathname === '/auth/sign-in' || Boolean(document.querySelector('input[type=\"email\"]'));",
      15000,
    );
    const dashboardUrl = await currentUrl(sessionId);
    if (!new URL(dashboardUrl).pathname.startsWith("/auth/sign-in")) {
      throw new Error(`Unauthenticated dashboard did not resolve to the sign-in boundary: ${dashboardUrl}`);
    }
    await drainAndAssertLogs(sessionId, "/dashboard -> /auth/sign-in");

    console.log("CSP and V5 restoration browser acceptance passed: public V5 scale, immersive dashboard composition, CSP-safe topology, navigation, auth, 404, nonce execution, console, and public WebGL are healthy.");
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
