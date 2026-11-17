"use strict";
/* Understudy findings page. Every figure is read from data.json; nothing is typed by hand. */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (n) => Math.round(n).toLocaleString("en-US");
const half = (n) => (Number.isInteger(n) ? int(n) : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
const ratio = ([k, n], d = 1) => pct(k / n, d);
const wk = (label) => "week " + Number(label.split("-W")[1]);
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n) => WORDS[n] || int(n);
const ICON_OPEN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12M2 8h12M2 13h8" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';

function wilson(k, n, z = 1.959963984540054) {
  if (!n) return [null, null];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

function openButton(set, label) {
  return `<button type="button" class="open" data-set="${set}">${ICON_OPEN}${esc(label)}</button>`;
}

/* Most mistakes n paid invoices can hold while still proving 99% (95% lower bound). */
function maxErrors(n) {
  let e = 0;
  while (e < n && wilson(n - e - 1, n)[0] >= 0.99) e++;
  return wilson(n - e, n)[0] >= 0.99 ? e : -1;
}
const oneIn = (n, e) => `1 in ${int(n / e)}`;

/* Each section: a plain account first, then the full statistics behind a "detail" fold. */
function section(id, cue, title, plain, detail, notes, wide = false) {
  const mark = `<span class="marg" aria-hidden="true">${esc(cue)}</span>`;
  const head = title === "<h1" ? plain.replace('<h1 id="q1-h">', `<h1 id="q1-h">${mark}`) : `<h2 id="${id}-h">${mark}${title}</h2>${plain}`;
  const fold = detail ? `<details class="detail"><summary>The detail, with the statistics</summary>${detail}${notes ? `<ul class="fine">${notes.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}</details>` : "";
  return `<section id="${id}" class="${wide ? "wide" : ""}" aria-labelledby="${id}-h">
  <div class="col">${head}${fold}</div>
  <div></div>
</section>`;
}

/* ---------- Words used on the page ---------- */
const WORDS_USED = [
  ["Understudy", "An AI that stands in for a person on one job, and is trusted only once it has proved itself."],
  ["Paid without a check", "The invoice goes to payment with no person looking at it. In the detail sections this is called passing it \"straight through\"."],
  ["Needed fixing", "Between the invoice arriving and being cleared for payment, someone had to correct it. This is the mistake the AI must avoid."],
  ["Held for a person", "The safe choice. It costs a person's time, but it never causes a wrong payment."],
  ["The 99% bar", "Of the invoices an AI pays without a check, at least 99 in 100 must turn out fine."],
  ["Worst likely case", "A short test can be lucky. Given how many invoices were checked, this is the lowest the true share of paid invoices that turn out fine is likely to be (we are 95% sure it is at least this). We judge every AI by this number, not by its average. Statisticians call it the \"lower bound\"; the highest likely value is the \"upper bound\"."],
  ["Learning months and test months", "January to May 2018 were used to learn from. June to August 2018 were kept aside, unseen, for the test."],
  ["Kind of invoice", "Which department made the purchase, and whether the invoice arrived before or after the goods did."],
];
const wordsBox = () => `<details class="words" open><summary>Words used on this page</summary><dl>${WORDS_USED.map(([t, x]) => `<div><dt>${esc(t)}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl></details>`;
const worst = (x, d = 2) => `${pct(x, d)}`;

/* ---------- Q1: the answer ---------- */
function boundPlot(d) {
  const narrow = matchMedia("(max-width: 600px)").matches;
  const rows = [];
  d.policies.forEach((p) => {
    const [k, n] = p.held_out.precision;
    rows.push({ lab: `Rulebook ${p.policy}${p.chosen ? (narrow ? "*" : " (picked)") : ""}`, k, n, chosen: p.chosen });
  });
  rows.push({ lab: narrow ? "Each invoice" : "Checking each invoice", k: d.b.sample.passed - d.b.sample.errors, n: d.b.sample.passed });
  const pe = d.bar.pass_everything.full.precision;
  rows.push({ lab: "Pay everything", k: pe[0], n: pe[1] });
  const lo = 0.95, hi = 1.0, W = narrow ? 360 : 640, L = narrow ? 112 : 180, R = narrow ? 10 : 20, rowH = 34, top = 30;
  const x = (v) => L + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - L - R);
  const H = top + rows.length * rowH + 26;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-t plot-d"><title id="plot-t">Likely range of each approach's true accuracy on the invoices it paid</title>
  <desc id="plot-d">${rows.map((r) => { const [a, b] = wilson(r.k, r.n); return `${esc(r.lab)}: ${pct(r.k / r.n, 2)} fine, likely range ${pct(a, 2)} to ${pct(b, 2)}`; }).join("; ")}. To pass, the worst likely case must be at least 99%.</desc>`;
  for (let v = 0.95; v <= 1.0001; v += narrow ? 0.025 : 0.01) s += `<line class="tick" x1="${x(v)}" x2="${x(v)}" y1="${top - 8}" y2="${H - 22}"/><text x="${x(v)}" y="${H - 6}" text-anchor="middle">${(v * 100).toFixed(narrow ? 1 : 0).replace(".0", "")}%</text>`;
  s += `<line class="barline" x1="${x(0.99)}" x2="${x(0.99)}" y1="${top - 22}" y2="${H - 22}"/><text class="barlab" x="${x(0.99) - 6}" y="${top - 12}" text-anchor="end">BAR 99%</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2, [a, b] = wilson(r.k, r.n);
    s += `<text class="lab" x="0" y="${y + 5}">${esc(r.lab)}</text><line class="iv" x1="${x(a)}" x2="${x(b)}" y1="${y}" y2="${y}"/>
    ${a < lo ? `<text x="${x(lo) + 4}" y="${y - 8}">to ${pct(a, 1)}</text><path class="iv" d="M${x(lo) + 8} ${y - 5} L${x(lo)} ${y} L${x(lo) + 8} ${y + 5}" fill="none"/>` : `<line class="iv" x1="${x(a)}" x2="${x(a)}" y1="${y - 6}" y2="${y + 6}"/>`}<circle class="pt${r.chosen ? " chosen" : ""}" cx="${x(r.k / r.n)}" cy="${y}" r="5"/>`;
  });
  return `<figure class="plot">${s}</svg><figcaption class="small">${narrow ? "* the rulebook picked in advance. " : ""}Dot: the share of paid invoices that were fine. Line: where the true share probably lies. Its left end is the worst likely case, and an approach passes only if that end is right of the 99% line. Checking each invoice is shown on the first ${int(d.sample_n)}-invoice sample; the rest on all ${int(d.held_out_n)} test invoices.</figcaption></figure>`;
}

function q1(d) {
  const c = d.policies.find((p) => p.chosen), [ck, cn] = c.held_out.precision;
  const cWrong = cn - ck, allowed = maxErrors(cn);
  const aPasses = d.a.held_out.coverage[0];
  const pe = d.bar.pass_everything.full.precision, peWrong = pe[1] - pe[0];
  const bp = d.b.sample.passed, be = d.b.sample.errors;
  const headline = `No contender earned trust at the 99% bar: ${aPasses === 0 ? "the fixed rule passes nothing" : `the fixed rule passes ${int(aPasses)}`}, and the policy Claude wrote passes ${pct(cn / d.held_out_n, 1)} of held-out invoices at ${pct(ck / cn, 2)} correct, just short of the bar (lower bound ${pct(c.held_out.precision_lower, 2)}).`;
  const cs = wilson(d.c_sample.passed - d.c_sample.errors, d.c_sample.passed)[0];
  const no = (t) => `<span class="state standby">${t}</span>`;
  const plain = `<h1 id="q1-h">Can an AI decide which invoices are safe to pay without a person checking?</h1>
  <p class="headline">Not at the bar we set. Claude's rulebook paid about half the invoices on its own and got about 99 in 100 of those right, just short of the proof we asked for.</p>
  ${summaryStrip(d)}
  <h2 class="sub">Why this study</h2>
  <p>Many companies are deciding where AI should take on work that people do today. The evidence is often a demo, or a pilot that "looked good". We wanted a stricter test on real records: take one decision staff make thousands of times, let an AI make it, and check every call against what really happened.</p>
  <h2 class="sub">Why invoices</h2>
  <p>The records are a large multinational company's purchasing for 2018. In them, staff decided ${int(d.candidates[0].manual_events)} times whether an invoice could be paid or needed checking. It is the most repeated of the decisions we sized, and every one has a known outcome: the payment either went through cleanly or someone had to fix it later. That lets us mark each AI call right or wrong. Q2 shows how it was chosen.</p>
  <h2 class="sub">The three AI understudies</h2>
  <ol class="plainlist understudies">
  <li><strong>A simple rule.</strong> Think of a fixed checklist. It looks at how often each kind of invoice went through cleanly from January to May. If a kind was clean almost every time, it pays that kind; otherwise it holds. There is no AI in it. It is the yardstick the AI must beat.</li>
  <li><strong>Claude checking each invoice.</strong> Think of a new staff member who reads every invoice and decides. Claude, an AI model, is given each invoice's details and the past records, and answers "pay" or "hold". It is careful, but it costs a request to the AI for every invoice.</li>
  <li><strong>Claude writing a rulebook.</strong> Think of a manager writing a policy once. Claude studies the past records and writes a short set of rules. Ordinary software then applies those rules to every invoice, instantly and almost for free. People can read the rules and check them.</li>
  </ol>
  ${journey(d)}
  <p>Each one made its calls on invoices from June to August 2018 that it had never seen: ${int(d.held_out_n)} in all, or a smaller sample for the costly one-by-one approach. We then compared its calls with what really happened.</p>
  <p><strong>The bar:</strong> of the invoices an AI pays without a check, no more than 1 in 100 may later need fixing. A short test can be lucky, so we judge each AI by its <em>worst likely case</em>: the lowest its true accuracy is likely to be, given how many invoices it handled. To pass, that worst likely case must be at least 99%.</p>
  ${wordsBox()}
  <div class="tablewrap"><table class="score"><caption>What each AI did</caption><thead><tr><th>Approach</th><th>Paid without a check</th><th>Later needed fixing</th><th>Proved 99%?</th></tr></thead><tbody>
  <tr><td>Pay every invoice (for comparison)</td><td>${int(pe[1])}</td><td>${int(peWrong)} (${oneIn(pe[1], peWrong)})</td><td>${no("No")}</td></tr>
  <tr><td>1. Simple rule</td><td>${int(aPasses)}</td><td>&ndash;</td><td>${no("Paid nothing")}</td></tr>
  <tr><td>2. Claude checking each invoice*</td><td>${int(bp)} of ${int(d.sample_n)}</td><td>${int(be)}</td><td>${no("Too few to tell")}</td></tr>
  <tr class="chosen"><td>3. Claude's rulebook</td><td>${int(cn)} (${pct(cn / d.held_out_n, 0)})</td><td>${int(cWrong)} (${oneIn(cn, cWrong)})</td><td>${no("Just short")}</td></tr>
  </tbody></table></div>
  <p class="small">* Checking each invoice costs a request to the AI every time, so it was first tested on ${int(d.sample_n)} invoices, not all ${int(d.held_out_n)}. A follow-up on ${d.b2 && d.b2.b_alone ? int(d.b2.b_alone.n) : "more"} new invoices is in Q3.</p>
  <p>Why "just short"? The rulebook paid ${int(cn)} invoices. To prove 99% with that many, at most ${int(allowed)} could need fixing. ${int(cWrong)} did: ${int(cWrong - allowed)} too many.</p>
  <ul class="bars budget" aria-label="Rulebook mistakes against the most it could make and still prove 99%">
  <li><span class="name">Most it could make</span><span class="track" aria-hidden="true"><span class="fill ok" style="width:${(allowed / cWrong) * 100}%"></span></span><span class="val">${int(allowed)}</span></li>
  <li class="hit"><span class="name">What it made</span><span class="track" aria-hidden="true"><span class="fill" style="width:100%"></span></span><span class="val">${int(cWrong)}</span></li>
  </ul>
  ${openButton("c_wrong_held_out", `See the ${int(cWrong)} invoices the rulebook paid wrongly`)}`;
  const detail = `<p class="headline">${esc(headline)}</p>
  <p><strong>What this means.</strong> None of the three earned trust. The simple rule never paid anything, so it never made a mistake, but it never saved any work either. Claude's rulebook paid ${pct(cn / d.held_out_n, 1)} of the test invoices without a check, and ${pct(ck / cn, 2)} of those were fine, so on average it met the bar. But its worst likely case (the "lower bound" above) is ${pct(c.held_out.precision_lower, 2)}, a hair under 99%. ${int(cWrong - allowed)} fewer mistakes out of ${int(cn)} would have changed the answer.</p>
  ${boundPlot(d)}
  <div class="verdict">
  <p class="say"><b><s>First comparison rule</s> <em>replaced, kept on the record</em></b><span>Nothing reached a worst likely case of 99% on the shared sample (rulebook ${pct(cs, 1)}, checking each invoice ${pct(d.b.lower, 1)}), so the simple rule wins by default.</span></p>
  <p class="say"><b>Final comparison rule</b><span>On all test invoices the rulebook's worst likely case is ${pct(c.held_out.precision_lower, 2)}, under 99%, so the simple rule wins by default again. It is an empty win: it pays ${int(aPasses)} of ${int(d.held_out_n)} invoices.</span></p>
  <p class="small">Why two rules? We changed how the approaches are compared partway through, after one result was known. To be open about it, both answers are shown, and they agree.</p>
  <p class="struck small">The comparison rule was changed after the first policy's held-out result was known and before any other contender ran; under the original rule no contender clears the bar and the fixed rule wins by default, and both verdicts are shown.</p></div>`;
  return section("q1", "Q1", "<h1", plain, detail, [
    `${int(d.held_out_n)} test invoices, locked with a fingerprint (checksum) before any understudy ran. No understudy saw how they turned out`,
    `Bar: the worst likely case (95% lower bound) of paid invoices being fine must be at least 99%`,
    `Three rulebooks written separately all landed between ${pct(Math.min(...d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1])), 2)} and ${pct(Math.max(...d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1])), 2)} fine`,
  ]);
}

/* ---------- Q1 summary strip and invoice journey ---------- */
function summaryStrip(d) {
  const c = d.policies.find((p) => p.chosen), [ck, cn] = c.held_out.precision, short = cn - ck - maxErrors(cn);
  const b2 = d.b2 && d.b2.b_alone ? d.b2.b_alone : null;
  const items = [
    ["A simple rule", "Paid nothing", "No kind of invoice had a clean enough record."],
    ["Claude checking each invoice", "Too few to tell", b2 ? `Paid ${pct(b2.coverage, 1)} of ${int(b2.n)} new invoices; not proven.` : "Paid too few to prove anything."],
    ["Claude's rulebook", `${int(short)} mistakes short`, `Paid ${pct(cn / d.held_out_n, 0)} of invoices, ${pct(ck / cn, 2)} fine.`],
  ];
  return `<ul class="strip" aria-label="The result for each approach">${items.map(([who, what, why], i) => `<li class="${i === 2 ? "near" : ""}"><span class="who">${esc(who)}</span><span class="what">${esc(what)}</span><span class="why">${esc(why)}</span></li>`).join("")}</ul>`;
}

function journeyLanes(d) {
  const pe = d.bar.pass_everything.full.precision, c = d.policies.find((p) => p.chosen), [ck, cn] = c.held_out.precision;
  const b2 = d.b2 && d.b2.b_alone ? d.b2.b_alone : null;
  const each = b2 ? [b2.passed, b2.wrong, b2.n] : [d.b.sample.passed, d.b.sample.errors, d.sample_n];
  return [
    { label: "Pay everything", note: "no AI, for comparison", paid: pe[1], wrong: pe[1] - pe[0], n: pe[1], faint: true },
    { label: "A simple rule", paid: d.a.held_out.coverage[0], wrong: 0, n: d.held_out_n },
    { label: "Claude checking each invoice", paid: each[0], wrong: each[1], n: each[2] },
    { label: "Claude's rulebook", paid: cn, wrong: cn - ck, n: d.held_out_n },
  ].map((l) => ({ ...l, pd: Math.round((l.paid / l.n) * 50), wd: Math.round((l.wrong / l.n) * 50) }));
}

function journey(d) {
  const lanes = journeyLanes(d);
  const dots = (k, cls) => `<i class="${cls}"></i>`.repeat(k);
  const rows = lanes.map((l) => `<div class="lane${l.faint ? " faint" : ""}">
    <p class="lane-lab"><strong>${esc(l.label)}</strong>${l.note ? ` <span>${esc(l.note)}</span>` : ""}</p>
    <div class="pile paid"><span class="pile-n">${l.pd * 2} in 100 paid</span><div class="dots">${dots(l.pd - l.wd, "paid")}${dots(l.wd, "fix")}</div></div>
    <div class="pile held"><span class="pile-n">${(50 - l.pd) * 2} in 100 held</span><div class="dots">${dots(50 - l.pd, "held")}</div></div>
  </div>`).join("");
  return `<figure class="journey" id="journey" aria-labelledby="journey-cap">
  <div class="journey-head"><p class="j-title">100 invoices, four ways to handle them</p><button type="button" class="replay" data-replay="journey">Play again</button></div>
  <div class="lanes" aria-hidden="true">${rows}</div>
  <figcaption id="journey-cap" class="small"><span class="sr">${lanes.map((l) => `${l.label}: ${l.pd * 2} in 100 paid without a check.`).join(" ")} </span>Each dot is two invoices. Red dots needed fixing: paying everything gets about ${oneIn(lanes[0].n, lanes[0].wrong)} wrong. The AI approaches' mistakes are too rare to show at this scale; the explorer in Q3 shows them.</figcaption>
</figure>`;
}

function wireJourney() {
  const root = document.getElementById("journey");
  if (!root) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const run = () => {
    if (still) return;
    root.classList.remove("go");
    root.querySelectorAll(".lane").forEach((lane, li) => {
      const left = lane.getBoundingClientRect().left;
      lane.querySelectorAll(".dots i").forEach((dot, i) => {
        dot.style.setProperty("--dx", `${left - dot.getBoundingClientRect().left}px`);
        dot.style.setProperty("--delay", `${li * 260 + i * 14}ms`);
      });
    });
    root.classList.add("ready");
    void root.offsetWidth;
    root.classList.add("go");
  };
  if (!still) root.classList.add("ready");
  const obs = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { run(); obs.disconnect(); } }, { threshold: 0.35 });
  obs.observe(root);
  root.querySelector("[data-replay]").addEventListener("click", run);
}

