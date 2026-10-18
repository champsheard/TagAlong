const http = require("node:http");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const metroPort = Number(process.env.METRO_PORT || 8081);
const apiPort = Number(process.env.API_PORT || 3001);
const demoPage = path.join(__dirname, "..", "app-demo.html");
// Keep the Expo CLI/Metro app inside one web workflow, with a dependable
// same-origin API proxy ahead of Expo's SPA history fallback.
const expo = spawn(process.execPath, [
  require.resolve("expo/bin/cli"), "start", "--web", "--port", String(metroPort), "--host", "lan",
], { stdio: "inherit", env: { ...process.env, BROWSER: "none", EXPO_UNSTABLE_HEADLESS: "1", EXPO_NO_TELEMETRY: "1" } });
const server = http.createServer((req, res) => {
  if (new URL(req.url || "/", "http://localhost").pathname === "/app-demo.html") {
    fs.readFile(demoPage, (error, content) => {
      if (error) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("The Tagalong demo page could not be loaded.");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(content);
    });
    return;
  }
  const api = req.url === "/api" || req.url.startsWith("/api/");
  const upstream = http.request({
    hostname: "127.0.0.1", port: api ? apiPort : metroPort, method: req.method, path: req.url,
    headers: { ...req.headers, "x-forwarded-for": req.headers["x-forwarded-for"] || req.socket.remoteAddress || "" },
  }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: api ? "The Tagalong API is unavailable. Please retry shortly." : "Expo is starting. Please reload in a moment." }));
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
// Relay Metro's hot-reload/debugger websocket upgrades without an extra package.
server.on("upgrade", (req, socket, head) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: metroPort, path: req.url, headers: req.headers });
  upstream.on("upgrade", (res, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(res.headers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\r\n");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);
    if (head.length) upstreamSocket.write(head);
    if (upstreamHead.length) socket.write(upstreamHead);
    socket.pipe(upstreamSocket).pipe(socket);
    socket.on("error", () => upstreamSocket.destroy());
    upstreamSocket.on("error", () => socket.destroy());
    socket.on("close", () => upstreamSocket.destroy());
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});
server.listen(5000, "0.0.0.0", () => console.log("Tagalong web/API proxy listening on 0.0.0.0:5000"));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { expo.kill(signal); server.close(); });
expo.on("error", () => process.exit(1));
expo.on("exit", code => { server.close(); process.exit(code ?? 0); });
