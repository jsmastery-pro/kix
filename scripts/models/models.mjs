// Product 3D models (plan 10): shrink a Tripo export, upload it to Wix Media, save it in the
// ProductModels CMS collection with its parts map and one color preset per Wix color choice.
//
//   npm run models -- setup                  create the ProductModels collection (idempotent)
//   npm run models -- optimize <slug>        models/raw/<color>.glb → models/web/<slug>.glb (< 5 MB, parts kept)
//   npm run models -- publish <slug> [--dry-run]   validate models/specs/<slug>.json, upload, save the row
//   npm run models -- view                   viewer on http://localhost:4400/scripts/models/viewer.html?slug=<slug>
//
// Runs locally with Node 24.18+ (the Wix CLI mints the site token). Never runs on the server.
// docs: https://gltf-transform.dev/functions
// docs: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/get-product-by-slug.md
// docs: https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/upload-api.md
// docs: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/create-data-collection.md
// docs: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-save-data-items.md
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { center, cloneDocument, meshopt, simplifyPrimitive, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RAW_DIR = join(ROOT, "models/raw");
const WEB_DIR = join(ROOT, "models/web");
const SPEC_DIR = join(ROOT, "models/specs");
const COLLECTION = "ProductModels";
const ZONES = ["upper", "sole", "laces", "accent"];
const MAX_BYTES = 5_000_000;
const MIN_PART_TRIS = 3000;
// Each attempt rebuilds from the raw file. simplify() stops at its error limit before reaching the
// target ratio, so every attempt sets one (plan 10, review finding 1).
const LADDER = [
  { tris: 150_000, error: 0.001, texture: 1024 },
  { tris: 100_000, error: 0.005, texture: 1024 },
  { tris: 60_000, error: 0.02, texture: 1024 },
  { tris: 60_000, error: 0.02, texture: 512 },
];
// Neutral shading: blur radius = texture width / divisor; a flat area maps to SHADING_WHITE.
const SHADING_BLUR_DIVISOR = 48;
const SHADING_WHITE = 0.94;
const SHADING_MAX_GAIN = 4;
const SHADING_DENOISE = 0.8;
const HEX = /^#[0-9A-F]{6}$/;
const CORS_ORIGIN = "http://localhost:4321";

// ---- small helpers ----------------------------------------------------------------------------

const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const mb = (bytes) => (bytes / 1e6).toFixed(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (message) => {
  throw new Error(message);
};
const hexOf = (rgb) => "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
// Presets are sRGB hex; glTF baseColorFactor is linear.
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearFactor = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255)).concat(1);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---- Wix ---------------------------------------------------------------------------------------

let session;
function wix() {
  if (session) return session;
  const { siteId } = readJson(join(ROOT, "wix.config.json"));
  if (!siteId) fail("wix.config.json has no siteId");
  // The CLI can print update notices around the token, so take the first long token-like run.
  const out = execFileSync(join(ROOT, "node_modules/.bin/wix"), ["token", "--site", siteId], { encoding: "utf8", cwd: ROOT });
  const token = out.match(/[A-Za-z0-9._-]{40,}/)?.[0] ?? fail("The Wix CLI returned no token. Run `npx wix login` first.");
  return (session = { siteId, token });
}

/** fetch, retried on network failures (not on HTTP errors). */
async function fetchRetry(url, init, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (attempt >= attempts) throw new Error(`${init?.method ?? "GET"} ${url}: ${error.cause?.code ?? error.message} after ${attempts} tries`);
      await sleep(1500 * attempt);
    }
  }
}

