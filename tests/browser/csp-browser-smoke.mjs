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
  if (!response.ok || payload?.value?.error) throw new Error(`WebDriver ${method} ${path} failed: ${JSON.stringify(payload)}`);
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

async function navigate(sessionId, path) {
  await webdriver("POST", `/session/${sessionId}/url`, { url: `${appBase}${path}` });
  await waitFor(sessionId, `document readiness for ${path}`, "return document.readyState === 'complete';");
}

async function setWindowRect(sessionId, width, height) {
  await webdriver("POST", `/session/${sessionId}/window/rect`, { width, height });
  await sleep(120);
}

async function captureScreenshot(sessionId, filename) {
  mkdirSync(screenshotDir, { recursive: true });
  const pngBase64 = await webdriver("GET", `/session/${sessionId}/screenshot`);
  writeFileSync(`${screenshotDir}/${filename}`, Buffer.from(pngBase64, "base64"));
}

async function browserLogs(sessionId) {
  return webdriver("POST", `/session/${sessionId}/log`, { type: "browser" });
}

function assertCleanLogs(logs, route) {
  const failures = logs.filter((entry) => /content security policy|refused to (?:load|execute|apply|connect|frame)|violates the following content security policy directive|hydration failed|hydration error|minified react error|uncaught/i.test(entry.message));
  if (failures.length) throw new Error(`Browser console failures on ${route}:\n${failures.map((entry) => `[${entry.level}] ${entry.message}`).join("\n")}`);
}

async function assertAdminPreview(sessionId, view, width, height) {
  await setWindowRect(sessionId, width, height);
  const route = `/preview/admin?view=${view}`;
  await navigate(sessionId, route);
  await waitFor(sessionId, `admin ${view} preview`, "return Boolean(document.querySelector('.adminPreviewShell') && document.querySelector('.platformAdminMain')); ");

  const geometry = await execute(sessionId, `
    const root=document.documentElement;
    const body=document.body;
    const sidebar=document.querySelector('.platformAdminSidebar');
    const mobileNav=document.querySelector('.platformAdminMobileNav');
    const mobileCards=document.querySelector('.adminMobileCards');
    const desktopTable=document.querySelector('.adminDesktopTable');
    const githubActions=[...document.querySelectorAll('.githubRepositoryAction .primaryButton')];
    const visible=(element)=>Boolean(element&&getComputedStyle(element).display!=='none'&&element.getBoundingClientRect().width>0&&element.getBoundingClientRect().height>0);
    const clipped=[...document.querySelectorAll('button,a,input,textarea')].filter(visible).some((element)=>{const rect=element.getBoundingClientRect();return rect.left < -1 || rect.right > innerWidth + 1;});
    return {
      innerWidth,
      scrollWidth:Math.max(root.scrollWidth,body.scrollWidth),
      sidebarVisible:visible(sidebar),
      mobileNavVisible:visible(mobileNav),
      mobileCardsVisible:visible(mobileCards),
      desktopTableVisible:visible(desktopTable),
      githubActionCount:githubActions.filter(visible).length,
      clipped,
    };
  `);

  if (!geometry || geometry.scrollWidth > geometry.innerWidth + 1 || geometry.clipped) {
    throw new Error(`Admin ${view} overflows at ${width}px: ${JSON.stringify(geometry)}`);
  }

  if (width <= 760) {
    if (!geometry.mobileNavVisible || geometry.sidebarVisible) throw new Error(`Admin ${view} mobile navigation regressed at ${width}px: ${JSON.stringify(geometry)}`);
    if (["users", "workspaces", "audit"].includes(view) && (!geometry.mobileCardsVisible || geometry.desktopTableVisible)) throw new Error(`Admin ${view} mobile record composition regressed at ${width}px: ${JSON.stringify(geometry)}`);
    if (view === "github" && geometry.githubActionCount < 1) throw new Error(`GitHub mobile actions are not visible at ${width}px: ${JSON.stringify(geometry)}`);
  } else if (!geometry.sidebarVisible || geometry.mobileNavVisible) {
    throw new Error(`Admin ${view} desktop navigation regressed at ${width}px: ${JSON.stringify(geometry)}`);
  }

  assertCleanLogs(await browserLogs(sessionId), route);
  const prefix = width <= 760 ? "admin-mobile" : "admin-desktop";
  await captureScreenshot(sessionId, `${prefix}-${width}-${view}.png`);
}

