import { mkdirSync, writeFileSync } from "node:fs";

const webdriverBase = "http://127.0.0.1:9515";
const appBase = process.env.SCOPEFORGE_PRODUCTION_BASE_URL || "https://scopeforge.dev";
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

async function waitFor(sessionId, label, script, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await execute(sessionId, script);
    if (lastValue) return lastValue;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
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
  return webdriver("POST", `/session/${sessionId}/log`, { type: "browser" });
}

function assertNoCspOrHydrationFailures(logs, route) {
  const failures = logs.filter((entry) => (
    /content security policy|refused to (?:load|execute|apply|connect|frame)|violates the following content security policy directive|hydration failed|hydration error|minified react error/i.test(entry.message)
  ));
  if (failures.length) {
    throw new Error(`Production browser CSP/hydration failures on ${route}:\n${failures.map((entry) => `[${entry.level}] ${entry.message}`).join("\n")}`);
  }
}

function assertLandingMetrics(metrics) {
  if (!metrics) throw new Error("Production V5 landing metrics were unavailable");
  if (!metrics.desktopVisible) throw new Error("Production custom domain is not showing the V5 desktop composition");
  if (metrics.heroFontSize < 60) throw new Error(`Production V5 headline is below approved scale: ${metrics.heroFontSize}px`);
  if (metrics.metricFontSize < 31) throw new Error(`Production V5 metrics are below approved scale: ${metrics.metricFontSize}px`);
  if (metrics.sceneHeight < 650) throw new Error(`Production V5 scene is below approved height: ${metrics.sceneHeight}px`);
  if (!metrics.posterLoaded) throw new Error("Production V5 poster asset did not load");
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
    await waitFor(sessionId, "production V5 desktop composition", "return Boolean(document.querySelector('[data-testid=\"command-center-v5-desktop\"]')); ");
    await waitFor(sessionId, "production landing boot completion", "return document.querySelector('.scopeForgeLandingBootHost')?.dataset.bootState === 'ready';", 15000);
    await waitFor(sessionId, "production V5 poster", "const img = document.querySelector('.ccV5Desktop .ccV5PosterImage'); return img?.complete && img.naturalWidth > 0;");

    const landingMetrics = await execute(sessionId, `
      const hero = document.querySelector('.ccV5Desktop .ccV5Copy h1');
      const metric = document.querySelector('.ccV5Desktop .ccV5MetricCard > strong');
      const scene = document.querySelector('.ccV5DesktopScene');
      const desktop = document.querySelector('[data-testid="command-center-v5-desktop"]');
      const poster = document.querySelector('.ccV5Desktop .ccV5PosterImage');
      const activeScene = [...document.querySelectorAll('[data-testid="attack-surface-v5-scene"]')].find((node) => node.dataset.mediaActive === 'true');
      if (!hero || !metric || !scene || !desktop || !poster) return null;
      return {
        heroFontSize: parseFloat(getComputedStyle(hero).fontSize),
        metricFontSize: parseFloat(getComputedStyle(metric).fontSize),
        sceneHeight: scene.getBoundingClientRect().height,
        desktopVisible: getComputedStyle(desktop).display !== 'none' && desktop.getBoundingClientRect().width > 900,
        posterLoaded: poster.complete && poster.naturalWidth > 0,
        rendererState: activeScene?.dataset.rendererState || 'inactive',
        publicHeader: Boolean(document.querySelector('.commandPublicHeader')),
      };
    `);
    assertLandingMetrics(landingMetrics);
    console.log(`Production V5 metrics: ${JSON.stringify(landingMetrics)}`);
    assertNoCspOrHydrationFailures(await browserLogs(sessionId), "/");
    await captureScreenshot(sessionId, "production-landing-v5.png");

    await navigate(sessionId, "/auth/sign-in");
    await waitFor(sessionId, "production auth form", "return Boolean(document.querySelector('.authCard') && document.querySelector('button[type=\"submit\"]')); ");
    await waitFor(sessionId, "production Turnstile container", "return Boolean(document.querySelector('[data-turnstile-container]')); ");
    await sleep(2500);

    const authMetrics = await execute(sessionId, `
      const card = document.querySelector('.authCard');
      const container = document.querySelector('[data-turnstile-container]');
      const panel = document.querySelector('.authSecurityPanel');
      const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
      const script = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
      return {
        cardWidth: card?.getBoundingClientRect().width || 0,
        containerWidth: container?.getBoundingClientRect().width || 0,
        containerVisible: Boolean(container && getComputedStyle(container).display !== 'none' && container.getBoundingClientRect().height >= 0),
        panelVisible: Boolean(panel && getComputedStyle(panel).display !== 'none'),
        panelState: panel?.dataset.verificationState || null,
        turnstileIframe: Boolean(iframe),
        turnstileScript: Boolean(script),
      };
    `);
    if (!authMetrics?.containerVisible) throw new Error("Production Turnstile container is not visible");
    if (!authMetrics.turnstileScript) throw new Error("Production Turnstile script was not loaded into the document");
    if (!authMetrics.turnstileIframe) {
      console.log("Production Turnstile iframe was not exposed to headless Chrome. This is informational because Cloudflare may suppress or alter managed challenges in automation contexts.");
    }
    console.log(`Production Turnstile metrics: ${JSON.stringify(authMetrics)}`);
    assertNoCspOrHydrationFailures(await browserLogs(sessionId), "/auth/sign-in");
    await captureScreenshot(sessionId, "production-sign-in-turnstile.png");

    console.log("Production UI diagnostic passed: scopeforge.dev renders approved-scale V5 markup and the configured Turnstile client integration.");
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
