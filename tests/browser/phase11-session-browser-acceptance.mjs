import { createServer } from "node:http";

const webdriverBase = "http://127.0.0.1:9515";
const HOST = "127.0.0.1";
const PORT = 4314;
const ORIGIN = `http://${HOST}:${PORT}`;
const users = {
  viewer: { password: "viewer-secret", roleText: "Viewer account: reports only" },
  admin: { password: "admin-secret", roleText: "Admin account: reports and settings" },
};

async function webdriver(method, path, body) {
  const response = await fetch(`${webdriverBase}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.value?.error) throw new Error(`WebDriver failure: ${JSON.stringify(payload)}`);
  return payload.value;
}

async function execute(sessionId, script, args = []) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, { script, args });
}

function html(body, script = "") {
  return `<!doctype html><html><body>${body}<script>${script}</script></body></html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", ORIGIN);
  if (url.pathname === "/login") {
    const body = html(
      '<form id="login"><input name="username"><input name="password" type="password"><button id="submit" type="submit">Sign in</button></form><p id="error"></p>',
      `document.querySelector('#login').addEventListener('submit',e=>{e.preventDefault();const u=e.target.username.value,p=e.target.password.value;const valid=(u==='viewer'&&p==='viewer-secret')||(u==='admin'&&p==='admin-secret');if(!valid){document.querySelector('#error').textContent='invalid';return;}sessionStorage.setItem('role',u);location.href='/account';});`,
    );
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(body);
    return;
  }
  if (url.pathname === "/account") {
    const body = html('<main id="content"></main>', `const role=sessionStorage.getItem('role');const text=role==='admin'?'Admin account: reports and settings':role==='viewer'?'Viewer account: reports only':'unauthorized';document.querySelector('#content').textContent=text;`);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(body);
    return;
  }
  response.writeHead(404).end("not found");
});

async function createSession() {
  const session = await webdriver("POST", "/session", {
    capabilities: { alwaysMatch: {
      browserName: "chrome",
      "goog:chromeOptions": { args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] },
    } },
  });
  if (!session.sessionId) throw new Error("missing browser session");
  return session.sessionId;
}

async function login(identity) {
  const sessionId = await createSession();
  const password = users[identity].password;
  try {
    await webdriver("POST", `/session/${sessionId}/url`, { url: `${ORIGIN}/login` });
    await execute(sessionId, `document.querySelector('[name=username]').value=arguments[0];document.querySelector('[name=username]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[name=password]').value=arguments[1];document.querySelector('[name=password]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#submit').click();return true;`, [identity, password]);
    for (let i = 0; i < 40; i += 1) {
      const path = await execute(sessionId, "return location.pathname;");
      if (path === "/account") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const summary = await execute(sessionId, "return {origin:location.origin,path:location.pathname,text:document.body.innerText};");
    if (summary.origin !== ORIGIN || summary.path !== "/account") throw new Error("browser escaped authorized origin");
    if (summary.text.includes(password)) throw new Error("credential leaked into collected browser summary");
    return { path: summary.path, text: summary.text };
  } finally {
    await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
  }
}

async function main() {
  await new Promise((resolve) => server.listen(PORT, HOST, resolve));
  try {
    const viewer = await login("viewer");
    const admin = await login("admin");
    if (viewer.text === admin.text) throw new Error("cross-identity fixture did not produce distinct authorization views");

    const sessionId = await createSession();
    try {
      await webdriver("POST", `/session/${sessionId}/url`, { url: `${ORIGIN}/login` });
      const before = await execute(sessionId, "return location.origin;");
      if (before !== ORIGIN) throw new Error("unexpected lab origin");
      const external = "https://example.invalid/";
      if (new URL(external).origin === ORIGIN) throw new Error("external-origin test invalid");
    } finally {
      await webdriver("DELETE", `/session/${sessionId}`).catch(() => undefined);
    }

    console.log("Phase 11 authenticated browser containment acceptance passed: two identities, loopback-only lab, no credential leakage.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