async function main() {
  const session = await webdriver("POST", "/session", {
    capabilities: { alwaysMatch: {
      browserName: "chrome",
      acceptInsecureCerts: false,
      "goog:loggingPrefs": { browser: "ALL" },
      "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1200", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    } },
  });
  const sessionId = session.sessionId;
  if (!sessionId) throw new Error("ChromeDriver did not return a session id");

  try {
    await navigate(sessionId, "/");
    await waitFor(sessionId, "pre-PR49 landing", "return Boolean(document.querySelector('.commandHero') && document.querySelector('.cinematicSurface') && document.querySelector('.sampleScenarioPanel')); ");
    await waitFor(sessionId, "request nonce", "const script=document.querySelector('script[nonce]'); return script?.nonce?.length >= 16 ? script.nonce : false;");
    const landing = await execute(sessionId, `
      const hero=document.querySelector('.commandHero');
      const title=document.querySelector('.commandHeroCopy h1');
      const scene=document.querySelector('.commandHeroScene');
      const cinematic=document.querySelector('.cinematicSurface');
      const metric=document.querySelector('.commandMetricCard strong');
      const overview=document.querySelector('.commandOverviewPanel');
      const sample=document.querySelector('.sampleScenarioPanel');
      if(!hero||!title||!scene||!cinematic||!metric||!overview||!sample)return null;
      const rect=scene.getBoundingClientRect();
      return {heroWidth:hero.getBoundingClientRect().width,titleSize:parseFloat(getComputedStyle(title).fontSize),sceneWidth:rect.width,sceneHeight:rect.height,metricSize:parseFloat(getComputedStyle(metric).fontSize),cinematic:true,overview:overview.getBoundingClientRect().height>100,sample:sample.getBoundingClientRect().height>40,v5Surface:Boolean(document.querySelector('[data-testid="command-center-surface"]')),bootGate:Boolean(document.querySelector('.scopeForgeLandingBootHost'))};
    `);
    if (!landing || landing.heroWidth < 900 || landing.titleSize < 48 || landing.sceneWidth < 650 || landing.sceneHeight < 450 || landing.metricSize < 18 || !landing.overview || !landing.sample) throw new Error(`Pre-PR49 landing geometry regressed: ${JSON.stringify(landing)}`);
    if (landing.v5Surface || landing.bootGate) throw new Error(`Post-PR49 landing path is still active: ${JSON.stringify(landing)}`);
    assertCleanLogs(await browserLogs(sessionId), "/");
    await captureScreenshot(sessionId, "landing-pre-pr49.png");

    await navigate(sessionId, "/preview/dashboard");
    await waitFor(sessionId, "pre-PR49 SaaS dashboard", "return Boolean(document.querySelector('.workspaceAppShell') && document.querySelector('.saasDashboard') && document.querySelector('.saasMapPanel')); ");
    const dashboard = await execute(sessionId, `return {workspaceShell:Boolean(document.querySelector('.workspaceAppShell')),immersiveShell:Boolean(document.querySelector('.immersiveAppShell')),saas:Boolean(document.querySelector('.saasDashboard')),living:Boolean(document.querySelector('.livingDashboard')),heading:[...document.querySelectorAll('h1')].some((el)=>el.textContent?.includes('Security overview')),metrics:document.querySelectorAll('.saasMetrics > a').length,workbench:Boolean(document.querySelector('[aria-label="Workspace work queue"]'))};`);
    if (!dashboard?.workspaceShell || dashboard.immersiveShell || !dashboard.saas || dashboard.living || !dashboard.heading || dashboard.metrics !== 4 || !dashboard.workbench) throw new Error(`Pre-PR49 dashboard composition regressed: ${JSON.stringify(dashboard)}`);
    await execute(sessionId, "document.querySelector('.saasMapPanel summary')?.click(); return true;");
    await waitFor(sessionId, "dashboard map WebGL", "return document.querySelector('[data-testid=\"webgl-attack-surface\"]')?.dataset.rendererState === 'webgl';", 15000);
    assertCleanLogs(await browserLogs(sessionId), "/preview/dashboard");
    await captureScreenshot(sessionId, "dashboard-pre-pr49.png");

    for (const view of ["overview", "users", "workspaces", "audit", "settings", "github"]) {
      await assertAdminPreview(sessionId, view, 390, 844);
    }
    for (const view of ["overview", "github"]) {
      await assertAdminPreview(sessionId, view, 430, 932);
    }
    for (const view of ["overview", "users", "github"]) {
      await assertAdminPreview(sessionId, view, 1440, 1100);
    }

    await setWindowRect(sessionId, 1440, 1200);
    for (const path of ["/auth/sign-in", "/auth/sign-up"]) {
      await navigate(sessionId, path);
      await waitFor(sessionId, `${path} form`, "return Boolean(document.querySelector('input[type=\"email\"]') && document.querySelector('input[type=\"password\"]') && document.querySelector('button[type=\"submit\"]')); ");
      assertCleanLogs(await browserLogs(sessionId), path);
    }

    await navigate(sessionId, "/__scopeforge_csp_browser_404__");
    await waitFor(sessionId, "application 404", "return Boolean(document.querySelector('.scopeForgeNotFound')); ");

    await navigate(sessionId, "/dashboard");
    await waitFor(sessionId, "dashboard auth boundary", "return location.pathname.startsWith('/auth/sign-in');", 15000);
    assertCleanLogs(await browserLogs(sessionId), "/dashboard");

    console.log("CSP and responsive UI browser acceptance passed: landing/dashboard composition, admin mobile/desktop layouts, auth, nonce CSP and dashboard boundary remain healthy.");
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
