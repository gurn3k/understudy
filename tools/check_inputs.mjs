// Hostile input on the calculators and the pages' start-up, checked in headless Chrome. Entries are typed with real
// key input (Input.insertText), so the number fields parse them as a reader's browser would.
// Usage: node tools/check_inputs.mjs http://127.0.0.1:8765/   (exit 1 on any failure)
// Node 22 or later (built-in fetch and WebSocket); no packages.
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EXTRA = (process.env.CHROME_ARGS || "").split(/\s+/).filter(Boolean);
const port = 9335;
const proc = spawn(CHROME, [...EXTRA, "--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), "us-inputs")}`, "about:blank"], { stdio: "ignore" });
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
let stub = null; // when set, data.json is answered with this body
ws.addEventListener("message", (m) => {
  const x = JSON.parse(m.data);
  if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); }
  if (x.method === "Fetch.requestPaused") {
    const rid = x.params.requestId;
    if (stub !== null && /\/data\.json(\?|$)/.test(x.params.request.url)) {
      send("Fetch.fulfillRequest", { requestId: rid, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(stub).toString("base64") });
    } else send("Fetch.continueRequest", { requestId: rid });
  }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.result.value;
await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

async function open(path) {
  await send("Page.navigate", { url: new URL(path, base).href });
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    if (await ev("!document.querySelector('[data-loading]') && !!document.querySelector('main section')")) return true;
  }
  return false;
}
async function type(fieldId, text) {
  await ev(`(() => { const e = document.getElementById(${JSON.stringify(fieldId)}); e.scrollIntoView(); e.focus(); e.select(); })()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
  if (text) await send("Input.insertText", { text });
  await sleep(150);
}
const outs = (p) => ev(`[...document.querySelectorAll('[data-out^="${p}-"]')].map((e) => e.textContent).join(" | ")`);
const note = (id) => ev(`(document.querySelector('[data-clamp="${id}"]') || {}).textContent || ""`);

let fails = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { fails++; console.log(`FAIL: ${what}`); } };
const CALCS = [["./", "biz"], ["case.html", "in"]];

// F1: the integration cost has a ceiling; a huge entry is held there, with a note, and never printed in exponent form.
for (const [page, p] of CALCS) {
  check(await open(page), `${page} loaded`);
  for (const v of ["1e308", "1.7976931348623157e308", "999999999999999"]) {
    await type(`${p}-int`, v);
    const o = await outs(p), n = await note(`${p}-int`);
    check(!/e\+|NaN|Infinity|undefined/.test(o), `${page} integration cost ${v}: readout prints "${(o.match(/[^|]*(e\+|NaN|Infinity|undefined)[^|]*/) || [""])[0].trim()}"`);
    check(/^Held at 1,000,000,000, the highest allowed\.$/.test(n), `${page} integration cost ${v}: note "${n}"`);
  }
  await type(`${p}-int`, "");
}

ws.close();
proc.kill();
console.log(`${checks - fails}/${checks} input checks passed`);
process.exit(fails ? 1 : 0);