async function api(method, path, body) {
  const { siteId, token } = wix();
  const res = await fetchRetry(`https://www.wixapis.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "wix-site-id": siteId, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function call(method, path, body) {
  const r = await api(method, path, body);
  if (!r.ok) fail(`${method} ${path} → ${r.status}: ${JSON.stringify(r.json).slice(0, 500)}`);
  return r.json;
}

/** The product and its visible color choices (the swatch option, as catalog-core.ts finds it). */
async function readProduct(slug) {
  const { product } = await call("GET", `/stores/v3/products/slug/${encodeURIComponent(slug)}?fields=MEDIA_ITEMS_INFO`);
  if (!product) fail(`No visible product with slug "${slug}"`);
  const option = (product.options ?? []).find((o) => o.optionRenderType === "SWATCH_CHOICES" || o.optionRenderType === "COLOR_CHOICES");
  if (!option) fail(`${slug} has no color option`);
  const choices = (option.choicesSettings?.choices ?? []).filter((c) => c.visible !== false).map((c) => ({ choiceId: c.choiceId, name: c.name, colorCode: c.colorCode }));
  return { id: product.id, name: product.name, slug: product.slug, choices };
}

/** The one raw GLB named after one of the product's colors. */
function findRaw(product) {
  const hits = product.choices.map((c) => `${kebab(c.name)}.glb`).filter((f) => existsSync(join(RAW_DIR, f)));
  if (hits.length !== 1) fail(`${product.slug}: expected one raw model named after a color (${product.choices.map((c) => kebab(c.name) + ".glb").join(", ")}) in models/raw, found ${hits.length}`);
  const raw = hits[0];
  return { raw, madeFrom: product.choices.find((c) => `${kebab(c.name)}.glb` === raw).name };
}

// ---- glTF --------------------------------------------------------------------------------------

async function makeIO() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

/** Mesh nodes in file order: one per part. */
const partNodes = (doc) => doc.getRoot().listNodes().filter((n) => n.getMesh());
const triangles = (mesh) => mesh.listPrimitives().reduce((sum, p) => sum + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0);

/** What makes a part a part: node name, its mesh, its material name. Must survive optimizing. */
function partSignature(doc) {
  const nodes = partNodes(doc);
  return {
    nodes: nodes.map((n) => n.getName()),
    meshes: doc.getRoot().listMeshes().length,
    materials: nodes.map((n) => n.getMesh().listPrimitives().map((p) => p.getMaterial()?.getName() ?? "").join("+")),
  };
}

/** Average sRGB color of each part's original base color texture, times its factor. */
async function partColors(doc) {
  const colors = {};
  for (const node of partNodes(doc)) {
    const material = node.getMesh().listPrimitives()[0].getMaterial();
    const texture = material?.getBaseColorTexture();
    const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
    let rgb = [255, 255, 255];
    if (texture) {
      const { channels } = await sharp(Buffer.from(texture.getImage())).stats();
      rgb = channels.slice(0, 3).map((c) => c.mean);
    }
    // factor is linear; an untouched Tripo factor is 1, so this only matters for edited files.
    colors[node.getName()] = hexOf(rgb.map((v, i) => v * Math.pow(factor[i], 1 / 2.2)));
  }
  return colors;
}

/**
 * Neutral shading (plan 10, user decision): each base color texture becomes gray detail, so the
 * material color does the tinting. Brightness is each pixel's max channel (HSV value), so a
 * saturated red reads nearly as bright as white and needs little lift. Each pixel is divided by a
 * blurred copy of itself: fine detail (creases, stitching, grain) stays, while large tone blocks (a
 * red collar baked into the same part as a white panel) flatten out instead of ghosting dark under
 * every preset. A light pre-blur and the gain cap keep JPEG noise from being amplified.
 */
async function neutralShading(doc) {
  const done = new Set();
  for (const material of doc.getRoot().listMaterials()) {
    const texture = material.getBaseColorTexture();
    if (!texture || done.has(texture)) continue;
    done.add(texture);
    const { data: rgb, info } = await sharp(Buffer.from(texture.getImage())).removeAlpha().blur(SHADING_DENOISE).raw().toBuffer({ resolveWithObject: true });
    const gray = { width: info.width, height: info.height, channels: 1 };
    const value = Buffer.alloc(info.width * info.height);
    for (let i = 0; i < value.length; i++) value[i] = Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    const blur = await sharp(value, { raw: gray }).blur(Math.max(2, info.width / SHADING_BLUR_DIVISOR)).raw().toBuffer();
    const out = Buffer.alloc(value.length);
    for (let i = 0; i < value.length; i++) {
      const ratio = value[i] / Math.max(blur[i], 255 / SHADING_MAX_GAIN);
      out[i] = Math.round(255 * Math.min(1, SHADING_WHITE * ratio));
    }
    texture.setImage(new Uint8Array(await sharp(out, { raw: gray }).png().toBuffer())).setMimeType("image/png");
  }
}

/** Turn the shoe around Y (spec.rotateY, degrees) at the scene's top node, then stand it centered on y = 0. */
async function orient(doc, rotateY) {
  const half = (rotateY * Math.PI) / 360;
  const q = [0, Math.sin(half), 0, Math.cos(half)];
  for (const node of doc.getRoot().getDefaultScene().listChildren()) {
    const [x, y, z, w] = node.getRotation();
    // q * existing
    node.setRotation([q[3] * x + q[0] * w + q[1] * z - q[2] * y, q[3] * y - q[0] * z + q[1] * w + q[2] * x, q[3] * z + q[0] * y - q[1] * x + q[2] * w, q[3] * w - q[0] * x - q[1] * y - q[2] * z]);
  }
  await doc.transform(center({ pivot: "below" }));
}

/** Share the triangle budget: each part keeps at least min(original, 3000), the rest by size. */
function partBudgets(counts, total) {
  const floor = counts.map((t) => Math.min(t, MIN_PART_TRIS));
  const spare = Math.max(0, total - floor.reduce((a, b) => a + b, 0));
  const above = counts.reduce((sum, t, i) => sum + (t - floor[i]), 0);
  return counts.map((t, i) => Math.min(t, Math.round(floor[i] + (above ? (spare * (t - floor[i])) / above : 0))));
}

async function shrink(io, raw, rotateY, step) {
  const doc = cloneDocument(raw);
  await doc.transform(weld());
  const nodes = partNodes(doc);
  const before = nodes.map((n) => triangles(n.getMesh()));
  const budgets = partBudgets(before, step.tris);
  nodes.forEach((node, i) => {
    const ratio = budgets[i] / before[i];
    if (ratio < 1) for (const prim of node.getMesh().listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: step.error });
  });
  const after = partNodes(doc).map((n) => triangles(n.getMesh()));
  await neutralShading(doc);
  await orient(doc, rotateY);
  await doc.transform(
    textureCompress({ encoder: sharp, slots: /^(baseColorTexture|metallicRoughnessTexture)$/, targetFormat: "webp", resize: [step.texture, step.texture] }),
    textureCompress({ encoder: sharp, slots: /^normalTexture$/, resize: [step.texture, step.texture] }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  doc.getRoot().getAsset().extras = { ...(doc.getRoot().getAsset().extras ?? {}), kix: { rotateY } };
  return { doc, bytes: await io.writeBinary(doc), before, budgets, after };
}

// ---- spec --------------------------------------------------------------------------------------

const specPath = (slug) => join(SPEC_DIR, `${slug}.json`);

/** Problems with a spec against the product and the optimized model's parts; [] when it's valid. */
function specProblems(spec, product, nodes) {
  const problems = [];
  if (spec.slug !== product.slug) problems.push(`slug is "${spec.slug}", expected "${product.slug}"`);
  if (!product.choices.some((c) => c.name === spec.madeFrom)) problems.push(`madeFrom "${spec.madeFrom}" isn't one of the product's colors`);
  if (typeof spec.rotateY !== "number") problems.push("rotateY must be a number of degrees");
  const named = (spec.parts ?? []).map((p) => p.node);
  for (const node of nodes) if (!named.includes(node)) problems.push(`part ${node} has no zone`);
  for (const part of spec.parts ?? []) {
    if (!nodes.includes(part.node)) problems.push(`part ${part.node} isn't in the model (it has ${nodes.join(", ")})`);
    if (!ZONES.includes(part.zone)) problems.push(`part ${part.node} has zone "${part.zone}"; zones are ${ZONES.join(", ")}`);
  }
  if (new Set(named).size !== named.length) problems.push("a part is listed twice");
  const zones = [...new Set((spec.parts ?? []).map((p) => p.zone))].sort();
  for (const choice of product.choices) {
    const preset = (spec.presets ?? []).find((p) => p.choiceId === choice.choiceId);
    if (!preset) {
      problems.push(`no preset for color "${choice.name}" (${choice.choiceId})`);
      continue;
    }
    if (preset.color !== choice.name) problems.push(`preset ${choice.choiceId} is named "${preset.color}", Wix calls it "${choice.name}"`);
    const keys = Object.keys(preset.zones ?? {}).sort();
    if (keys.join() !== zones.join()) problems.push(`preset "${choice.name}" has zones [${keys}], the model's parts use [${zones}]`);
    for (const [zone, hex] of Object.entries(preset.zones ?? {})) if (!HEX.test(hex)) problems.push(`preset "${choice.name}" ${zone} "${hex}" isn't a #RRGGBB hex`);
  }
  for (const preset of spec.presets ?? []) if (!product.choices.some((c) => c.choiceId === preset.choiceId)) problems.push(`preset "${preset.color}" (${preset.choiceId}) isn't a visible color choice`);
  return problems;
}

