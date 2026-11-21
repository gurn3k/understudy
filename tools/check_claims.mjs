// Checks that every sentence fixed in the decision records appears verbatim on the rendered page, and that
// wording the records rule out appears on neither the page, the pilot request (rfp.html) nor the internal case
// (case.html), including their meta tags, chart descriptions and labels, nor in README.md. The request goes to
// proposers, so it must also carry no return verdict (VENDOR_FORBIDDEN). The fixed sentences are removed before that scan, since
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
  [/as the replay (did|does)\b|which took \d+ weeks in the replay|since Phase 2 began|looked 330 times/i, "the plan and the gate the request now rules out (batch 3 ruling)", "ADR 0025"],
  [/mostly from one kind/i, "all of the replay's mistakes were in one kind", "ADR 0022"],
  [/Trigger a switch-off/i, "the switch-off is automatic: confirm or override it", "ADR 0025"],
  [/wrong[- ]payment budget/i, "say the correction budget", "ADR 0025"],
  [/blind checks[^.]{0,60}\(my assumption|window is still to be fixed/i, "the blind-check window is a requirement (M9), not an assumption", "ADR 0025"],
  [/the safer way|trust earned safely/i, "the replay is not shown to be safer", "ADR 0017, Don't claim"],
  [/just short|edge of the bar|how close/i, "near-miss framing; say not proven, with the worst likely case", "ADR 0022"],
  [/never seen|had (not|never) seen|none of them (had )?seen|saw their outcomes/i, "the test months were held out, but inputs drew on later outcomes (look-ahead)", "ADR 0022"],
  [/wrong payments?/i, "say lines paid that needed a correction: the label is a correction, not a wrong payment", "ADR 0022"],
  [/corrections after payment aren't seen/i, "post-clearing corrections are in the records and move the result: give the figure", "ADR 0022"],
  [/\bFTEs?\b|staff resist/i, "count the saving as review hours freed (capacity, not jobs); staff are consulted, not a resistance risk", "review round, Should 4"],
  [/made about \d+ times as often|most repeated of the decisions|manual clearing and block-removal events in these records/i, "unlike units: logged steps are not decisions or invoices; count in order lines", "review round, Should 5"],
  [/, (before|after) delivery\b|arrived before or after the goods|came before or after the delivery/i, "the kind is the order's matching setting, not when the invoice came", "review round, Should 6"],
  [/Code: MIT\.|independent program|recounted the records independently/i, "the code is private, and the recount is a second program written separately", "review round, Should 13"],
  [/written separately all landed|written separately landed|independently written|rulebooks agree/i, "the three rulebooks are drafts by the same model from the same inputs: consistent, not independent", "review round, Should 15"],
  [/Decision and Gate 1 package|\d+ weeks expected/i, "the plan is a range (at least, at most under the stop rule) and procurement ends in the award decision", "review round, Should 26"],
  [/rewritten every month, which is 12 rulebooks a year/i, "a monthly rewrite is a cost ceiling; trust belongs to the version that earned it", "ADR 0026"],
  [/points the same way/i, "the value limit was not tested; give the share of mistakes and of value paid in the largest tenth", "review round, Should 3"],
  [/pre-registered approaches, [\d,]+ real invoices/i, "the three approaches were not all judged on the same invoices: give each its own set", "review round, Should 23"],
  [/30 to 90 days|supplier-written guides/i, "an outside claim with no checked source: the study's own replay sets the shortest pilot", "review round, Should 24"],
  [/Out of scope; existing controls stay/i, "the existing duplicate and fraud checks must run on lines paid on their own (M14)", "review round, Should 18"],
  [/overrule|rising override rate|show the override rate|The AI suggests, and a person still decides/i, "the AI's calls are hidden in practice mode, so there is nothing to overrule; the override rate is dropped", "ADR 0027"],
  [/Rulebook Owner|sign off each rulebook version|rulebook's say-so/i, "the requirements are outcomes on the decision component, any approach; the rulebook is the reference design (Appendix E)", "review round, Should 9"],
  [/Beat a supplier whitelist that the issuer|post hoc, to be confirmed|to be confirmed on later data/i, "the September check failed the shortlist on test (a): M11 now refits the rule in Phase 0", "ADR 0029, amendment 1"],
  [/mistakes are too rare to show at this scale/i, "the dot chart hid the AI's mistakes: give exact counts per lane", "review round, Should 7"],
];
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9334;
// CHROME_ARGS: extra flags, e.g. "--no-sandbox" on a CI runner that blocks Chrome's sandbox.
const EXTRA = (process.env.CHROME_ARGS || "").split(/\s+/).filter(Boolean);
const proc = spawn(CHROME, [...EXTRA, "--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), "us-claims")}`, "about:blank"], { stdio: "ignore" });
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
const pageAll = await pageText(url), rfpAll = await pageText(new URL("rfp.html", url).href), caseAll = await pageText(new URL("case.html", url).href);
const texts = { page: pageAll && pageAll.main, "page head and labels": pageAll && pageAll.extra, rfp: rfpAll && rfpAll.main, "rfp head and labels": rfpAll && rfpAll.extra,
  case: caseAll && caseAll.main, "case head and labels": caseAll && caseAll.extra, "README.md": read("README.md") };
if (!pageAll || !rfpAll || !caseAll) {
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
// The request goes to every proposer: it must not tell them the issuer's own return verdict (ADR 0030). Those figures
// and words belong to the internal case.
const VENDOR_FORBIDDEN = [
  [/return on the pilot|first-year return|\bROI\b|payback|pays? back|net yearly benefit|net a year|pays? (its|their) way|pays off|does(n't| not) (pay|repay)|repays? itself|not reachable|at (these|your) inputs|gross saving|on-paper saving/i, "a return figure or verdict in the request sent to proposers", "ADR 0030"],
];
for (const name of ["rfp", "rfp head and labels"]) {
  const text = norm(texts[name] || "");
  for (const [re, why, src] of VENDOR_FORBIDDEN) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags + "g"))) {
      banned++;
      console.log(`FORBIDDEN on ${name} (${src}): "${text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 30)}" (${why})`);
    }
  }
}
console.log(`${FORBIDDEN.length} forbidden patterns checked on the page, rfp.html, case.html (with meta tags, chart descriptions and labels) and README.md, and ${VENDOR_FORBIDDEN.length} more on rfp.html: ${banned} found`);

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
REQUIRED.rfp.push(["weekly looks the replay's gate took", `looked ${n0(K.gate_looks)} times across ${n0(K.gate_kinds)} kinds`],
  ["first promotion's worst likely case", pc(K.promotions[0].lower, 3)], ["second promotion's worst likely case", pc(K.promotions[1].lower, 3)],
  ["early pass by chance", "an early pass by chance"], ["borderline kind on its best week", "a borderline kind passing on its best week"],
  ["per-order cap, a lesson not a tested control", `This is a lesson from the replay, where ${n0(E.replay.top_order)} of the ${n0(E.replay.wrong)} mistakes were on one order, not a tested control`],
  ["switch-off: tolerated upper end", pc(K.tolerated_upper, 2)], ["switch-off: power on its window", pc(K.power_window, 0)],
  ["switch-off test named", "two-sided 95% Wilson interval"], ["settled defined", "A call is settled once"], ["arrival order", "in the order they arrived"],
  ["promoted then switched off", `${n0(K.demotions[0].recent[0])} of ${n0(K.demotions[0].recent[1])}`],
  ["blind checks mandatory", "Check a sample of the lines each kind paid on its own blind"], ["blind-check power at the sized window", pc(B.blind.power, 0)], ["blind-check power at 400 lines", pc(K.power_400, 0)],
  ["two outcome streams", "two outcome streams"], ["sampled by order", "drawn as whole purchase orders"],
  ["calls needed allowing for orders, no mistakes", `about ${n0(K.clustered_calls[0].clustered)}`], ["intervals allow for orders", "cluster-robust at order level"],
  ["supplier-level design effect", `about ${n0(E.rulebook_by_vendor.deff)} across ${n0(E.rulebook_by_vendor.vendors)} suppliers`],
  ["whitelist is mandatory", "Requirement M11"], ["mandatory means pass/fail", "Failing any M requirement disqualifies the proposal"],
  ["data protection, mandatory", "Data protection (all mandatory, under M13)"], ["retention and training use", "DP1 Retention and training use"], ["residency", "DP2 Residency"],
  ["sub-processors", "DP3 Sub-processors"], ["breach notice", "DP4 Breach notice"], ["attestations", "DP5 Attestations"], ["data-processing agreement", "DP6 Data-processing agreement"],
  ["RACI: switch-off row renamed", "Confirm or override an automatic switch-off"], ["RACI: writing row", "Write or change a version of the decision component"],
  ["RACI: AP team lead", "Accounts-payable team lead"], ["RACI: control owner", "Finance Controller or Internal Control"],
  ["Gate 4 success box", "Success at Gate 4"], ["budget in count and value", "two parts, count and value"],
  ["default count budget breached in the replay", `the replay had ${n0(D.replay.totals.wrong)} (${pc(D.replay.totals.wrong / D.replay.totals.passed, 1)}), so it would have been exceeded`]);
// What each default does on the study's data (the batch 3 ruling), each default with its label, and the quarterly
// blind-check sensitivity beside the decision.
const DF = K.defaults, runYrQ = 8 * 52 * 40 + DF.blind_quarter_windows * ((B.blind.n * 5) / 60) * 40;
const needNetQ = (linesYr / B.lines_per_mistake.gated_cautious * 100 + runYrQ) / (linesYr * cReview);
const qTxt = needNetQ > 1 ? "still doesn't pay" : `needs ${pc(needNetQ, 1)}`;
REQUIRED.rfp.push(
  ["M2 default, labelled", `this default of mine: its worst likely case, allowing for orders, at or above ${pc(DF.margin, 1)}`],
  ["M2 pass mark", "at or below 5%"], ["M2 default on the replay", K.m2_default.promotions === 0 ? "would not have promoted any kind" : "would have come in"],
  ["calls at M2's default, allowing for orders", `about ${n0(K.clustered_calls[0].margin_clustered)}`],
  ["M12 default, labelled", "(my default; the issuer sets the number at Gate 1)"], ["M12 release", "the order's later lines go to a person"],
  ["M12 effect on the replay", `from ${n0(D.replay.totals.passed)} to ${n0(K.order_cap.passed)} and mistakes from ${n0(D.replay.totals.wrong)} to ${n0(K.order_cap.wrong)}`],
  ["settled default, labelled", `${DF.settle_days} days have passed (my default`], ["settled re-scoring", "the call is re-scored"],
  ["settled: share corrected within the default", `${pc(K.settle.within[String(DF.settle_days)], 0)} were corrected within ${DF.settle_days} days`],
  ["M3 second test defined", "of its error rate, on every settled call it has paid on its own since promotion"],
  ["M3 second test on 1,000 calls", `at ${n0(K.second_test[0].fires_1000)} in 1,000`],
  ["M9 window in lines with a ceiling", "no longer than a calendar quarter"], ["kinds that reach a full monthly window", `reach ${n0(B.blind.n)} lines a month`],
  ["the replay's first kind a month", `pays about ${n0(K.first_kind_month)}`],
  ["fixed count budget", "a fixed count"], ["the replay's count budget", `the count would have been ${n0(K.budget_count_replay)}`],
  ["quarterly sensitivity in section 1", needNetQ > 1 ? "With quarterly blind-check windows instead of monthly: still not" : `With quarterly blind-check windows instead of monthly: at ${pc(needNetQ, 1)}`],
  ["the ask funds the measurements", "on award fund Phase 0 to measure the inputs that decide it"], ["Gate 1 money test", "give a positive net after running costs"],
  ["M11 built by the issuer", "The issuer, not the proposer, builds it"],
);
REQUIRED.q9.push(["quarterly sensitivity in the readout", `With quarterly blind-check windows instead of monthly: ${qTxt}`],
  ["Q9: a rule that holds under weekly looks", "by a rule that holds when checked every week"], ["Q9: blind checks", "Check a sample of what it pays on its own, blind"],
  ["Q9: per-order cap", "Cap how many lines of one order it pays on its own"]);
// Value-weighted error (Should 3): the largest tenth's share of mistakes by count, and the base it sits on.
const T10 = B.top10;
REQUIRED.q9.push(["largest tenth: share of mistakes by count", `held ${pc(T10.wrong / B.wrong, 0)} of its mistakes`],
  ["largest tenth: share of value paid", `${pc(T10.paid_value / B.value.paid, 0)} of all the value it paid`],
  ["value rate of lines needing a correction", pc(B.value.wrong / B.value.paid, 1)]);
REQUIRED.rfp.push(["largest tenth: share of mistakes by count", `held ${pc(T10.wrong / B.wrong, 0)} of its mistakes`],
  ["largest tenth: share of value paid", `${pc(T10.paid_value / B.value.paid, 0)} of all the value paid`]);
// The kind label (Should 6): a matching setting, with the share of invoice-first lines whose goods came first.
const KS = E.kind_setting;
REQUIRED.rfp.push(["kind is a setting", `${pc(KS.before_gr_gr_first / KS.before_gr_lines, 1)} of the test lines had the goods received first`],
  ["proposers justify the grouping", "How it groups invoices into kinds, and why"]);
// Q9 in brief (Should 11): the three lines after the lede, with Phase 0's oversight cost at the defaults.
const firstWkC = D.replay.weeks.indexOf(D.replay.first) + 1;
REQUIRED.q9.push(["in brief: recommendation", "What I recommend:"], ["in brief: cost now", `${"$" + n0(8 * 4 * 40)} of oversight time`],
  ["in brief: stop rule", `no kind proves the bar by week ${firstWkC * 2} of practice mode`]);
// The timeline (Should 26): at least the replay's first promotion, at most the stop rule, after procurement.
const PHc = { p0: 4, p2: 12, p3: 2 }, minWk = PHc.p0 + firstWkC + PHc.p2 + PHc.p3, maxWk = PHc.p0 + 2 * firstWkC + PHc.p2 + PHc.p3;
REQUIRED.rfp.push(["plan length range", `at least ${minWk} weeks and at most ${maxWk}`], ["procurement pre-phase", "weeks of procurement"],
  ["award decision", "Award decision"]);
// Evidence per rulebook version (Should 14, ADR 0026).
REQUIRED.rfp.push(["evidence per version", "Trust belongs to the version that earned it"]);
// The three rulebooks (Should 15): consistent, not independent.
REQUIRED.rfp.push(["three drafts are not independent", "consistent, but not independent checks"]);
// People (Should 4): the saving is hours of capacity; staff are consulted; deskilling is a named risk.
REQUIRED.q9.push(["saving as capacity", "capacity, not jobs"]);
// One net (batch 7): Q9 section 4's column is before running costs and says so, so it can't be read as the readout's net.
REQUIRED.q9.push(["section 4 net is before running costs", "Net before running costs"], ["section 4 note names the readout's net", "so it is not the readout's net"]);
REQUIRED.rfp.push(["R10 renamed", "Roles and workload change for accounts-payable staff"], ["consultation in Phase 0", "a works council where there is one"],
  ["deskilling risk", "Staff lose practice on the kinds the AI pays (deskilling)"], ["saving as capacity", "Capacity, not jobs"]);
// Each approach's own test set (Should 23): B was judged on its follow-up sample, not on all the test invoices.
REQUIRED.rfp.push(["B's test set in section 1", `Claude checking each invoice on ${n0(D.b2.b_alone.n)} (a follow-up sample)`]);
// The licence's "modified" statement (Should 22), on the pilot request's footer as on the main page's.
REQUIRED.rfp.push(["CC BY: data modified", "Filtered and aggregated for this analysis"]);
// The pilot request's link preview (Should 21): its own address and title, with the shared image.
REQUIRED.rfpHead = [["og:url", "https://understudy.gurn3k.com/rfp.html"], ["og:title", "Understudy: request for a pilot proposal"], ["og:image", "https://understudy.gurn3k.com/og.png"], ["twitter card", "summary_large_image"]];
// Shorter pilots (Should 24): the reason is the replay's own first promotion, not an outside guide.
REQUIRED.rfp.push(["why not a shorter pilot", `the first kind qualified only in week ${firstWkC} of the replay`]);
// Duplicates and fraud (Should 18): rated Medium, and the existing checks run on every line paid on its own.
REQUIRED.rfp.push(["R8 rated Medium", "Fraud or duplicate paymentsMediumHigh"], ["duplicate check on autonomous payments", "Run the company's existing duplicate-payment and fraud checks on every line paid on its own"]);
// Goods receipt and variance (Should 17): no goods receipt yet means hold; price and quantity differences are a data input.
REQUIRED.rfp.push(["no goods receipt means hold", "No goods receipt yet means hold"], ["variance as a data input", "price and quantity differences between invoice, order and goods receipt"]);
// Practice calls hidden, override rate dropped (Should 8, ADR 0027).
REQUIRED.rfp.push(["practice calls hidden", "The decision component's calls are hidden from the people who handle invoices"], ["override rate dropped", "D3, the override rate, is dropped"]);
// Procurement readiness (Should 9): who reads which sections.
REQUIRED.rfp.push(["how to use: internal case", "This is the internal case."], ["how to use: the request", "Sections 1 to 12 and the appendices go to every proposer"], ["ask: issue the request", "approve issuing the request"]);
REQUIRED.rfp.push(["outcome requirements", "The requirements are outcomes, not a design."], ["decision component defined", "whatever makes the pay-or-hold call on a line"], ["reference design annex", "E. Reference design: the study's rulebook"], ["owner role renamed", "Component Owner"]);
REQUIRED.rfp.push(["commercial: payment by work done", "Payment follows the work done to each gate, not the gate's result"], ["commercial: liability", "Liability for lines paid on the system's call"], ["commercial: data return", "every copy is then deleted, including backups"]);
REQUIRED.rfp.push(["submission block", "Where to submit"], ["questions in writing", "Answers go to every proposer at once"], ["signature authority", "Signed by a person with authority to commit the proposer"]);
REQUIRED.rfp.push(["price formula", "Cost points = 20 × the lowest evaluated price ÷ this proposal's evaluated price"], ["points from the scale", "weight × score ÷ 5"], ["no obligation to award", "The issuer is not bound to award a contract"]);
REQUIRED.rfp.push(["voice is optional", "Voice, optional."], ["sign-off modal", "Each person below shall sign once"]);
// M15's no-goods-receipt counts, counted after the results (ruling 4-6, item 2).
REQUIRED.rfp.push(["M15: no-GR lines paid", `the rulebook paid ${n0(D.controls.no_gr.paid)} lines with no goods receipt when the invoice arrived`], ["M15: no-GR lines wrong", `${n0(D.controls.no_gr.wrong)} of them (${pc(D.controls.no_gr.wrong / D.controls.no_gr.paid, 1)}) needed a correction`], ["M15: counted after the results", "That was counted after the results were known"]);
REQUIRED.rfp.push(["M5: same calls are a check", "read side by side in both versions and signed as such, and, as a check,"]);
REQUIRED.rfp.push(["price: one volume basis", "so every proposal is priced on the same volume"]);
REQUIRED.q9.push(["in brief: procurement first", "running the request for proposals (about 8 weeks), then, on award, only Phase 0"]);
// The README names the business case and the pilot request (Should 20).
REQUIRED.readme = [["README: business case", "a business case (Q9)"], ["README: pilot request", "`site/rfp.html`"]];
// Q1's dot chart prints exact counts per lane (Should 7): the dots round the AI's mistakes away.
const cP = chosen.held_out.precision, bA = D.b2.b_alone;
REQUIRED.page = [["Q1 lane: rulebook exact", `${n0(cP[1])} of ${n0(D.held_out_n)} paid; ${n0(cP[1] - cP[0])} needed fixing (1 in ${n0(cP[1] / (cP[1] - cP[0]))} paid)`],
  ["Q1 lane: B exact", `${n0(bA.passed)} of ${n0(bA.n)} paid; ${n0(bA.wrong)} needed fixing (1 in ${n0(bA.passed / bA.wrong)} paid), on a follow-up sample`],
  ["Q1 lane: simple rule exact", `0 of ${n0(D.held_out_n)} paid`]];
// The later check on September 2018 (ADR 0029): the Method section's figures and readings, and M11's refit.
const CF = D.confirm;
if (CF) {
  const S9 = CF.september.approaches, R9 = CF.readings, X9 = CF.secondary.approaches;
  const ivc = (f) => `${pc(f.fine_share, 2)} (${pc(f.interval[0], 2)} to ${pc(f.interval[1], 2)})`;
  REQUIRED.page.push(["later check heading", "A later check: September 2018"],
    ["later check: lines and window", `on the ${n0(CF.september.lines)} order lines both created and first invoiced in September 2018`],
    ["later check: window", `read for ${n0(CF.window_days)} days after its first invoice receipt`],
    ["later check: rulebook main", `${n0(S9.rulebook.main.wrong)} of ${n0(S9.rulebook.main.n)}: ${ivc(S9.rulebook.main)}`],
    ["later check: rulebook worst", `${n0(S9.rulebook.worst.wrong)} of ${n0(S9.rulebook.worst.n)}: ${ivc(S9.rulebook.worst)}`],
    ["later check: shortlist main", `${n0(S9.shortlist.main.wrong)} of ${n0(S9.shortlist.main.n)}: ${ivc(S9.shortlist.main)}`],
    ["later check: shortlist worst", `${n0(S9.shortlist.worst.wrong)} of ${n0(S9.shortlist.worst.n)}: ${ivc(S9.shortlist.worst)}`],
    ["later check: stuck shares", `${n0(S9.rulebook.stuck)} (${pc(S9.rulebook.stuck_share, 1)})`],
    ["later check: rulebook readings", R9.rulebook.a === "fail" && R9.rulebook.b === "held up" ? `The rulebook didn't reach 99% on September, as it hadn't on June to August lines picked the same way (lower end ${pc(CF.june_august.approaches.rulebook.main.interval[0], 2)}), and it held up against June to August` : "(readings changed: reword)"],
    ["later check: shortlist readings", R9.shortlist.a === "fail" && R9.shortlist.b === "held up" ? "The supplier rule failed test (a)" : "(readings changed: reword)"],
    ["later check: headline stays", "The answer stays not proven."],
    ["Q3: supplier rule after the later check", "a later month, September 2018, had too few lines to confirm it"],
    ["later check: which test", "That came from test (a) alone, on few lines"],
    ["later check: M11 change", "requirement M11 now asks a proposal to beat the same rule refitted on the issuer's own recent data in Phase 0"],
    ["later check: secondary", `all ${n0(CF.secondary.lines)} lines first invoiced in September, created any time. ${n0(CF.secondary.in_test_file)} of them are among the test months' lines`],
    ["later check: secondary rulebook", `The rulebook: ${ivc(X9.rulebook.main)}, worst case ${ivc(X9.rulebook.worst)}, so test (a) ${CF.secondary.readings.rulebook.a}, test (b) ${CF.secondary.readings.rulebook.b}`]);
  REQUIRED.rfp.push(["M11: refit in Phase 0", "Beat the same shortlist rule, refitted on the issuer's own recent data in Phase 0."],
    ["section 2: refit", "any proposal must beat the same shortlist rule, refitted on the issuer's own recent data in Phase 0"],
    ["App. B: 0029", "The later check on September 2018, and M11's refitted shortlist rule: 0029."]);
}
// The split (ADR 0030): the ask, the cost and return at the reader's inputs, the findings behind the desirable
// requirements and the sign-off are on the internal case (case.html); some figures are on both.
const CASE_ONLY = ["share reviewed needed, cautious end", "decision at the defaults", "quarterly sensitivity in section 1", "the ask funds the measurements",
  "ask: issue the request", "how to use: internal case", "sign-off modal", "largest tenth: share of mistakes by count", "largest tenth: share of value paid",
  "three drafts are not independent", "saving as capacity", "earned share in the replay"];
const BOTH = ["lines it would have paid", "lines that needed a correction", "worst likely case", "replay lines paid", "blind-check lines a kind a window",
  "blind-check power at the sized window", "blind-check power at 400 lines", "kinds that reach a full monthly window", "the replay's first kind a month",
  "CC BY: data modified", "B's test set in section 1", "plan length range", "procurement pre-phase", "Gate 1 money test"];
let absent = 0, nreq = 0;
for (const l of [...CASE_ONLY, ...BOTH]) if (!REQUIRED.rfp.some(([x]) => x === l)) { absent++; console.log(`SPLIT LABEL NOT FOUND: ${l}`); }
REQUIRED.case = REQUIRED.rfp.filter(([l]) => CASE_ONLY.includes(l) || BOTH.includes(l));
REQUIRED.rfp = REQUIRED.rfp.filter(([l]) => !CASE_ONLY.includes(l));
REQUIRED.caseHead = [["og:url", "https://understudy.gurn3k.com/case.html"], ["og:title", "Understudy: internal business case for a pilot"], ["og:image", "https://understudy.gurn3k.com/og.png"]];
REQUIRED.readme.push(["README: internal case", "`site/case.html`"]);
for (const [where, list] of Object.entries(REQUIRED)) {
  const src = { q9: [pageAll.biz, "Q9"], rfp: [rfpAll.main, "rfp.html"], case: [caseAll.main, "case.html"], page: [pageAll.main, "the page"], rfpHead: [rfpAll.extra, "rfp.html head"], caseHead: [caseAll.extra, "case.html head"], readme: [read("README.md"), "README.md"] }[where];
  const text = norm(src[0] || "");
  for (const [label, fig] of list) {
    nreq++;
    if (!text.includes(fig)) { absent++; console.log(`REQUIRED FIGURE MISSING on ${src[1]}: ${label} (${fig})`); }
  }
}
console.log(`${nreq - absent}/${nreq} required figures found on the page, in Q9, in rfp.html, in case.html and their heads`);
process.exit(missing || banned || absent ? 1 : 0);
