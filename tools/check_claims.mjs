// Checks that every sentence fixed in the decision records appears verbatim on the rendered page.
// Usage: node tools/check_claims.mjs <url>   (exit 1 on any missing sentence)
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] || "http://127.0.0.1:8765/";
const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// Quoted sentences from the records that fix the page's wording. Superseded ones are named in the erratum.
const SUPERSEDED = ["about 10 weeks sooner", "with no earlier promotion"];
const sources = ["docs/adr/0015-comparison-rule-replaced.md", "docs/adr/0016-verdict.md", "docs/adr/0017-replay-claims.md"];
const want = [];
for (const s of sources) {
  for (const m of read(s).matchAll(/"([^"\r\n]{60,})"/g)) {
    const t = m[1].trim();
    if (!SUPERSEDED.some((x) => t.includes(x))) want.push({ src: s, text: t });
  }
}

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9334;
const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), "us-claims")}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* starting */ }
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
await send("Page.navigate", { url });
for (let i = 0; i < 60; i++) {
  await sleep(250);
  const r = await send("Runtime.evaluate", { expression: "!document.querySelector('[data-loading]') && !!document.querySelector('main section')", returnByValue: true });
  if (r.result.result.value) break;
}
const res = await send("Runtime.evaluate", { expression: "document.querySelector('main').textContent", returnByValue: true });
ws.close();
proc.kill();

const norm = (s) => s.replace(/\s+/g, " ").replace(/[‘’]/g, "'").trim();
const page = norm(res.result.result.value || "");
let missing = 0;
for (const w of want) {
  if (!page.includes(norm(w.text))) { missing++; console.log(`MISSING (${w.src}): ${w.text}`); }
}
console.log(`${want.length - missing}/${want.length} fixed sentences found on the page`);
process.exit(missing ? 1 : 0);
