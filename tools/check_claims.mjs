// Checks that every sentence fixed in the decision records appears verbatim on the rendered page, and that
// wording the records rule out appears on neither the page nor the pilot request (rfp.html), including their meta
// tags, chart descriptions and labels, nor in README.md. The fixed sentences are removed before that scan, since
// some of them quote wording that is otherwise ruled out.
// Usage: node tools/check_claims.mjs <url>   (exit 1 on any missing sentence or forbidden phrase)
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] || "http://127.0.0.1:8765/";
const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// Quoted sentences from the records that fix the page's wording. Superseded ones are named in the erratum.
const SUPERSEDED = ["about 10 weeks sooner", "with no earlier promotion", "removed 788 manual touches"];
const sources = ["docs/adr/0015-comparison-rule-replaced.md", "docs/adr/0016-verdict.md", "docs/adr/0017-replay-claims.md"];
const want = [];
for (const s of sources) {
  for (const m of read(s).matchAll(/"([^"\r\n]{60,})"/g)) {
    const t = m[1].trim();
    if (!SUPERSEDED.some((x) => t.includes(x))) want.push({ src: s, text: t });
  }
}

// ADR 0018's sentences are templates: fill the ones that apply from the scored follow-up in site/data.json.
const b2 = JSON.parse(read("site/data.json")).b2;
if (b2 && b2.b_alone) {
  const tpl = {};
  for (const m of read("docs/adr/0018-b-follow-up-run.md").matchAll(/^\s*- \*\*([^*]+):\*\* "([^"]+)"/gm)) tpl[m[1]] = m[2];
  const a = b2.b_alone, v = b2.b_vs_c, f1 = (x) => (x * 100).toFixed(1);
  const n = (x) => x.toLocaleString("en-US");
  const vals = { n: n(a.n), passed: n(a.passed), coverage_pct: f1(a.coverage), wrong: n(a.wrong), lower_pct: f1(a.lower), upper_pct: f1(a.upper),
    b_passed: n(v.B_passed), c_passed: n(v.C_passed), b_wrong: n(v.B_wrong), c_wrong: n(v.C_wrong), b_only: n(v.B_only), c_only: n(v.C_only),
    p: (v.winner === "B" ? v.p_B_better : v.p_C_better).toPrecision(2),
    c_cost: "$" + (JSON.parse(read("site/data.json")).cost.c.usd / JSON.parse(read("site/data.json")).cost.c.calls).toFixed(2),
    b_cost: "$" + (b2.cost.usd * 1000 / a.n).toFixed(2) };
  const keys = ["Disclosure", { proved: "Proved", not_proved: "Not proved", below_bar: "Not proved" }[a.outcome],
    ...(a.outcome === "below_bar" ? ["If below the bar, add"] : []),
    { B: "B wins", C: "C wins", not_separated: "Not separated" }[v.winner]];
  for (const k of keys) want.push({ src: "docs/adr/0018-b-follow-up-run.md", text: tpl[k].replace(/\{(\w+)\}/g, (_, x) => vals[x]) });
}

