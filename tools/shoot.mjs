// Screenshots through Chrome's DevTools protocol, so phone widths are emulated exactly.
// Usage: node tools/shoot.mjs <url> <outdir> [width:height:scheme[:full]] ...
// e.g.   node tools/shoot.mjs http://127.0.0.1:8765/ .impeccable/review 390:844:light:full 1440:900:dark
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, outdir, ...shots] = process.argv.slice(2);
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9333;
mkdirSync(outdir, { recursive: true });
const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(tmpdir(), "us-cdp")}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || "exception");
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value).join(" "));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Runtime.enable");
await send("Page.enable");
for (const spec of shots) {
  const [w, h, scheme, full] = spec.split(":");
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const r = await send("Runtime.evaluate", { expression: "!document.querySelector('[data-loading]') && !!document.querySelector('main section') && document.fonts.status === 'loaded'", returnByValue: true });
    if (r.result.result.value) break;
  }
  await sleep(300);
  const m = await send("Runtime.evaluate", { expression: "JSON.stringify({sw: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight})", returnByValue: true });
  const dims = JSON.parse(m.result.result.value);
  const clip = full ? { x: 0, y: 0, width: +w, height: dims.h, scale: 1 } : undefined;
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!full, ...(clip ? { clip } : {}) });
  const name = `${w}-${scheme}${full ? "-full" : ""}.png`;
  writeFileSync(join(outdir, name), Buffer.from(shot.result.data, "base64"));
  console.log(`${name} scrollWidth=${dims.sw} innerWidth=${dims.iw} height=${dims.h}${dims.sw > dims.iw ? "  OVERFLOW" : ""}`);
}
console.log(errors.length ? "page errors: " + errors.join(" | ") : "no page errors");
ws.close();
proc.kill();