/* ---------- Q6 race: wrong payments, week by week ---------- */
function race(d) {
  const real = d.replay.timeline, agr = d.agreement.example_timeline;
  if (!agr) return "";
  const cum = (tl) => { let s = 0; return tl.map((x) => (s += x.wrong)); };
  const cr = cum(real), ca = cum(agr), n = Math.min(cr.length, ca.length);
  const narrow = matchMedia("(max-width: 600px)").matches;
  const W = narrow ? 360 : 640, H = narrow ? 230 : 260, L = 34, R = narrow ? 96 : 150, T = 18, B = 30;
  const top = Math.ceil(Math.max(...ca, ...cr) / 50) * 50;
  const x = (i) => L + (i / (n - 1)) * (W - L - R), y = (v) => T + (1 - v / top) * (H - T - B);
  const path = (c) => c.slice(0, n).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const wi = (w) => d.replay.weeks.indexOf(w);
  const fa = wi(d.agreement.example_first), fr = wi(d.replay.first);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="race-t race-d"><title id="race-t">Wrong payments added up week by week</title>
  <desc id="race-d">Switched on by agreement (one example run): ${int(ca[n - 1])} wrong payments by the end, first switched on in ${wk(d.agreement.example_first)}. Switched on by real results: ${int(cr[n - 1])}, first switched on in ${wk(d.replay.first)}.</desc>`;
  for (let v = 0; v <= top; v += top / 2) s += `<line class="tick" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${int(v)}</text>`;
  s += `<text x="${L}" y="${H - 8}">${esc(wk(d.replay.weeks[0]))}</text><text x="${x(n - 1)}" y="${H - 8}" text-anchor="end">${esc(wk(d.replay.weeks[n - 1]))}</text>`;
  s += `<path class="ln real" pathLength="1" d="${path(cr)}"/><path class="ln agr" pathLength="1" d="${path(ca)}"/>`;
  if (fa >= 0) s += `<circle class="mk agr" cx="${x(fa)}" cy="${y(ca[fa])}" r="4.5"/><text class="mk-t" x="${x(fa) + 6}" y="${y(ca[fa]) - 8}">on</text>`;
  if (fr >= 0) s += `<circle class="mk real" cx="${x(fr)}" cy="${y(cr[fr])}" r="4.5"/><text class="mk-t" x="${x(fr) + 6}" y="${y(cr[fr]) - 8}">on</text>`;
  s += `<text class="end agr" x="${x(n - 1) + 8}" y="${y(ca[n - 1]) + 5}">${int(ca[n - 1])} by agreement</text><text class="end real" x="${x(n - 1) + 8}" y="${y(cr[n - 1]) + 5}">${int(cr[n - 1])} by real results</text>`;
  return `<figure class="race" id="race"><div class="journey-head"><p class="j-title">Wrong payments, added up week by week</p><button type="button" class="replay" data-replay="race">Play again</button></div>${s}</svg>
  <figcaption class="small">One example run of the simulation, with reviewers copying 9 times in 10 (across 20 runs the middle result was about ${int(Math.floor(d.agreement.alphas["0.9"].wrong_median / 10) * 10)}). "On" marks the week the AI was first switched on.</figcaption></figure>`;
}

function wireRace() {
  const root = document.getElementById("race");
  if (!root) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const run = () => { root.classList.remove("go"); root.classList.add("ready"); void root.offsetWidth; root.classList.add("go"); };
  root.classList.add("ready");
  const obs = new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { run(); obs.disconnect(); } }, { threshold: 0.4 });
  obs.observe(root);
  root.querySelector("[data-replay]").addEventListener("click", run);
}

/* ---------- B follow-up (exact sentences from the decision record) ---------- */
function followUp(d) {
  const r = d.b2;
  if (!r || !r.b_alone) return "";
  const a = r.b_alone, v = r.b_vs_c, f1 = (x) => (x * 100).toFixed(1);
  const cCost = `$${(d.cost.c.usd / d.cost.c.calls).toFixed(2)}`, bCost = `$${((r.cost.usd * 1000) / a.n).toFixed(2)}`;
  const outcome = a.outcome === "proved"
    ? `On ${int(a.n)} new invoices, Claude judging each one passed ${int(a.passed)} (${f1(a.coverage)}%) and got ${int(a.wrong)} wrong. That proves it is right at least 99% of the time on what it passes (lower bound ${f1(a.lower)}%). It passes too few to count under the rule, which needs 10%.`
    : `On ${int(a.n)} new invoices, Claude judging each one passed ${int(a.passed)} (${f1(a.coverage)}%) and got ${int(a.wrong)} wrong. That does not prove 99%: the true rate could be as low as ${f1(a.lower)}%. No further run was made.` +
      (a.outcome === "below_bar" ? ` Even its best case, ${f1(a.upper)}%, is under 99%.` : "");
  const p = (v.winner === "B" ? v.p_B_better : v.p_C_better).toPrecision(2);
  const versus = v.winner === "B"
    ? `On the same invoices, Claude judging each one passed at least as many as the written policy (${int(v.B_passed)} against ${int(v.C_passed)}) and made fewer wrong passes the other avoided (${int(v.B_only)} against ${int(v.C_only)}). A gap this size is unlikely to be chance (p = ${p}).`
    : v.winner === "C"
    ? `On the same invoices, the written policy passed at least as many (${int(v.C_passed)} against ${int(v.B_passed)}) and made fewer wrong passes the other avoided (${int(v.C_only)} against ${int(v.B_only)}). A gap this size is unlikely to be chance (p = ${p}).`
    : `On the same invoices neither clearly beat the other: case-by-case passed ${int(v.B_passed)} with ${int(v.B_wrong)} wrong, the written policy ${int(v.C_passed)} with ${int(v.C_wrong)} wrong. The cheaper one is preferred: ${cCost} once against ${bCost} per 1,000 invoices.`;
  return `<h3>Follow-up: Claude checking each invoice, on ${int(a.n)} new invoices</h3>
  <p>This follow-up was run after the first results were seen, because the first sample was too small to settle the question. The prompt, model and settings were unchanged, and the invoices were new.</p>
  <p>${outcome}</p>
  <p>${versus}</p>
  <p class="small">In plain terms: checking each invoice was careful but paid only about ${Math.round(a.coverage * 100)} in 100 invoices, and even on those it could not show 99%. The rulebook paid far more for a fraction of the cost.</p>`;
}

/* ---------- Q2: the work ---------- */
const PLAIN_DECISION = {
  invoice_triage: "Pay this invoice now, or hold it for a check?",
  quantity_change_risk: "Will this new order need its quantity changed?",
  price_change_risk: "Will this new order need its price changed?",
};
const PLAIN_CLUE = {
  corrections_before_invoice: "Was the order changed before the invoice arrived?",
  vendor: "Which supplier it was",
};
function q2(d) {
  const max = Math.max(...d.work.map((w) => w.events));
  const triage = new Set(["Clear Invoice", "Remove Payment Block"]);
  const bars = d.work.map((w) => `<li class="${triage.has(w.activity) ? "hit" : ""}"><span class="name">${esc(w.activity)}</span>
    <span class="track" aria-hidden="true"><span class="fill" style="width:${(w.manual / max) * 100}%"></span><span class="fill batch" style="left:${(w.manual / max) * 100}%;width:${(w.batch / max) * 100}%"></span></span>
    <span class="val">${int(w.manual)}</span></li>`).join("");
  const k = d.log.kept, cand = d.candidates;
  const score = (x) => Math.round(x * 100);
  const rows = cand.map((c, i) => `<tr class="${i === 0 ? "chosen" : ""}"><td>${esc(PLAIN_DECISION[c.name] || c.name.replace(/_/g, " "))}</td><td>${int(c.manual_events)}</td><td>${score(c.rule_likeness)} / 100</td><td>${esc(PLAIN_CLUE[c.best_field] || c.best_field.replace(/_/g, " "))}</td></tr>`).join("");
  const plain = `<p>The records hold ${int(k.events)} steps. People did ${pct(k.manual / k.events, 0)} of them by hand. Below are the ten biggest jobs. Two of them are the "pay or check" decision (in bold).</p>
  <ul class="bars" aria-label="Steps done by hand, top ten jobs">${bars}</ul>
  <p class="small">Dark: done by a person. Blue: done automatically. Number: steps done by hand.</p>
  <h3>Why this decision, and what else could be tested</h3>
  <p>We compared three decisions that staff make over and over. Each one has a clear outcome in the records, so an AI's call can be checked against what really happened.</p>
  <div class="tablewrap"><table class="score"><caption>Decisions we sized</caption><thead><tr><th>Decision</th><th>Times done by hand</th><th>Tested here?</th></tr></thead><tbody>${cand.map((c, i) => `<tr class="${i === 0 ? "chosen" : ""}"><td>${esc(PLAIN_DECISION[c.name] || c.name.replace(/_/g, " "))}</td><td>${int(c.manual_events)}</td><td>${i === 0 ? "Yes" : "Not yet"}</td></tr>`).join("")}</tbody></table></div>
  <p>The invoice decision came first because it is made about ${int(Math.floor(cand[0].manual_events / cand[1].manual_events))} times as often as the next one, and past records predict it about as well. The other two were sized but not tested. The same test would work for them: the same bar, and the same proof before any trust.</p>
  <p>The biggest jobs in the chart, such as creating orders and recording deliveries, are data entry, not decisions. These records hold no document text, so they cannot show whether an AI could do that work.</p>`;
  const detail = `<p>Of ${int(k.events)} recorded steps, ${int(k.manual)} (${pct(k.manual / k.events, 0)}) were done by people under their own logins, ${int(k.batch)} by automatic jobs, and ${int(k.unclassified)} by accounts that are neither. ${int(d.log.users.manual)} people did the work by hand.</p>
  <p>For each decision we asked two things: how often people make it, and how predictable it already is. <strong>How predictable</strong> means: if you guessed the outcome from the single best clue in the earlier months' records, how often would you be right in the later months? It is scored so that 50 is a coin toss and 100 is never wrong. A middling score is a good place to test an AI: there is a pattern to learn, but no simple rule already does the job.</p>
  <div class="tablewrap"><table><caption>The decisions, side by side</caption><thead><tr><th>Decision</th><th>Times done by hand</th><th>How predictable</th><th>Best single clue</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return section("q2", "Q2", "Where people spend their time", plain, detail, [
    `Source: ${esc(d.source.name)} (${esc(d.source.licence)}), ${int(d.log.raw.events)} recorded steps`,
    `${int(d.log.excluded.duplicate_events)} same-minute duplicates and ${int(d.log.excluded.bad_date_events)} steps with impossible dates removed`,
    `"How predictable" is what statisticians call balanced accuracy, shown out of 100`,
  ]);
}

