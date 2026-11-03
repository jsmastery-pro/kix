// Static server for the 3D model viewer (plan 10). Serves only scripts/models/ and models/ from
// the project root, on localhost. Dev tooling; not part of the Astro build.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary" };
const ALLOWED = ["scripts/models/", "models/"];

export function serve(root, port) {
  createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://localhost").pathname)).replace(/^[/\\]+/, "");
    const file = join(root, path);
    const allowed = ALLOWED.some((dir) => path.split(sep).join("/").startsWith(dir)) && file.startsWith(root + sep);
    if (!allowed || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(file).pipe(res);
  }).listen(port, "127.0.0.1", () => console.log(`viewer: http://localhost:${port}/scripts/models/viewer.html?slug=<product-slug>`));
}
