import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const host = process.env.HOST || "127.0.0.1";
const preferredPort = Number.parseInt(process.env.PORT || "4173", 10);
const explicitPort = Boolean(process.env.PORT);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".wasm", "application/wasm"],
  [".ttf", "font/ttf"],
  [".eot", "application/vnd.ms-fontobject"],
  [".bin", "application/octet-stream"],
  [".gb", "application/octet-stream"],
  [".gbc", "application/octet-stream"],
  [".gba", "application/octet-stream"]
]);

function send(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  response.end(body);
}

function resolveRequestPath(url) {
  const requestPath = decodeURIComponent(new URL(url, `http://${host}:${preferredPort}`).pathname);
  const normalizedPath = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = resolve(join(root, normalizedPath));
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) return null;
  if (!existsSync(absolutePath)) return absolutePath;
  return statSync(absolutePath).isDirectory() ? join(absolutePath, "index.html") : absolutePath;
}

function createStaticServer() {
  return createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method || "")) {
      send(response, 405, "Method not allowed", { Allow: "GET, HEAD" });
      return;
    }

    const filePath = resolveRequestPath(request.url || "/");
    if (!filePath) {
      send(response, 403, "Forbidden");
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      send(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types.get(extname(filePath).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Resource-Policy": "same-origin"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

function listen(port, attempts = 0) {
  const server = createStaticServer();
  server.once("error", error => {
    if (error.code === "EADDRINUSE" && !explicitPort && attempts < 20) {
      server.close();
      listen(port + 1, attempts + 1);
      return;
    }
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`PUSH static server running at http://${host}:${port}/`);
  });
}

listen(preferredPort);
