/** Fixed diagnostic program, executed in the provider image in the same networkless namespace. */
export function namespaceProbeProgram(hostname: string, port: number): string {
  return `
const net = require("node:net"), dns = require("node:dns"), fs = require("node:fs");
const hostname = ${JSON.stringify(hostname)}, port = ${port};
function denied(host, destinationPort) {
  return new Promise((resolve) => {
    const socket = net.connect({host, port: destinationPort});
    const timer = setTimeout(() => {socket.destroy(); resolve(true)}, 500);
    socket.once("connect", () => {clearTimeout(timer); socket.destroy(); resolve(false)});
    socket.once("error", () => {clearTimeout(timer); resolve(true)});
  });
}
function rejected(kind) {
  return new Promise((resolve) => {
    const socket = net.connect({host:"127.0.0.1",port:17777});
    let greeting = false, ok = true;
    const timer = setTimeout(() => {ok=false; socket.destroy()}, 1000);
    socket.once("connect", () => socket.write(Buffer.from([5,1,0])));
    socket.on("data", bytes => {
      if (!greeting) {
        if (bytes.length !== 2 || bytes[0] !== 5 || bytes[1] !== 0) {ok=false; return socket.destroy()}
        greeting=true;
        const host = Buffer.from(kind === "host" ? "rejected.invalid" : hostname);
        const header = kind === "ip" ? Buffer.from([5,1,0,1,127,0,0,1]) : Buffer.concat([Buffer.from([5,1,0,3,host.length]),host]);
        const destination = Buffer.alloc(2); destination.writeUInt16BE(kind === "port" ? (port === 65535 ? 65534 : port+1) : port);
        socket.write(Buffer.concat([header,destination]));
      } else if (bytes[1] === 0) {ok=false;socket.destroy()}
    });
    socket.once("error", () => {ok=false});
    socket.once("close", () => {clearTimeout(timer);resolve(ok && greeting)});
  });
}
(async () => {
  const dnsBlocked = await new Promise(resolve => dns.lookup(hostname, error => resolve(Boolean(error))));
  const results = {dnsBlocked, publicTcpBlocked: await denied("1.1.1.1",443),
    metadataBlocked: await denied("169.254.169.254",80),
    wrongHost: await rejected("host"), wrongPort: await rejected("port"), literalIp: await rejected("ip"),
    socketAbsent: !fs.existsSync("/run/scopeforge/egress.sock"),
    engineSocketsAbsent: !fs.existsSync("/run/podman/podman.sock") && !fs.existsSync("/var/run/docker.sock")};
  process.stdout.write(JSON.stringify(results));process.exit(Object.values(results).every(Boolean)?0:1);
})().catch(() => process.exit(1));
setTimeout(() => process.exit(1),5000).unref();
`;
}