// Wording the records rule out, on either page. Each entry: a pattern, why, and where the rule comes from.
// "Safe" is allowed only in the page's question, "which invoices are safe to pay": a question, not a claim.
const FORBIDDEN = [
  [/\bsafe(r|ly)?\b(?<!invoices are safe)/i, "safe/safer/safely as a claim (the replay shows trust earned on outcomes, not safety)", "ADR 0017, Don't claim; ADR 0022"],
  [/\d+ mistakes short/i, "near-miss framing; say not proven, with the worst likely case", "ADR 0022"],
  [/\ba hair under\b|\bjust short of the proof\b/i, "near-miss framing", "ADR 0022"],
  [/\bexcept one\b/i, "overstates the discipline; give the count of changes made after results", "ADR 0022"],
  [/\bunseen/i, "the test months were held out, but not unseen in every sense (look-ahead)", "ADR 0022"],
  [/only what was known|facts known then|known at that moment/i, "ignores the look-ahead in the inputs", "ADR 0022"],
  [/made fewer wrong payments/i, "coverage artefact: it paid only what the rulebook also paid", "ADR 0023"],
  [/most of the 15\b/i, "all 15 replay mistakes were in one kind", "ADR 0022"],
  [/could not measure by how much/i, "the floor is measured: give it", "ADR 0022"],
  [/too few to tell/i, "it was about as accurate as the rulebook on what it paid, paying far fewer", "ADR 0022"],
  [/say, 95%/i, "an unexplained example threshold", "ADR 0022"],
  [/Safety and controls \(M1|answer M1 to M8/i, "M requirements are pass/fail, not scored", "ADR 0025"],
  [/wrong[- ]payment budget/i, "say the correction budget", "ADR 0025"],
  [/blind checks[^.]{0,60}\(my assumption|window is still to be fixed/i, "the blind-check window is a requirement (M9), not an assumption", "ADR 0025"],
  [/the safer way|trust earned safely/i, "the replay is not shown to be safer", "ADR 0017, Don't claim"],
  [/just short|edge of the bar|how close/i, "near-miss framing; say not proven, with the worst likely case", "ADR 0022"],
  [/never seen|had (not|never) seen|none of them (had )?seen|saw their outcomes/i, "the test months were held out, but inputs drew on later outcomes (look-ahead)", "ADR 0022"],
  [/wrong payments?/i, "say lines paid that needed a correction: the label is a correction, not a wrong payment", "ADR 0022"],
  [/corrections after payment aren't seen/i, "post-clearing corrections are in the records and move the result: give the figure", "ADR 0022"],
];
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
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
async function pageText(u) {
  await send("Page.navigate", { url: u });
  let loaded = false;
  for (let i = 0; i < 120 && !loaded; i++) {
    await sleep(250);
    const r = await send("Runtime.evaluate", { expression: "!document.querySelector('[data-loading]') && !!document.querySelector('main section')", returnByValue: true });
    loaded = r.result.result.value;
  }
  if (!loaded) return null;
  await sleep(300);
  const res = await send("Runtime.evaluate", { expression: "JSON.stringify({ main: document.querySelector('main').textContent + ' ' + document.title, biz: (document.querySelector('#biz') || {}).textContent || '', extra: [...document.querySelectorAll('meta[content]')].map((m) => m.content).concat([...document.querySelectorAll('svg desc, svg title')].map((e) => e.textContent), [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')), [...document.querySelectorAll('img[alt]')].map((e) => e.alt)).join(' | ') })", returnByValue: true });
  return JSON.parse(res.result.result.value || "{}");
}
const pageAll = await pageText(url), rfpAll = await pageText(new URL("rfp.html", url).href);
const texts = { page: pageAll && pageAll.main, "page head and labels": pageAll && pageAll.extra, rfp: rfpAll && rfpAll.main, "rfp head and labels": rfpAll && rfpAll.extra, "README.md": read("README.md") };
if (!pageAll || !rfpAll) {
  console.log("PAGE DID NOT LOAD within 30 s: no sentences checked");
  ws.close();
  proc.kill();
  process.exit(2);
}
ws.close();
proc.kill();

const norm = (s) => s.replace(/\s+/g, " ").replace(/[‘’]/g, "'").trim();
const page = norm(texts.page);
let missing = 0;
for (const w of want) {
  if (!page.includes(norm(w.text))) { missing++; console.log(`MISSING (${w.src}): ${w.text}`); }
}
console.log(`${want.length - missing}/${want.length} fixed sentences found on the page`);
let banned = 0;
const fixed = want.map((w) => norm(w.text));
for (const [name, t] of Object.entries(texts)) {
  let text = norm(t || "");
  for (const f of fixed) text = text.split(f).join(" [fixed sentence] ");
  for (const [re, why, src] of FORBIDDEN) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of text.matchAll(g)) {
      banned++;
      console.log(`FORBIDDEN on ${name} (${src}): "${text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 30)}" (${why})`);
    }
  }
}
console.log(`${FORBIDDEN.length} forbidden patterns checked on the page, rfp.html (with meta tags, chart descriptions and labels) and README.md: ${banned} found`);

// Required figures: the business case (Q9) and the pilot request must each carry the key figures, computed here
// from site/data.json the same way the pages format them, so the two parts can't drift apart or drop a qualifier.
const D = JSON.parse(read("site/data.json")), B = D.business, E = D.evidence, chosen = D.policies.find((p) => p.chosen);
const pc = (x, dp) => (x * 100).toFixed(dp) + "%", n0 = (x) => Math.round(x).toLocaleString("en-US");
const cReview = (5 / 60) * 40, needLow = 100 / (B.lines_per_mistake.gated_cautious * cReview); // the calculators' defaults
// The decision figure at the defaults: the share reviewed at which the yearly net, everything earned, reaches zero after
// late fixes (cautious end), 8 oversight hours a week and monthly blind checks on one kind.
const linesYr = (B.paid * 12) / B.months, runYr = 8 * 52 * 40 + 12 * ((B.blind.n * 5) / 60) * 40;
const needNet = (linesYr / B.lines_per_mistake.gated_cautious * 100 + runYr) / (linesYr * cReview);
const netWord = needNet > 1 ? ["decision at the defaults", "Doesn't pay at these inputs"] : ["decision at the defaults", pc(needNet, 1)];
const REQUIRED = {
  q9: [["lines it would have paid", n0(B.paid)], ["lines that needed a correction", n0(B.wrong)], ["worst likely case", pc(chosen.held_out.precision_lower, 2)],
    ["worst likely case allowing for orders", pc(E.clustering.clustered_lower, 1)], ["paying every invoice", pc(D.bar.pass_everything.full.precision[0] / D.bar.pass_everything.full.precision[1], 2)],
    ["replay lines paid", n0(D.replay.totals.passed)], ["earned share in the replay", pc(B.gated.earned_share, 1)], ["share reviewed needed, cautious end", pc(needLow, 1)], netWord],
  rfp: [["lines it would have paid", n0(B.paid)], ["lines that needed a correction", n0(B.wrong)], ["worst likely case", pc(chosen.held_out.precision_lower, 2)],
    ["worst likely case allowing for orders", pc(E.clustering.clustered_lower, 2)], ["label moved: post-clearing corrections", pc(E.sensitivity.post_clear_lower, 2)],
    ["replay lines paid", n0(D.replay.totals.passed)], ["earned share in the replay", pc(B.gated.earned_share, 1)], ["share reviewed needed, cautious end", pc(needLow, 1)],
    ["blind-check lines a kind a window", n0(B.blind.n)], ["supplier whitelist to beat, worst likely case", pc(E.vendor.rows.find((r) => r.key === E.vendor.picked).lower, 2)],
    needNet > 1 ? ["decision at the defaults", "Not at these inputs"] : ["decision at the defaults", pc(needNet, 1)]],
};
// The pilot request's controls (ADR 0025), from data.json's "controls" block.
const K = D.controls;
REQUIRED.rfp.push(["weekly looks the replay's gate took", `looked ${n0(K.looks)} times`],
  ["first promotion's worst likely case", pc(K.promotions[0].lower, 3)], ["second promotion's worst likely case", pc(K.promotions[1].lower, 3)],
  ["early pass by chance", "an early pass by chance"], ["borderline kind on its best week", "a borderline kind passing on its best week"],
  ["per-order cap, a lesson not a tested control", "not a tested control"],
  ["switch-off: tolerated upper end", pc(K.tolerated_upper, 2)], ["switch-off: power on its window", pc(K.power_window, 0)],
  ["switch-off test named", "two-sided 95% Wilson interval"], ["settled defined", "A call is settled once"], ["arrival order", "in the order they arrived"],
  ["promoted then switched off", `${n0(K.demotions[0].recent[0])} of ${n0(K.demotions[0].recent[1])}`],
  ["blind checks mandatory", "M9"], ["blind-check power at the sized window", pc(B.blind.power, 0)], ["blind-check power at 400 lines", pc(K.power_400, 0)],
  ["two outcome streams", "two outcome streams"], ["sampled by order", "drawn as whole purchase orders"],
  ["calls needed allowing for orders, no mistakes", `about ${n0(K.clustered_calls[0].clustered)}`], ["intervals allow for orders", "cluster-robust at order level"],
  ["supplier-level design effect", `about ${n0(E.rulebook_by_vendor.deff)} across ${n0(E.rulebook_by_vendor.vendors)} suppliers`],
  ["whitelist is mandatory", "Requirement M11"], ["mandatory means pass/fail", "Failing any M requirement disqualifies the proposal"]);
let absent = 0, nreq = 0;
for (const [where, list] of Object.entries(REQUIRED)) {
  const text = norm(where === "q9" ? pageAll.biz : rfpAll.main);
  for (const [label, fig] of list) {
    nreq++;
    if (!text.includes(fig)) { absent++; console.log(`REQUIRED FIGURE MISSING on ${where === "q9" ? "Q9" : "rfp.html"}: ${label} (${fig})`); }
  }
}
console.log(`${nreq - absent}/${nreq} required figures found in Q9 and rfp.html`);
process.exit(missing || banned || absent ? 1 : 0);