/* ---------- Q3: the audition ---------- */
function paths(d) {
  const pe = d.bar.pass_everything.full.precision, c = d.policies.find((p) => p.chosen), [ck, cn] = c.held_out.precision;
  const b2 = d.b2 && d.b2.b_alone ? d.b2.b_alone : null;
  const each = b2 ? { n: b2.n, paid: b2.passed, fix: b2.wrong, lower: b2.lower, where: `${int(b2.n)} new invoices (the follow-up)` }
    : { n: d.sample_n, paid: d.b.sample.passed, fix: d.b.sample.errors, lower: d.b.lower, where: `${int(d.sample_n)} invoices` };
  const allowed = maxErrors(cn);
  return [
    { key: "all", label: "Pay everything", n: pe[1], paid: pe[1], fix: pe[1] - pe[0], where: `all ${int(d.held_out_n)} test invoices`,
      does: "No AI and no checks: every invoice is paid. Shown for comparison.",
      verdict: `Fails. ${int(pe[1] - pe[0])} payments needed fixing, about ${oneIn(pe[1], pe[1] - pe[0])}. That is far worse than 1 in 100.` },
    { key: "a", label: "Simple rule", n: d.held_out_n, paid: d.a.held_out.coverage[0], fix: 0, where: `all ${int(d.held_out_n)} test invoices`,
      does: "A fixed checklist: pay a kind of invoice only if that kind was clean almost every time from January to May.",
      verdict: "Never made a mistake, because it never paid anything. No kind of invoice had a clean enough record to qualify, so it saved no work." },
    { key: "b", label: "Checking each invoice", n: each.n, paid: each.paid, fix: each.fix, where: each.where,
      does: "Claude reads each invoice and the past records, and answers \"pay\" or \"hold\", one invoice at a time.",
      verdict: `Not proven. It paid only ${int(each.paid)} of ${int(each.n)}, and ${int(each.fix)} needed fixing. Its worst likely case is ${pct(each.lower, 1)}, under 99%.` },
    { key: "c", label: "Rulebook", n: d.held_out_n, paid: cn, fix: cn - ck, where: `all ${int(d.held_out_n)} test invoices`,
      does: "Claude writes a short set of rules once; ordinary software applies them to every invoice.",
      verdict: `Just short. It paid about half, and ${pct(ck / cn, 2)} of those were fine. Its worst likely case is ${pct(c.held_out.precision_lower, 2)}, a hair under 99%: ${int(cn - ck - allowed)} fewer mistakes would have passed.` },
  ];
}
const per1k = (x, n) => { const v = (x / n) * 1000; return v === 0 ? "0" : v < 10 ? v.toFixed(1) : int(v); };

