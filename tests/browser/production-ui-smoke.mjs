import { mkdirSync, writeFileSync } from "node:fs";

const webdriverBase = "http://127.0.0.1:9515";
const appBase = process.env.SCOPEFORGE_PRODUCTION_BASE_URL || "https://scopeforge.dev";
const screenshotDir = process.env.SCOPEFORGE_BROWSER_SCREENSHOT_DIR || ".artifacts/ui-acceptance";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function webdriver(method, path, body) {
  const response = await fetch(`${webdriverBase}${path}`, { method, headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.value?.error) throw new Error(`WebDriver ${method} ${path} failed: ${JSON.stringify(payload)}`);
  return payload.value;
}
async function execute(sessionId, script) { return webdriver("POST", `/session/${sessionId}/execute/sync`, { script, args: [] }); }
async function waitFor(sessionId, label, script, timeoutMs = 20000) { const deadline = Date.now() + timeoutMs; let value; while (Date.now() < deadline) { value = await execute(sessionId, script); if (value) return value; await sleep(250); } throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(value)}`); }
async function navigate(sessionId, path) { await webdriver("POST", `/session/${sessionId}/url`, { url: `${appBase}${path}` }); await waitFor(sessionId, `document readiness for ${path}`, "return document.readyState === 'complete';"); }
async function captureScreenshot(sessionId, filename) { mkdirSync(screenshotDir, { recursive: true }); const png = await webdriver("GET", `/session/${sessionId}/screenshot`); writeFileSync(`${screenshotDir}/${filename}`, Buffer.from(png, "base64")); }
async function browserLogs(sessionId) { return webdriver("POST", `/session/${sessionId}/log`, { type: "browser" }); }
function assertNoCspOrHydrationFailures(logs, route) { const failures = logs.filter((entry) => /content security policy|refused to (?:load|execute|apply|connect|frame)|violates the following content security policy directive|hydration failed|hydration error|minified react error/i.test(entry.message)); if (failures.length) throw new Error(`Production browser CSP/hydration failures on ${route}:\n${failures.map((entry) => `[${entry.level}] ${entry.message}`).join("\n")}`); }

async function main() {
  const session = await webdriver("POST", "/session", { capabilities: { alwaysMatch: { browserName: "chrome", acceptInsecureCerts: false, "goog:loggingPrefs": { browser: "ALL" }, "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1200", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } } } });
  const sessionId = session.sessionId;
  if (!sessionId) throw new Error("ChromeDriver did not return a session id");
  try {
    await navigate(sessionId, "/");
    await waitFor(sessionId, "production pre-PR49 landing", "return Boolean(document.querySelector('.commandHero') && document.querySelector('.cinematicSurface') && document.querySelector('.sampleScenarioPanel')); ");
    const landing = await execute(sessionId, `const hero=document.querySelector('.commandHero');const title=document.querySelector('.commandHeroCopy h1');const scene=document.querySelector('.commandHeroScene');const metric=document.querySelector('.commandMetricCard strong');const overview=document.querySelector('.commandOverviewPanel');if(!hero||!title||!scene||!metric||!overview)return null;const r=scene.getBoundingClientRect();return {heroWidth:hero.getBoundingClientRect().width,titleSize:parseFloat(getComputedStyle(title).fontSize),sceneWidth:r.width,sceneHeight:r.height,metricSize:parseFloat(getComputedStyle(metric).fontSize),cinematic:Boolean(document.querySelector('.cinematicSurface')),sample:Boolean(document.querySelector('.sampleScenarioPanel')),v5Surface:Boolean(document.querySelector('[data-testid="command-center-surface"]')),bootGate:Boolean(document.querySelector('.scopeForgeLandingBootHost'))};`);
    if (!landing || landing.heroWidth < 900 || landing.titleSize < 48 || landing.sceneWidth < 650 || landing.sceneHeight < 450 || landing.metricSize < 18 || !landing.cinematic || !landing.sample || landing.v5Surface || landing.bootGate) throw new Error(`Production is not serving the pre-PR49 landing: ${JSON.stringify(landing)}`);
    console.log(`Production pre-PR49 landing metrics: ${JSON.stringify(landing)}`);
    assertNoCspOrHydrationFailures(await browserLogs(sessionId), "/");
    await captureScreenshot(sessionId, "production-landing-pre-pr49.png");

    await navigate(sessionId, "/auth/sign-in");
    await waitFor(sessionId, "production auth form", "return Boolean(document.querySelector('.authCard') && document.querySelector('button[type=\"submit\"]')); ");
    await waitFor(sessionId, "production Turnstile container", "return Boolean(document.querySelector('[data-turnstile-container]')); ");
    await sleep(2500);
    const auth = await execute(sessionId, `const panel=document.querySelector('.authSecurityPanel');const container=document.querySelector('[data-turnstile-container]');const script=document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');return {panelVisible:Boolean(panel&&getComputedStyle(panel).display!=='none'),containerVisible:Boolean(container&&getComputedStyle(container).display!=='none'),panelState:panel?.dataset.verificationState||null,turnstileScript:Boolean(script)};`);
    if (!auth?.panelVisible || !auth.containerVisible || !auth.turnstileScript) throw new Error(`Production Turnstile integration regressed: ${JSON.stringify(auth)}`);
    console.log(`Production Turnstile metrics: ${JSON.stringify(auth)}`);
    assertNoCspOrHydrationFailures(await browserLogs(sessionId), "/auth/sign-in");
    await captureScreenshot(sessionId, "production-sign-in-turnstile.png");
    console.log("Production UI diagnostic passed: scopeforge.dev serves the pre-PR49 landing while the existing Turnstile integration remains active.");
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