/** A first spec to edit: every part on the upper, the made color from texture averages. */
function starterSpec(product, raw, madeFrom, colors) {
  const average = hexOf(
    [0, 1, 2].map((i) => {
      const values = Object.values(colors).map((h) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16));
      return values.reduce((a, b) => a + b, 0) / values.length;
    }),
  );
  return {
    slug: product.slug,
    raw,
    madeFrom,
    rotateY: 0,
    parts: Object.keys(colors).map((node) => ({ node, zone: "upper", label: "" })),
    presets: product.choices.map((c) => ({ choiceId: c.choiceId, color: c.name, zones: { upper: c.name === madeFrom ? average : c.colorCode.toUpperCase() } })),
  };
}

// ---- commands ----------------------------------------------------------------------------------

async function optimize(slug) {
  const product = await readProduct(slug);
  const { raw, madeFrom } = findRaw(product);
  const spec = existsSync(specPath(slug)) ? readJson(specPath(slug)) : null;
  const rotateY = spec?.rotateY ?? 0;
  const io = await makeIO();
  console.log(`${product.name} (${product.slug}) ← models/raw/${raw}, made in ${madeFrom}, rotateY ${rotateY}°`);
  const source = await io.read(join(RAW_DIR, raw));
  const expected = partSignature(source);
  const colors = await partColors(source);

  let result;
  for (const step of LADDER) {
    result = await shrink(io, source, rotateY, step);
    console.log(`  ${step.tris / 1000}k triangles, error ${step.error}, ${step.texture}px textures → ${mb(result.bytes.byteLength)} MB`);
    if (result.bytes.byteLength < MAX_BYTES) break;
  }
  if (result.bytes.byteLength >= MAX_BYTES) fail(`${slug}: still ${mb(result.bytes.byteLength)} MB after every step; nothing written`);

  const got = partSignature(result.doc);
  for (const key of ["nodes", "meshes", "materials"]) {
    if (JSON.stringify(got[key]) !== JSON.stringify(expected[key])) fail(`${slug}: parts changed while optimizing (${key}: ${JSON.stringify(expected[key])} → ${JSON.stringify(got[key])}); nothing written`);
  }

  mkdirSync(WEB_DIR, { recursive: true });
  const out = join(WEB_DIR, `${slug}.glb`);
  writeFileSync(out, result.bytes);
  console.table(expected.nodes.map((node, i) => ({ part: node, material: expected.materials[i], triangles: result.before[i], budget: result.budgets[i], reached: result.after[i], madeColor: colors[node] })));
  console.log(`  wrote models/web/${slug}.glb: ${mb(result.bytes.byteLength)} MB, ${result.after.reduce((a, b) => a + b, 0)} triangles, ${got.nodes.length} parts`);
  console.log(`  extensions: ${result.doc.getRoot().listExtensionsUsed().map((e) => e.extensionName).join(", ")}`);

  if (!spec) {
    mkdirSync(SPEC_DIR, { recursive: true });
    writeFileSync(specPath(slug), JSON.stringify(starterSpec(product, raw, madeFrom, colors), null, 2) + "\n");
    console.log(`  wrote a starter models/specs/${slug}.json: map each part's zone and fill the presets before publishing`);
  }
}