function explorer(d) {
  const ps = paths(d);
  return `<div class="explorer" id="explorer">
  <h3 class="ex-title">Follow 1,000 invoices through each approach</h3>
  <div class="seg" role="group" aria-label="Choose an approach">${ps.map((p, i) => `<button type="button" data-path="${p.key}" aria-pressed="${i === 3 ? "true" : "false"}">${esc(p.label)}</button>`).join("")}</div>
  <div class="ex-body">
    <div class="waffle" aria-hidden="true">${"<i></i>".repeat(1000)}</div>
    <div class="ex-text" aria-live="polite"></div>
  </div>
  <p class="legend"><span><i class="sw paid"></i>Paid, turned out fine</span><span><i class="sw fix"></i>Paid, later needed fixing</span><span><i class="sw held"></i>Held for a person</span></p>
  <p class="small">Each square is one invoice. Results are scaled to 1,000 invoices from each approach's own test (shown under the numbers) and rounded to whole squares, so a rare mistake still shows as one square.</p>
</div>`;
}

function wireExplorer(d) {
  const root = document.getElementById("explorer");
  if (!root) return;
  const ps = paths(d), cells = [...root.querySelectorAll(".waffle i")], text = $(".ex-text", root);
  const show = (key) => {
    const p = ps.find((x) => x.key === key);
    const paid = Math.round((p.paid / p.n) * 1000);
    let fix = Math.round((p.fix / p.n) * 1000);
    if (p.fix > 0 && fix === 0) fix = 1;
    cells.forEach((c, i) => (c.className = i < paid - fix ? "paid" : i < paid ? "fix" : "held"));
    root.querySelectorAll("[data-path]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.path === key)));
    text.innerHTML = `<h4>${esc(p.label)}</h4><p>${esc(p.does)}</p>
    <dl class="ex-nums"><div><dt>Paid without a check</dt><dd>${per1k(p.paid, p.n)}</dd></div><div><dt>Of those, needed fixing</dt><dd>${per1k(p.fix, p.n)}</dd></div><div><dt>Held for a person</dt><dd>${per1k(p.n - p.paid, p.n)}</dd></div></dl>
    <p class="ex-verdict">${esc(p.verdict)}</p><p class="small">Out of every 1,000, measured on ${esc(p.where)}.</p>`;
  };
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-path]"); if (b) show(b.dataset.path); });
  show("c");
}

