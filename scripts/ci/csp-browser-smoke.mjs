const webdriverBase = "http://127.0.0.1:9515";
const appBase = process.env.SCOPEFORGE_BROWSER_BASE_URL || "http://127.0.0.1:3000";

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

async function waitFor(sessionId, label, script, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script,
      args: [],
    });
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

async function browserLogs(sessionId) {
  try {
    return await webdriver("POST", `/session/${sessionId}/log`, { type: "browser" });
  } catch (error) {
    throw new Error(`Browser log collection is required for CSP acceptance: ${error.message}`);
  }
}

function assertCleanLogs(logs, route) {
  const severe = logs.filter((entry) => entry.level === "SEVERE");
  const csp = logs.filter((entry) => /content security policy|refused to (?:load|execute|apply|connect|frame)|violates the following content security policy directive/i.test(entry.message));
  const hydration = logs.filter((entry) => /hydration failed|hydration error|minified react error|uncaught/i.test(entry.message));
  const failures = [...new Map([...severe, ...csp, ...hydration].map((entry) => [entry.message, entry])).values()];
  if (failures.length) {
    throw new Error(`Browser console failures on ${route}:\n${failures.map((entry) => `[${entry.level}] ${entry.message}`).join("\n")}`);
  }
}

async function drainAndAssertLogs(sessionId, route) {
  const logs = await browserLogs(sessionId);
  assertCleanLogs(logs, route);
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
    await drainAndAssertLogs(sessionId, "/");

    await webdriver("POST", `/session/${sessionId}/execute/sync`, {
      script: "document.querySelector('a[href=\"/resources\"]')?.click(); return true;",
      args: [],
    });
    await waitFor(sessionId, "client navigation to resources", "return location.pathname === '/resources';");
    await drainAndAssertLogs(sessionId, "/resources");

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

    console.log("CSP browser acceptance passed: hydration, navigation, auth, 404, dashboard boundary, nonce execution, console, and V5 WebGL are healthy.");
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