async function setup() {
  const existing = await api("GET", `/wix-data/v2/collections/${COLLECTION}`);
  if (existing.ok) {
    console.log(`${COLLECTION} exists:`);
    return printCollection(existing.json.collection);
  }
  if (existing.status !== 404) fail(`GET collection ${COLLECTION} → ${existing.status}: ${JSON.stringify(existing.json).slice(0, 300)}`);
  const { collection } = await call("POST", "/wix-data/v2/collections", {
    collection: {
      id: COLLECTION,
      displayName: "Product Models",
      fields: [
        { key: "title", displayName: "Product", type: "TEXT" },
        { key: "productId", displayName: "Product ID", type: "TEXT" },
        { key: "modelUrl", displayName: "Model URL", type: "URL" },
        { key: "modelFileId", displayName: "Model file ID", type: "TEXT" },
        { key: "modelBytes", displayName: "Model size (bytes)", type: "NUMBER" },
        { key: "madeFrom", displayName: "Made in color", type: "TEXT" },
        { key: "parts", displayName: "Parts", type: "ARRAY" },
        { key: "presets", displayName: "Color presets", type: "ARRAY" },
      ],
      permissions: { read: "ANYONE", insert: "ADMIN", update: "ADMIN", remove: "ADMIN" },
    },
  });
  console.log(`created ${COLLECTION}:`);
  printCollection(collection);
}