function q3(d) {
  const row = (name, how, prec, cov, lower, clears, cls = "") => `<tr class="${cls}"><td>${name}</td><td>${how}</td><td>${cov}</td><td>${prec}</td><td>${lower}</td><td><span class="state ${clears ? "go" : "standby"}">${clears ? "Yes" : "No"}</span></td></tr>`;
  const a = d.a.held_out;
  const pols = d.policies.map((p) => {
    const h = p.held_out;
    return row(`Rulebook ${esc(p.policy)}`, `${int(p.rules)} rules. ${p.chosen ? "Picked in advance, using the learning months only" : "Not picked"}${p.seen_when_rule_written ? "; its result was seen before the final rule was set" : ""}`,
      ratio(h.precision, 2), ratio(h.coverage, 1), pct(h.precision_lower, 2), h.precision_lower >= 0.99, p.chosen ? "chosen" : "");
  }).join("");
  const bvc = d.b_vs_c, bLow = d.b.lower;
  const p1 = d.policies.find((p) => p.policy === 1);
  const rates = d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1]);
  const plain = `<p>Each AI saw only what was known when an invoice arrived, plus how often similar invoices had gone through cleanly from January to May 2018. Then it made its call on each June to August invoice. Pick an approach to see where 1,000 typical invoices end up.</p>
  ${explorer(d)}
  <ul>
  <li><strong>The simple rule</strong> pays a kind of invoice only if that kind had a clean enough record in earlier months to clear the bar. No kind did, so it paid nothing.</li>
  <li><strong>Claude checking each invoice</strong> made fewer wrong payments. On the same ${int(d.sample_n)} invoices, it paid ${int(bvc.B_passed)} and ${bvc.B_errors === 1 ? "1 needed" : int(bvc.B_errors) + " needed"} fixing. The rulebook paid ${int(bvc.C_passed)} and ${int(bvc.C_errors)} needed fixing. But ${int(bvc.B_passed)} invoices are too few to prove 99%, so the test could not call a winner between the two. The rulebook is far cheaper (see Q7), so it went forward. A larger follow-up, below, did not change this.</li>
  <li><strong>Claude's rulebook:</strong> Claude wrote three rulebooks separately. We picked one before testing, using only earlier months. All three got between ${pct(Math.min(...rates), 1)} and ${pct(Math.max(...rates), 1)} right on the invoices they paid. That is right at the edge of the bar. One of the other two did prove 99%, but it doesn't count: we had seen its result before the final comparison rule was set, and it wasn't the one picked beforehand.</li>
  </ul>
  ${openButton("b_passes_sample", `See the ${int(bvc.B_passed)} invoices Claude paid one by one`)}
  ${followUp(d)}`;
  const detail = `<p>Every understudy saw each invoice's own facts as they stood when it arrived, plus how often similar order lines created from January to May 2018 had gone through cleanly. They were scored on order lines created June to August 2018, and none of them saw how those turned out. The January to May rates use every outcome in the records, including some that only became known after the test invoices began to arrive.</p>
  <ul>
  <li><strong>The simple rule.</strong> Pay an invoice if its kind, in earlier months, was clean often enough to clear the bar on its own. No kind was, so it pays nothing.</li>
  <li><strong>Claude checking each invoice.</strong> A request to the AI for every invoice is too costly to run on all ${int(d.held_out_n)}, so it judged a ${int(d.sample_n)}-invoice sample, in ${int(d.cost.b.calls)} requests of 25 invoices each. Answers that failed our code checks count as "hold for a person".</li>
  <li><strong>Claude writing a rulebook.</strong> Claude saw only January to May summaries and wrote rules in a small, fixed format that software checks and then runs. It wrote three rulebooks separately. The one picked is the one that paid the most invoices in the learning months while still clearing the bar there.</li>
  </ul>
  <div class="tablewrap"><table><caption>All ${int(d.held_out_n)} test invoices</caption><thead><tr><th>Approach</th><th>About it</th><th>Paid on its own</th><th>Fine when paid</th><th>Worst likely case</th><th>Proved 99%?</th></tr></thead><tbody>
  ${row("Simple rule", `${int(d.a.cells)} kinds of invoice qualified`, "none", ratio(a.coverage, 1), "none", false)}${pols}</tbody></table></div>
  <p class="small">One of the three policies (policy ${esc(p1.policy)}) does clear the bar on held-out invoices (lower bound ${pct(p1.held_out.precision_lower, 2)}), but its result had been seen before the rule was rewritten and the earlier-month selection did not choose it, so it does not count towards the verdict; all three are shown.</p>
  <p class="small">In plain words: rulebook ${esc(p1.policy)} passed, but we had already seen its score before the final comparison rule was set, and it was not the one picked in advance. Counting it would be choosing the winner after the race, so it is shown but does not count.</p>
  <h3>Checking each invoice against the rulebook, on the same ${int(d.sample_n)} invoices</h3>
  <p>Checking each invoice paid ${int(bvc.B_passed)} and was wrong ${bvc.B_errors === 1 ? "once" : int(bvc.B_errors) + " times"} (worst likely case ${pct(bLow, 1)}). The rulebook paid ${int(bvc.C_passed)} and was wrong ${int(bvc.C_errors)} times. Looking only at mistakes one made and the other avoided: ${int(bvc.C_only_errors)} were the rulebook's and ${int(bvc.B_only_errors)} were the other's. A standard test says a gap that size is unlikely to be chance (p = ${bvc.p_B_better.toFixed(3)}; under 0.05 counts as unlikely). So checking each invoice made fewer mistakes, but it paid far fewer invoices. Under the rule we wrote down in advance, that is not enough to win, so cost decides: the rulebook.</p>
  ${openButton("c_only_errors_sample", `Open the ${int(bvc.C_only_errors)} mistakes only the rulebook made`)}`;
  return section("q3", "Q3", "How the three were tested", plain, detail, [
    `Checking each invoice against the simple rule: not shown to clear the bar (${ratio([bvc.B_passed, d.sample_n], 1)} paid, worst likely case ${pct(bLow, 1)})`,
    `No rulebook or instruction to the AI was changed after any test result was seen`,
    `The rulebook was picked using the learning months only; the test results of all three are published`,
  ]);
}

/* ---------- Q4: the bar ---------- */
function q4(d) {
  const pe = d.bar.pass_everything.full;
  const mc = d.bar.min_calls, top = Math.max(...mc.map((m) => m.calls));
  const bars = mc.map((m) => `<li><span class="name">${m.errors === 0 ? "No mistakes" : `${word(m.errors)[0].toUpperCase() + word(m.errors).slice(1)} mistake${m.errors === 1 ? "" : "s"}`}</span><span class="track" aria-hidden="true"><span class="fill" style="width:${(m.calls / top) * 100}%"></span></span><span class="val">${int(m.calls)}</span></li>`).join("");
  const c = d.policies.find((p) => p.chosen), cn = c.held_out.precision[1];
  const plain = `<p>A wrong "pay" means paying an invoice that, in the records, had to be corrected before it was cleared. Holding an invoice for a person counts as safe here. It just costs that person's time.</p>
  <p>Paying every invoice without a check sounds tempting: ${pct(pe.precision[0] / pe.precision[1], 0)} of them were fine. But that still leaves ${int(pe.precision[1] - pe.precision[0])} payments to fix, about ${oneIn(pe.precision[1], pe.precision[1] - pe.precision[0])}. So the bar is 99%: at most 1 in 100.</p>
  <h3>Why the average is not enough</h3>
  <p>A good score on a few invoices could just be luck, the way a coin can land heads five times in a row. An AI that paid 50 invoices with no mistakes has a perfect average, but that is too little evidence to trust it with thousands. So we use the worst likely case: the lowest the true accuracy could reasonably be, given how much evidence there is. More invoices means a tighter range, and a worst case closer to the average.</p>
  <p>The chart shows how many invoices an AI must pay before its worst likely case reaches 99%.</p>
  <ul class="bars proof" aria-label="Invoices an AI must pay to prove 99%, by number of mistakes">${bars}</ul>
  <p class="small">Bar: the fewest paid invoices needed to prove 99%, with that many mistakes among them.</p>
  <p>Early on, each extra mistake needs about ${int(Math.round((mc[mc.length - 1].calls - mc[0].calls) / (mc.length - 1) / 10) * 10)} more invoices to make up for it. At the far end, the rulebook paid ${int(cn)} invoices, so it could afford up to ${int(maxErrors(cn))} mistakes. It made ${int(c.held_out.precision[1] - c.held_out.precision[0])}.</p>`;
  const detail = `<p>A wrong call to pay is a payment that needed correcting. The bar asks for more than a good average: the worst likely case (statisticians call it the 95% lower bound) for how often paid invoices are fine must be at least 99%. That needs evidence as well as accuracy.</p>
  <p>Paying every test invoice would be right ${ratio(pe.precision, 2)} of the time, with a worst likely case of ${pct(pe.precision_lower, 2)}. Mostly right, and still not trustworthy: ${int(pe.precision[1] - pe.precision[0])} payments would have needed correcting.</p>
  <p class="small">The worst likely case is the Wilson score interval's lower end at z = ${d.bar.z.toFixed(2)}. "Prove" on this page means: 95% confident that the true rate is at least 99%.</p>`;
  return section("q4", "Q4", "Why 99%, and why ask for proof", plain, detail, [
    `The bar was raised from 90% to 99% before any approach ran, because paying everything already cleared 90%`,
  ]);
}

function wireSheet(id, d, states, describe) {
  const root = document.getElementById(id), input = $("input", root), out = $("output", root);
  const types = d.replay.cue_types;
  const draw = () => {
    const i = Number(input.value);
    root.querySelectorAll(".cell[data-i]").forEach((c) => {
      const ci = Number(c.dataset.i);
      c.classList.toggle("future", ci > i);
      c.classList.toggle("now", ci === i);
    });
    types.forEach((t, r) => {
      const s = states[t][i], el = root.querySelector(`[data-now="${r}"]`);
      el.textContent = PLAIN_STATE[s];
      el.className = "rowstate state " + s;
    });
    out.textContent = describe(i);
  };
  const scroller = $(".sheet-scroll", root);
  const follow = () => {
    const cell = root.querySelector(`.cell[data-r="0"][data-i="${input.value}"]`);
    if (cell) scroller.scrollLeft = Math.max(0, cell.offsetLeft - scroller.clientWidth + 120);
  };
  input.addEventListener("input", () => { draw(); follow(); });
  draw();
  follow();
}

function eventSentence(d) {
  const ev = d.replay.events, proms = ev.filter((e) => e.event === "promoted");
  const parts = proms.map((p) => {
    const dem = ev.find((e) => e.event === "demoted" && e.type === p.type && e.week > p.week);
    return `one in ${wk(p.week)} on ${int(p.evidence[0])} of ${int(p.evidence[1])}${proms.indexOf(p) === 0 ? " correct calls" : ""}${dem ? `, which was withdrawn in ${wk(dem.week)} after ${int(dem.recent[0])} of its last ${int(dem.recent[1])} were correct` : ""}`;
  });
  const lead = d.replay.a_promoted === 0 ? "On outcomes, the fixed rule earned no autonomy." : `On outcomes, the fixed rule earned autonomy in ${word(d.replay.a_promoted)} case types.`;
  return `${lead} The written policy earned it in ${word(proms.length)} case types: ${parts.join(", and ")}.`;
}

function plainEvents(d) {
  const ev = d.replay.events, proms = ev.filter((e) => e.event === "promoted");
  const wnum = (w) => Number(w.split("-W")[1].replace(/^0/, "")), yr = (w) => Number(w.split("-W")[0]);
  const gap = (a, b) => (yr(b) - yr(a)) * 52 + wnum(b) - wnum(a);
  if (!proms.length) return "The rulebook never earned trust for any kind of invoice.";
  const first = proms[0], dem = ev.find((e) => e.event === "demoted" && e.type === first.type && e.week > first.week);
  let s = `The rulebook earned trust for ${word(proms.length)} kind${proms.length === 1 ? "" : "s"} of invoice. The first came in ${wk(first.week)}, after ${int(first.evidence[0])} of its ${int(first.evidence[1])} practice calls proved right.`;
  if (dem) s += ` That trust was taken back ${word(gap(first.week, dem.week))} weeks later, when ${int(dem.recent[1] - dem.recent[0])} of its last ${int(dem.recent[1])} calls turned out wrong.`;
  if (proms[1]) s += ` The second came in ${wk(proms[1].week)}, near the end of the records.`;
  return s;
}

/* ---------- Q5 and Q6: cue sheets ---------- */
const kindLabel = (t) => { const [m, dept] = t.split(" / "); return `${dept}, ${/after GR/.test(m) ? "after delivery" : "before delivery"}`; };
function cueSheet(id, d, states, opts) {
  const weeks = d.replay.weeks, types = d.replay.cue_types;
  let g = `<div class="grid" style="--weeks:${weeks.length}" role="table" aria-label="${esc(opts.label)}"><div role="row" style="display:contents"><span role="columnheader" class="rowlab small">Kind of invoice</span>`;
  weeks.forEach((w) => (g += `<span role="columnheader" class="weekhead">${esc(w.split("-W")[1])}</span>`));
  g += `<span role="columnheader" class="rowstate small">Now</span></div>`;
  types.forEach((t, r) => {
    g += `<div role="row" style="display:contents"><span role="rowheader" class="rowlab" title="${esc(t)}">${esc(kindLabel(t))}</span>`;
    states[t].forEach((s, i) => (s = STATES.has(s) ? s : "unlit", g += `<span role="cell" class="cell ${s}" data-r="${r}" data-i="${i}" aria-label="${esc(weeks[i])}: ${PLAIN_STATE[s] || "no invoices"}"><i></i></span>`));
    g += `<span role="cell" class="rowstate state" data-now="${r}"></span></div>`;
  });
  g += "</div>";
  return `<div class="sheet" id="${id}"><div class="scrub"><label for="${id}-w">Week</label><input id="${id}-w" type="range" min="0" max="${weeks.length - 1}" value="${weeks.length - 1}"><output for="${id}-w" aria-live="polite"></output></div>
  <div class="sheet-scroll">${g}</div>
  <div class="legend"><span><span class="cell standby"><i></i></span>PRACTICE: the AI suggests, a person decides</span><span><span class="cell go"><i></i></span>ON: the AI pays this kind by itself</span><span><span class="cell cut"><i></i></span>OFF AGAIN: trust taken back</span></div></div>`;
}

function q5(d) {
  const t = d.replay.totals, ev = d.replay.events, proms = ev.filter((e) => e.event === "promoted");
  const wnum = (w) => Number(w.split("-W")[1]);
  const dem = proms[0] && ev.find((e) => e.event === "demoted" && e.type === proms[0].type && e.week > proms[0].week);
  const plain = `<p>So far the question was all or nothing: trust the AI with every invoice, or with none. In practice a company could switch it on gradually, one kind of invoice at a time, and only after it has proved itself on that kind. If it slips, it gets switched off again. We replayed June 2018 to January 2019 week by week, as if the rulebook had been used this way.</p>
  <ol class="plainlist">
  <li><strong>Practice.</strong> The AI suggests, and a person still decides. We keep score of whether its suggestions would have been right.</li>
  <li><strong>On.</strong> Once its practice calls on one kind of invoice prove 99%, it pays that kind by itself.</li>
  <li><strong>Off again.</strong> If its recent calls on that kind clearly drop below 99%, it goes back to practice.</li>
  </ol>
  <p><strong>How to read the chart:</strong> each row is a kind of invoice: the buying department, then whether the invoice came before or after the delivery. Each column is a week. Drag the slider to move through time and watch kinds switch on and off.</p>
  ${cueSheet("sheet-outcome", d, d.replay.states, { label: "Kinds of invoice switched on, by week" })}
  <h3>What happened</h3>
  <p>${esc(plainEvents(d))}</p>
  <p>While switched on, it paid ${int(t.passed)} invoices by itself and ${int(t.wrong)} needed fixing (about ${oneIn(t.passed, t.wrong)}). That is worse than the 1 in 100 bar. It also saved staff ${int(t.touches_removed)} steps done by hand.</p>
  <h3>What it means</h3>
  <p>Switching an AI on one kind at a time limits how much it can get wrong before it is caught, but it is slow and no guarantee. You only learn whether an invoice was paid correctly weeks after it arrives, so the proof builds slowly. Here the AI was first switched on in ${wk(d.replay.first)}${dem ? `, and switched off again ${word(wnum(dem.week) - wnum(proms[0].week))} weeks later` : ""}. A company taking this route should expect months of practice before the AI does real work, and should keep checking it after it is switched on.</p>
  <p class="small">Most of the ${int(t.wrong)} mistakes came from one kind of invoice, and the records end soon after the second kind was switched on, so ${int(t.passed)} is lower than a full year would give. This replay does not change the answer at the top.</p>
  ${openButton("replay_autonomous", `See the ${int(t.passed)} invoices it paid by itself`)}`;
  const detail = `<p>Each kind of invoice earns trust on its own, not all at once. A kind is switched on once its settled practice calls clear the bar. If even the best likely case (the 95% upper bound) of its last 200 settled calls falls below the bar, it is switched off again. A call only counts as evidence once its outcome is known.</p>
  <p>${esc(eventSentence(d))}</p>
  <p class="small">In plain words: the simple rule never earned trust for any kind of invoice. The rulebook earned it for two kinds. The first was switched off again later, after too many of its recent calls were wrong.</p>
  <p>While autonomous it passed ${int(t.passed)} invoices, ${int(t.wrong)} of them wrong (${pct(t.wrong / t.passed, 1)}, worse than the 99% bar), and removed ${int(t.touches_removed)} manual touches.</p>
  <p>Outcomes arrive weeks after invoices, so most held-out invoices had arrived before the first promotion.</p>`;
  return section("q5", `Q5 ${PLAIN_STATE[endState(d.replay.states)]}`, "Earning trust one kind of invoice at a time", plain, detail, [
    `Replayed with the picked rulebook over the test months, ${esc(d.replay.weeks[0])} to ${esc(d.replay.weeks[d.replay.weeks.length - 1])}`,
    `The replay is too short for results that arrive weeks late: the second kind was switched on in ${wk(proms.slice(-1)[0].week)} with few invoices left, so ${int(t.passed)} understates a normal year`,
    `The ${pct(t.wrong / t.passed, 1)} rests on ${int(t.wrong)} mistakes, mostly from one kind of invoice`,
    `The rulebook was written from January to May rates, about half of which rest on outcomes that became known after the replay's first week`,
    `This replay cannot overturn the answer above`,
  ], true);
}