function printCollection(collection) {
  console.log(`  permissions ${JSON.stringify(collection.permissions)}`);
  console.table(collection.fields.filter((f) => !f.systemField).map((f) => ({ key: f.key, type: f.type })));
}

async function publish(slug, dryRun) {
  const product = await readProduct(slug);
  const spec = existsSync(specPath(slug)) ? readJson(specPath(slug)) : fail(`no models/specs/${slug}.json: run optimize first`);
  const file = join(WEB_DIR, `${slug}.glb`);
  if (!existsSync(file)) fail(`no models/web/${slug}.glb: run optimize first`);
  const io = await makeIO();
  const doc = await io.read(file);
  const nodes = partNodes(doc).map((n) => n.getName());
  const problems = specProblems(spec, product, nodes);
  const built = doc.getRoot().getAsset().extras?.kix?.rotateY;
  if (built !== spec.rotateY) problems.push(`the model was optimized with rotateY ${built}, the spec says ${spec.rotateY}: run optimize again`);
  if (problems.length) fail(`${slug}: the spec has problems, nothing uploaded:\n  - ${problems.join("\n  - ")}`);

  // The made color's preset becomes the material colors, so the file looks right on its own.
  const made = spec.presets.find((p) => p.color === spec.madeFrom);
  for (const node of partNodes(doc)) {
    const zone = spec.parts.find((p) => p.node === node.getName()).zone;
    for (const prim of node.getMesh().listPrimitives()) prim.getMaterial()?.setBaseColorFactor(linearFactor(made.zones[zone]));
  }
  const bytes = Buffer.from(await io.writeBinary(doc));
  if (bytes.byteLength >= MAX_BYTES) fail(`${slug}: ${mb(bytes.byteLength)} MB, over 5 MB`);
  writeFileSync(file, bytes);
  const sha = createHash("sha256").update(bytes).digest("hex");
  console.log(`${product.name}: spec valid, ${nodes.length} parts, ${spec.presets.length} presets, ${mb(bytes.byteLength)} MB`);
  if (dryRun) return console.log("  --dry-run: nothing uploaded");

  // Upload: Generate File Upload URL, then PUT the bytes.
  const { uploadUrl } = await call("POST", "/site-media/v1/files/generate-upload-url", { mimeType: "model/gltf-binary", fileName: `${slug}.glb`, sizeInBytes: String(bytes.byteLength) });
  const put = await fetch(`${uploadUrl}?filename=${encodeURIComponent(`${slug}.glb`)}`, { method: "PUT", headers: { "Content-Type": "model/gltf-binary" }, body: bytes });
  const uploaded = await put.json().catch(() => ({}));
  if (!put.ok || !uploaded.file?.id) fail(`upload → ${put.status}: ${JSON.stringify(uploaded).slice(0, 400)}`);
  const fileId = uploaded.file.id;

  let media;
  for (let waited = 0; ; waited += 2000) {
    media = (await call("GET", `/site-media/v1/files/get-file-by-id?fileId=${encodeURIComponent(fileId)}`)).file;
    if (media.operationStatus === "READY") break;
    if (media.operationStatus === "FAILED") fail(`Wix Media failed to process ${fileId}`);
    if (waited >= 120_000) fail(`${fileId} still ${media.operationStatus} after 120 s`);
    await sleep(2000);
  }
  const model = media.media?.model3d ?? {};
  const modelUrl = model.url || media.url;
  const checks = { status: media.operationStatus, mediaType: media.mediaType, url: modelUrl, expires: model.urlExpirationDate ?? null };
  if (!modelUrl) fail(`${fileId} has no URL: ${JSON.stringify(media).slice(0, 400)}`);
  if (checks.expires) fail(`${modelUrl} expires ${checks.expires}; not saving an expiring URL`);

  // The browser will fetch it cross-origin, and it must be our exact file.
  const served = await fetchRetry(modelUrl, { headers: { Origin: CORS_ORIGIN } });
  const servedBytes = Buffer.from(await served.arrayBuffer());
  Object.assign(checks, {
    http: served.status,
    cors: served.headers.get("access-control-allow-origin"),
    contentType: served.headers.get("content-type"),
    sameSize: servedBytes.byteLength === bytes.byteLength,
    sameSha256: createHash("sha256").update(servedBytes).digest("hex") === sha,
  });
  console.log("  media:", checks);
  if (!served.ok || !checks.cors || !checks.sameSize || !checks.sameSha256) fail(`${modelUrl} failed a check above; the CMS row was not written`);

  // One row per product: the item id is the product id, and Bulk Save replaces it.
  const previous = await api("POST", "/wix-data/v2/items/query", { dataCollectionId: COLLECTION, query: { filter: { _id: product.id } }, consistentRead: true });
  const before = previous.json.dataItems?.[0]?.data;
  const data = {
    _id: product.id,
    title: product.name,
    productId: product.id,
    modelUrl,
    modelFileId: fileId,
    modelBytes: bytes.byteLength,
    madeFrom: spec.madeFrom,
    parts: spec.parts,
    presets: spec.presets,
  };
  const saved = await call("POST", "/wix-data/v2/bulk/items/save", { dataCollectionId: COLLECTION, dataItems: [{ id: product.id, data }] });
  const meta = saved.results?.[0]?.itemMetadata;
  if (!meta?.success) fail(`Bulk Save failed: ${JSON.stringify(saved).slice(0, 400)}`);
  console.log(`  saved ${COLLECTION}/${meta.id} (${before ? "replaced" : "inserted"})`);
  if (before?.modelFileId && before.modelFileId !== fileId) console.log(`  the previous model file ${before.modelFileId} is still in Wix Media (not deleted)`);
}

async function view() {
  const { serve } = await import("./serve.mjs");
  serve(ROOT, 4400);
}

// ---- main --------------------------------------------------------------------------------------

const [command, slug, ...flags] = process.argv.slice(2);
const needSlug = () => slug ?? fail(`usage: npm run models -- ${command} <product-slug>`);
try {
  if (command === "setup") await setup();
  else if (command === "optimize") await optimize(needSlug());
  else if (command === "publish") await publish(needSlug(), flags.includes("--dry-run"));
  else if (command === "view") await view();
  else fail("usage: npm run models -- setup | optimize <slug> | publish <slug> [--dry-run] | view");
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
}