function q6(d) {
  const A = d.agreement.alphas, a9 = A["0.9"], a7 = A["0.7"], a5 = A["0.5"], t = d.replay.totals;
  const wnum = (w) => Number(w.split("-W")[1]);
  const med = (xs) => { const v = [...xs].sort((p, q) => p - q), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const medWeek = (ws) => ws[0].split("-W")[0] + "-W" + String(med(ws.map(wnum))).padStart(2, "0");
  const gaps9 = a9.first.map((w) => wnum(d.replay.first) - wnum(w));
  const times = Math.round(a9.wrong_median / t.wrong);
  const round100 = (n) => int(Math.round(n / 100) * 100), down10 = (n) => Math.floor(n / 10) * 10;
  const pair = (label, a, b, fmtA, fmtB) => {
    const top = Math.max(a, b);
    return `<p class="pair-title">${label}</p><ul class="bars pair">
    <li><span class="name">Switched on by real results</span><span class="track" aria-hidden="true"><span class="fill" style="width:${Math.max(0.6, (a / top) * 100)}%"></span></span><span class="val">${fmtA}</span></li>
    <li class="hit"><span class="name">Switched on by agreement</span><span class="track" aria-hidden="true"><span class="fill" style="width:${(b / top) * 100}%"></span></span><span class="val">${fmtB}</span></li></ul>`;
  };
  const plain = `<p class="headline">People tend to go along with a computer's suggestion, even when it is wrong. This is called <em>automation bias</em>, and it can make a weak AI look trustworthy.</p>
  <p>A popular shortcut for switching an AI on goes like this: show its suggestions to staff, and once staff agree with it, say, 95% of the time, let it act alone. The trouble is that agreement can come from people copying the AI rather than checking it. Then a high agreement score tells you about the people, not the AI.</p>
  <h3>What we tested</h3>
  <p>We ran the same week-by-week replay as in Q5, but this time the AI was switched on when staff agreed with it, not when real results proved it right. The staff were simulated: they copy the AI's suggestion 9 times in 10. The other time they check properly and catch most of its mistakes. We ran this 20 times; the figures are the middle result of the 20 runs.</p>
  <h3>What happened</h3>
  ${race(d) || pair("Wrong payments while the AI was switched on", t.wrong, a9.wrong_median, int(t.wrong), `about ${int(down10(a9.wrong_median))}`)}
  ${pair("Invoices it paid by itself", t.passed, a9.passed_median, int(t.passed), `about ${round100(a9.passed_median)}`)}
  <p>Judged on agreement, the AI was switched on about ${word(Math.round(med(gaps9)))} weeks sooner, paid far more invoices by itself, and made ${word(times)} times as many wrong payments. Each payment was less likely to be wrong (about ${pct(a9.wrong_median / a9.passed_median, 1)} against ${pct(t.wrong / t.passed, 1)}), but only because the rulebook happens to be about 99% right. A much worse AI would have been agreed with nearly as often.</p>
  <p class="callout"><strong>The agreement it was switched on for was mostly copied. It measured the reviewers, not the AI.</strong></p>
  <h3>What to do instead</h3>
  <ul>
  <li>Judge the AI on real outcomes, such as whether the payment later needed fixing, not on whether people agreed with it.</li>
  <li>Spot-check blind: now and then, have a person decide without seeing the AI's suggestion, and compare.</li>
  <li>Track how often people overrule the AI. If they almost never do, treat that as a warning sign, not a success.</li>
  </ul>
  <p class="small">This is a simulation. How often real reviewers copy is an assumption here, not a measurement. The steps under "What to do instead" follow from this but were not tested here.</p>`;
  const detail = `<p>The simulation runs the same replay with agreement as the switch instead of outcomes. A simulated reviewer copies the suggestion some share of the time. Otherwise the reviewer catches a wrong "pay" 4 times in 5, and wrongly flags a right one 1 time in 50. The chart shows one example run with reviewers copying 9 times in 10.</p>
  ${cueSheet("sheet-agree", d, d.agreement.example_states, { label: "Simulated agreement shortcut, one example run, reviewers copying 9 in 10" })}
  <p>Simulated: with reviewers copying 9 suggestions in 10, the agreement gate first promoted about ${int(med(gaps9))} weeks sooner (median ${wk(medWeek(a9.first))} against ${wk(d.replay.first)}; range ${int(Math.min(...gaps9))}\u2013${int(Math.max(...gaps9))} weeks across 20 runs) and passed ${half(a9.passed_median)} invoices, ${half(a9.wrong_median)} of them wrong (medians of 20 runs; range ${int(a9.wrong_range[0])}\u2013${int(a9.wrong_range[1])}), against ${int(t.passed)} and ${int(t.wrong)} on outcomes. That is ${word(times)} times the wrong payments, at a lower rate per pass (${pct(a9.wrong_median / a9.passed_median, 2)} against ${pct(t.wrong / t.passed, 1)}).</p>
  <p>At 0.7 it promoted in ${int(a7.promoted_runs)} of 20 runs, the earliest in ${wk(a7.first[0])}, and passed ${half(a7.passed_median)} invoices, ${half(a7.wrong_median)} of them wrong (medians of 20 runs; range ${int(a7.wrong_range[0])}\u2013${int(a7.wrong_range[1])}). At 0.5 it promoted in ${int(a5.promoted_runs)} of 20 runs.</p>
  <p class="small">In plain words: when reviewers copy 7 times in 10, the AI was still switched on in most runs. When they copy half the time, it almost never was, because honest checking caught enough mistakes to keep agreement low.</p>
  <p>The agreement it promoted on was mostly copied, so it measured the reviewers, not the helper.</p>`;
  return section("q6", "Q6", "What if you trust it because people agree with it?", plain, detail, [
    `This section is a simulation; how often reviewers copy is an assumption, not a measurement of real people`,
    `The low mistake rate per payment comes from a rulebook that is about 99% right. With these settings, an AI wrong 5% of the time would still see about 99.4% agreement when reviewers copy 9 in 10 (arithmetic, not a run)`,
    `In the simulation, real results can still switch the AI off`,
  ], true);
}

/* ---------- Q7: cost at volume ---------- */
function q7(d) {
  const b = d.cost.b, c = d.cost.c, per = 1000 / d.sample_n;
  const bPer1k = d.b2 && d.b2.cost && d.b2.b_alone ? (d.b2.cost.usd * 1000) / d.b2.b_alone.n : b.usd * per;
  const minPer1k = d.b2 && d.b2.cost && d.b2.b_alone ? (d.b2.cost.wall_s * 1000) / d.b2.b_alone.n / 60 : (b.wall_s * per) / 60;
  const cOnce = c.usd / c.calls, secPerInv = d.cost.c_run_s_all_held_out / d.held_out_n;
  const money = (x) => (x < 100 ? `$${x.toFixed(2)}` : x < 10000 ? `$${int(Math.round(x / 10) * 10)}` : `$${int(Math.round(x / 1000) * 1000)}`);
  const plural = (n, w) => `${int(n)} ${w}${n === 1 ? "" : "s"}`;
  const hours = (m) => {
    if (m < 60) return plural(Math.max(1, Math.round(m)), "minute");
    const h = Math.round(m / 60), days = Math.floor(h / 24), rest = h % 24;
    return days ? `${plural(days, "day")}${rest ? `, ${plural(rest, "hour")}` : ""}` : plural(h, "hour");
  };
  const secs = (s) => (s < 1 ? "under a second" : s < 120 ? `${Math.round(s)} seconds` : `${Math.round(s / 60)} minutes`);
  const vols = [d.candidates[0].manual_events, 1e6, 1e7];
  const rows = vols.map((v, i) => `<tr><td>${int(v)}${i === 0 ? " (pay-or-check decisions made by hand in these records)" : ""}</td><td>${money((bPer1k * v) / 1000)}<span class="sub">${hours((minPer1k * v) / 1000)} of AI time</span></td><td>${money(cOnce * 12)}<span class="sub">${secs(secPerInv * v)} of computer time</span></td></tr>`).join("");
  const plain = `<p>Both Claude approaches used the same AI model. Prices are what the same work would cost at Claude's standard published rates.</p>
  <div class="cost">
  <div><span class="small">Claude checking each invoice</span><span class="big">$${bPer1k.toFixed(2)}</span><span class="small">and about ${Math.round(minPer1k)} minutes of AI time for every 1,000 invoices, again and again.</span></div>
  <div><span class="small">Claude writing a rulebook</span><span class="big">$${cOnce.toFixed(2)}</span><span class="small">once per rulebook. Ordinary software then handled all ${int(d.held_out_n)} test invoices in ${secs(d.cost.c_run_s_all_held_out)}.</span></div>
  </div>
  <h3>At scale</h3>
  <p>Checking each invoice costs more with every invoice. A rulebook costs the same however many invoices it handles. The table assumes the rulebook is rewritten every month, which is 12 rulebooks a year.</p>
  <div class="tablewrap"><table class="score scale"><caption>Cost per year, by invoice volume</caption><thead><tr><th>Invoices a year</th><th>Checking each invoice</th><th>Rulebook, rewritten monthly</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p>At this volume, either AI bill is small; at 10 million invoices a year, checking each one costs tens of thousands of dollars, while the rulebook stays under $5. The bigger difference is control: a rulebook can be read, tested and approved like any other company policy before it touches a payment. Decisions made one by one can't be approved in advance, only sampled and checked as they are made.</p>
  <p class="small">AI time assumes requests are made one after another; running several at once would shorten it but not cost less. Prices are list prices at the time of the test and change over time.</p>`;
  const detail = `<p>Costs are what the same amount of text sent to and from the AI would cost at list prices. Time is measured from start to finish, with requests made one after another. Checking each invoice took ${int(b.calls)} requests for the first ${int(d.sample_n)} invoices${d.b2 && d.b2.cost && d.b2.b_alone ? ` and ${int(d.b2.cost.calls)} for the ${int(d.b2.b_alone.n)}-invoice follow-up` : ""}. ${int(c.calls)} rulebooks were written; software ran all ${int(d.held_out_n)} test invoices in ${d.cost.c_run_s_all_held_out.toFixed(2)} seconds.</p>`;
  return section("q7", "Q7", "What each approach costs", plain, detail, [
    `Checking each invoice: ${int(b.input_tokens)} units of text in and ${int(b.output_tokens)} out (tokens) for the first sample`,
    `Rulebook: ${int(c.input_tokens)} tokens in and ${int(c.output_tokens)} out for three rulebooks`,
    `Costs leave out the overhead of the command-line tool used to send the requests`,
    ...(d.b2 && d.b2.cost && d.b2.b_alone ? [`Follow-up run of checking each invoice: ${int(d.b2.cost.calls)} requests for ${int(d.b2.b_alone.n)} invoices, $${d.b2.cost.usd.toFixed(2)} at list prices`] : []),
  ]);
}

const dayLong = (iso) => { const [y, m, dd] = iso.split("-").map(Number); return `${dd} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`; };
const endState = (states) => { const last = Object.values(states).map((r) => r[r.length - 1]); return last.includes("go") ? "go" : last.includes("cut") ? "cut" : "standby"; };
const STATES = new Set(["unlit", "standby", "go", "cut"]);
const PLAIN_STATE = { go: "ON", standby: "PRACTICE", cut: "OFF", unlit: "" };

/* ---------- Method ---------- */
function method(d) {
  const adrs = d.adrs.map((a) => `<li><span class="n">${esc(a.n)}</span><span class="${a.replaced_by ? "replaced" : ""}">${esc(a.title)}${a.amendments ? ` <em>${int(a.amendments)} amendment${a.amendments > 1 ? "s" : ""}</em>` : ""}${a.replaced_by ? ` <em>partly replaced by ${esc(a.replaced_by)}</em>` : ""}</span></li>`).join("");
  const body = `<p>The data is the ${esc(d.source.name)} event log (DOI ${esc(d.source.doi)}, ${esc(d.source.licence)}). The log was parsed in one pass and every total recounted by a second, independent program; both match the published counts.</p>
  <details><summary>The rules, in the order they were written</summary>
  <p class="small">Every rule was written down before the run it governs. Rules replaced later stay on the record, struck through, with the reason in the decision record.</p>
  <ol class="adrs">${adrs}</ol></details>
  <details><summary>Data checks</summary><ul>
  <li>${int(d.log.excluded.bad_date_events)} events dated outside 2017\u20132019 removed.</li>
  <li>${int(d.log.excluded.duplicate_events)} same-minute identical events collapsed; most were bulk service entries.</li>
  <li>${int(d.log.flagged_before_creation)} events dated before their order line was created are flagged, not removed.</li>
  <li>Order lines created after August 2018 are excluded: most had not finished when the log ends.</li></ul></details>
  <details><summary>Limits</summary><ul>
  <li>The data is from 2018 and has no free text, so no invoice wording was read.</li>
  <li>"Straight through" means no correction between the first invoice receipt and payment; corrections after payment are not seen.</li>
  <li>The agreement gate is a simulation with assumed reviewer behaviour.</li>
  <li>B was scored on a ${int(d.sample_n)}-invoice sample, which cannot show a 99% lower bound at a 1% error rate.</li>
  <li>The builder saw held-out outcomes three times before the last rule was written: when ranking the candidate decisions, when the held-out base rate (${ratio(d.bar.pass_everything.full.precision, 2)}) showed the first bar was too low, and when the first policy was scored before the comparison rule was replaced. Each is in the decision records.</li>
  <li>Earlier months are split by when the order line was created, not by when its outcome was known. ${int(d.lookahead.landed_on_or_after)} of the ${int(d.lookahead.fit_outcomes)} earlier-month outcomes (${pct(d.lookahead.landed_on_or_after / d.lookahead.fit_outcomes, 0)}) landed on or after ${dayLong(d.lookahead.first_heldout_day)}, the day the first held-out invoice arrived. So every understudy, and every week of the replay, used some rates a live system would not yet have had. No held-out outcome was used in those rates. The results were not recomputed with only the rates known at the time.</li></ul></details>
  <p class="small">Built from data on ${esc(d.built)}.</p>`;
  return section("method", "M", "How this was done", body, null);
}

/* ---------- Drawer ---------- */
const SETS = {
  c_wrong_held_out: ["Invoices the rulebook paid wrongly", "Test invoices the picked rulebook paid without a check that later needed fixing."],
  b_passes_sample: ["Invoices Claude paid one by one", "Sample invoices Claude paid without a check. Outcome shows what really happened."],
  c_only_errors_sample: ["Mistakes only the rulebook made", "Sample invoices the rulebook paid wrongly that Claude, checking one by one, held for a person."],
  replay_autonomous: ["Paid by the AI itself in the replay", "Invoices the rulebook paid while that kind of invoice was switched on."],
};
let lastFocus = null, DATA = null;

function openDrawer(set, all = false) {
  const rows = DATA.drawer[set], [title, note] = SETS[set], dr = $("#drawer");
  const shown = all ? rows : rows.slice(0, 200);
  const hasWeek = rows.length && "week" in rows[0];
  $("#drawer-title").textContent = `${title} (${int(rows.length)})`;
  $("#drawer-note").textContent = note;
  $("#drawer-body").innerHTML = `<table><thead><tr><th>Invoice line</th><th>Kind of invoice</th>${hasWeek ? "<th>Week</th>" : ""}<th>Value (EUR)</th><th>Outcome</th></tr></thead><tbody>${shown.map((r) =>
    `<tr><td>${esc(r.id)}</td><td style="text-align:left">${esc(r.type)}</td>${hasWeek ? `<td>${esc(r.week.split("-W")[1])}</td>` : ""}<td>${r.value == null ? "" : int(r.value)}</td><td><span class="state ${r.straight_through ? "go" : "standby"}">${r.straight_through ? "PAID CLEAN" : "CORRECTED"}</span></td></tr>`).join("")}</tbody></table>
    ${shown.length < rows.length ? `<button type="button" class="open more" data-all="${set}">Show all ${int(rows.length)}</button>` : ""}`;
  if (dr.hidden) lastFocus = document.activeElement;
  dr.hidden = false;
  dr.focus();
}
function closeDrawer() { $("#drawer").hidden = true; if (lastFocus) lastFocus.focus(); }

/* ---------- Boot ---------- */
async function boot() {
  const main = $("#content");
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch (e) {
    main.innerHTML = `<p class="loading">The findings data could not be loaded (${esc(e.message)}). Reload the page to try again.</p>`;
    return;
  }
  const d = DATA;
  main.innerHTML = [q1, q2, q3, q4, q5, q6, q7, method].map((f) => f(d)).join("");
  wireExplorer(d);
  wireJourney();
  wireRace();
  const t = d.replay.timeline;
  let cum = [];
  t.reduce((acc, x, i) => (cum[i] = { p: acc.p + x.passed, w: acc.w + x.wrong }), { p: 0, w: 0 });
  wireSheet("sheet-outcome", d, d.replay.states, (i) => `Week ${t[i].week.split("-W")[1]} of ${t[i].week.split("-W")[0]}: ${word(t[i].autonomous_types)} kind${t[i].autonomous_types === 1 ? "" : "s"} of invoice switched on. Paid by itself so far: ${int(cum[i].p)}, ${int(cum[i].w)} needed fixing.`);
  wireSheet("sheet-agree", d, d.agreement.example_states, (i) => {
    const n = d.replay.cue_types.filter((ty) => d.agreement.example_states[ty][i] === "go").length;
    return `Week ${d.replay.weeks[i].split("-W")[1]}: ${word(n)} kind${n === 1 ? "" : "s"} of invoice switched on in this example run (simulated).`;
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-set]"), all = e.target.closest("[data-all]");
    if (b) openDrawer(b.dataset.set);
    else if (all) openDrawer(all.dataset.all, true);
    else if (e.target.closest("[data-close]")) closeDrawer();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });

  const verdictGo = d.policies.some((p) => p.chosen && p.held_out.precision_lower >= 0.99);
  const LAMPS = { q1: verdictGo ? "go" : "standby", q3: verdictGo ? "go" : "standby", q5: endState(d.replay.states), q6: endState(d.agreement.example_states) };
  document.querySelectorAll(".cues a").forEach((a) => {
    const st = LAMPS[a.getAttribute("href").slice(1)];
    if (!st) return;
    const lamp = a.querySelector(".lamp");
    lamp.classList.add(st);
    lamp.insertAdjacentHTML("afterend", `<span class="sr">(${PLAIN_STATE[st]})</span>`);
  });
  const links = [...document.querySelectorAll(".cues a, .tabs a")];
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => (a.getAttribute("href") === "#" + en.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  document.querySelectorAll("main section").forEach((s) => obs.observe(s));
}

$(".theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) { /* storage blocked: theme still switches */ }
});
boot();
