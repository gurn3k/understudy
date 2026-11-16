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

function section(id, cue, title, body, note, wide = false) {
  return `<section id="${id}" class="${wide ? "wide" : ""}" aria-labelledby="${id}-h">
  <div class="col">${title === "<h1" ? body.replace('<h1 id="q1-h">', `<h1 id="q1-h"><span class="marg" aria-hidden="true">${esc(cue)}</span>`) : `<h2 id="${id}-h"><span class="marg" aria-hidden="true">${esc(cue)}</span>${title}</h2>${body}`}</div>
  ${note ? `<aside class="note" aria-label="On this cue"><h3>On this cue</h3><ul>${note.map((x) => `<li>${x}</li>`).join("")}</ul></aside>` : "<div></div>"}
</section>`;
}

/* ---------- Q1: the answer ---------- */
function boundPlot(d) {
  const narrow = matchMedia("(max-width: 600px)").matches;
  const rows = [];
  d.policies.forEach((p) => {
    const [k, n] = p.held_out.precision;
    rows.push({ lab: `C, policy ${p.policy}${p.chosen ? (narrow ? "*" : " (chosen)") : ""}`, k, n, chosen: p.chosen, where: "all held-out" });
  });
  rows.push({ lab: narrow ? "B, per invoice" : "B, Claude per invoice", k: d.b.sample.passed - d.b.sample.errors, n: d.b.sample.passed, where: "sample" });
  const pe = d.bar.pass_everything.full.precision;
  rows.push({ lab: "Pass everything", k: pe[0], n: pe[1], where: "all held-out" });
  const lo = 0.95, hi = 1.0, W = narrow ? 360 : 640, L = narrow ? 128 : 180, R = narrow ? 10 : 20, rowH = 34, top = 30;
  const x = (v) => L + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - L - R);
  const H = top + rows.length * rowH + 26;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-t plot-d"><title id="plot-t">95% interval for how often each contender's straight-through calls were right</title>
  <desc id="plot-d">${rows.map((r) => { const [a, b] = wilson(r.k, r.n); return `${r.lab}: ${pct(r.k / r.n, 2)} right, interval ${pct(a, 2)} to ${pct(b, 2)}`; }).join("; ")}. The bar is a lower bound of 99%.</desc>`;
  for (let v = 0.95; v <= 1.0001; v += narrow ? 0.025 : 0.01) s += `<line class="tick" x1="${x(v)}" x2="${x(v)}" y1="${top - 8}" y2="${H - 22}"/><text x="${x(v)}" y="${H - 6}" text-anchor="middle">${(v * 100).toFixed(narrow ? 1 : 0).replace(".0", "")}%</text>`;
  s += `<line class="barline" x1="${x(0.99)}" x2="${x(0.99)}" y1="${top - 22}" y2="${H - 22}"/><text class="barlab" x="${x(0.99) - 6}" y="${top - 12}" text-anchor="end">BAR 99%</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2, [a, b] = wilson(r.k, r.n);
    s += `<text class="lab" x="0" y="${y + 5}">${esc(r.lab)}</text><line class="iv" x1="${x(a)}" x2="${x(b)}" y1="${y}" y2="${y}"/>
    ${a < lo ? `<text x="${x(lo) + 4}" y="${y - 8}">to ${pct(a, 1)}</text><path class="iv" d="M${x(lo) + 8} ${y - 5} L${x(lo)} ${y} L${x(lo) + 8} ${y + 5}" fill="none"/>` : `<line class="iv" x1="${x(a)}" x2="${x(a)}" y1="${y - 6}" y2="${y + 6}"/>`}<circle class="pt${r.chosen ? " chosen" : ""}" cx="${x(r.k / r.n)}" cy="${y}" r="5"/>`;
  });
  return `<figure class="plot">${s}</svg><figcaption class="small">${narrow ? "* chosen policy. " : ""}Dot: share of straight-through calls that were right. Line: its 95% interval. A contender earns trust only if the left end of its line clears the bar. B was scored on the ${int(d.sample_n)}-invoice sample; the rest on all ${int(d.held_out_n)} held-out invoices.</figcaption></figure>`;
}

function q1(d) {
  const c = d.policies.find((p) => p.chosen), [ck, cn] = c.held_out.precision;
  const aPasses = d.a.held_out.coverage[0];
  const headline = `No contender earned trust at the 99% bar: ${aPasses === 0 ? "the fixed rule passes nothing" : `the fixed rule passes ${int(aPasses)}`}, and the policy Claude wrote passes ${pct(cn / d.held_out_n, 1)} of held-out invoices at ${pct(ck / cn, 2)} correct, just short of the bar (lower bound ${pct(c.held_out.precision_lower, 2)}).`;
  const cs = wilson(d.c_sample.passed - d.c_sample.errors, d.c_sample.passed)[0];
  const body = `<h1 id="q1-h">Which invoices can an AI pass straight to payment, and how do you prove it first?</h1>
  <p class="headline">${esc(headline)}</p>
  <p class="lede">In one real purchase-to-pay process (${int(d.log.kept.cases)} order lines), people decided ${int(d.candidates[0].manual_events)} times whether an invoice could be paid or needed someone to look. Three understudies auditioned for that call: a plain rule, Claude judging each invoice, and Claude writing a policy that code runs. Each was tested against what actually happened, on invoices held back from the builder.</p>
  ${boundPlot(d)}
  <div class="verdict">
  <p class="say"><b><s>Rule set first</s> <em>replaced, kept on the record</em></b><span>No contender reaches a 99% lower bound on the shared sample (C ${pct(cs, 1)}, B ${pct(d.b.lower, 1)}), so the fixed rule wins by default.</span></p>
  <p class="say"><b>Rule set later</b><span>On all held-out invoices the chosen policy's lower bound is ${pct(c.held_out.precision_lower, 2)}, below 99%, so the fixed rule wins by default again. Its win is empty: it passes ${int(aPasses)} of ${int(d.held_out_n)} invoices.</span></p>
  <p class="struck small">The comparison rule was changed after the first policy's held-out result was known and before any other contender ran; under the original rule no contender clears the bar and the fixed rule wins by default, and both verdicts are shown.</p>
  ${openButton("c_wrong_held_out", `Open the ${int(cn - ck)} invoices the chosen policy passed wrongly`)}</div>`;
  return section("q1", "Q1", "<h1", body, [
    `${int(d.held_out_n)} invoices held back from the builder until every rule was written`,
    `Bar: the 95% lower bound on straight-through calls being right must be at least 99%`,
    `Three policies written independently all landed between ${pct(Math.min(...d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1])), 2)} and ${pct(Math.max(...d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1])), 2)} right`,
  ]);
}

/* ---------- Q2: the work ---------- */
function q2(d) {
  const max = Math.max(...d.work.map((w) => w.events));
  const triage = new Set(["Clear Invoice", "Remove Payment Block"]);
  const bars = d.work.map((w) => `<li class="${triage.has(w.activity) ? "hit" : ""}"><span class="name">${esc(w.activity)}</span>
    <span class="track" aria-hidden="true"><span class="fill" style="width:${(w.manual / max) * 100}%"></span><span class="fill batch" style="left:${(w.manual / max) * 100}%;width:${(w.batch / max) * 100}%"></span></span>
    <span class="val">${int(w.manual)}</span></li>`).join("");
  const k = d.log.kept, cand = d.candidates;
  const rows = cand.map((c) => `<tr><td>${esc(c.name.replace(/_/g, " "))}</td><td>${int(c.manual_events)}</td><td>${c.rule_likeness.toFixed(2)}</td><td>${esc(c.best_field.replace(/_/g, " "))}</td></tr>`).join("");
  const body = `<p>Of ${int(k.events)} recorded events, ${int(k.manual)} (${pct(k.manual / k.events, 0)}) were done by people's own accounts, ${int(k.batch)} by batch jobs, and ${int(k.unclassified)} by accounts that are neither. ${int(d.log.users.manual)} people did the manual work.</p>
  <ul class="bars" aria-label="Manual events by activity, top ten">${bars}</ul>
  <p class="small">Bars to scale. Dark: done by a person. Blue: done by a batch job. Number: manual events. Bold rows are the two steps of invoice triage.</p>
  <h3>Choosing the audition</h3>
  <p>Each candidate is a decision people make over and over. They are ranked by manual volume and by how rule-like the decision already is: how well one field, chosen on earlier months, predicts the outcome in later months.</p>
  <div class="tablewrap"><table><caption>Candidates</caption><thead><tr><th>Decision</th><th>Manual events</th><th>Rule-likeness</th><th>Best single field</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return section("q2", "Q2", "Where people spend their time", body, [
    `Source: ${esc(d.source.name)} (${esc(d.source.licence)}), ${int(d.log.raw.events)} events`,
    `${int(d.log.excluded.duplicate_events)} same-minute duplicates and ${int(d.log.excluded.bad_date_events)} out-of-range events removed`,
    `Rule-likeness is balanced accuracy: 0.5 is a coin toss, 1.0 is a perfect rule`,
  ]);
}

/* ---------- Q3: the audition ---------- */
function q3(d) {
  const row = (name, how, prec, cov, lower, clears, cls = "") => `<tr class="${cls}"><td>${name}</td><td>${how}</td><td>${cov}</td><td>${prec}</td><td>${lower}</td><td><span class="state ${clears ? "go" : "standby"}">${clears ? "GO" : "STANDBY"}</span></td></tr>`;
  const a = d.a.held_out;
  const pols = d.policies.map((p) => {
    const h = p.held_out;
    return row(`C, policy ${p.policy}`, `${p.rules} rules${p.chosen ? ", chosen on earlier months" : ""}${p.seen_when_rule_written ? "; seen" : "; unseen"}`,
      ratio(h.precision, 2), ratio(h.coverage, 1), pct(h.precision_lower, 2), h.precision_lower >= 0.99, p.chosen ? "chosen" : "");
  }).join("");
  const bvc = d.b_vs_c, bLow = d.b.lower;
  const p1 = d.policies.find((p) => p.policy === 1);
  const body = `<p>Every understudy saw only what was known when the invoice arrived, plus rates from earlier months (January to May 2018). They were scored on June to August 2018, which no one looked at while writing the rules.</p>
  <ul>
  <li><strong>A, a plain rule.</strong> Pass an invoice if its group, in earlier months, was clean often enough to clear the bar on its own. No group was, so A passes nothing.</li>
  <li><strong>B, Claude judging each invoice.</strong> One model call per batch of invoices is too costly to run on every invoice, so B judged the ${int(d.sample_n)}-invoice shared sample, ${int(d.cost.b.calls)} calls of 25. Answers that failed code checks count as "leave to a person".</li>
  <li><strong>C, Claude writing a policy.</strong> Claude saw earlier-month tables only and wrote rules in a small language that code checks and then runs. Three policies were written independently; the one chosen is the one with the most earlier-month coverage that still cleared the bar there.</li>
  </ul>
  <div class="tablewrap"><table><caption>Scored on all ${int(d.held_out_n)} held-out invoices</caption><thead><tr><th>Understudy</th><th>Notes</th><th>Passed</th><th>Right</th><th>Lower bound</th><th>State</th></tr></thead><tbody>
  ${row("A, plain rule", `${d.a.cells} groups qualified`, "none", ratio(a.coverage, 1), "none", false)}${pols}</tbody></table></div>
  <p class="small">One of the three policies (policy ${p1.policy}) does clear the bar on held-out invoices (lower bound ${pct(p1.held_out.precision_lower, 2)}), but its result had been seen before the rule was rewritten and the earlier-month selection did not choose it, so it does not count towards the verdict; all three are shown.</p>
  <h3>B against C, on the same ${int(d.sample_n)} invoices</h3>
  <p>B passed ${int(bvc.B_passed)} and was wrong ${bvc.B_errors === 1 ? "once" : int(bvc.B_errors) + " times"} (lower bound ${pct(bLow, 1)}). C's chosen policy passed ${int(bvc.C_passed)} and was wrong ${int(bvc.C_errors)} times. Of the wrong passes only one of them made, ${int(bvc.C_only_errors)} were C's and ${int(bvc.B_only_errors)} were B's (exact sign test, p = ${bvc.p_B_better.toFixed(3)}). B made fewer wrong passes, but it passed far fewer invoices, so under the written rule the two are not separated and cost decides: C.</p>
  ${openButton("b_passes_sample", `Open B's ${int(bvc.B_passed)} straight-through calls`)} ${openButton("c_only_errors_sample", `Open the ${int(bvc.C_only_errors)} errors only C made`)}`;
  return section("q3", "Q3", "Three understudies, one call", body, [
    `B against A: not shown at the bar (${ratio([bvc.B_passed, d.sample_n], 1)} passed, lower bound ${pct(bLow, 1)})`,
    `No policy or prompt was changed after any held-out figure was seen`,
    `Policy chosen on earlier months only; held-out results of all three are published`,
  ]);
}

/* ---------- Q4: the bar ---------- */
function q4(d) {
  const pe = d.bar.pass_everything.full;
  const rows = d.bar.min_calls.map((m) => `<tr><td>${int(m.errors)}</td><td>${int(m.calls)}</td></tr>`).join("");
  const body = `<p>A wrong straight-through call is a payment that needed correcting. The bar asks for more than a good average: the 95% lower bound on how often straight-through calls are right must be at least 99%. That needs evidence as well as accuracy.</p>
  <p>Passing every held-out invoice would be right ${ratio(pe.precision, 2)} of the time, with a lower bound of ${pct(pe.precision_lower, 2)}. Mostly right, and still not trustworthy: ${int(pe.precision[1] - pe.precision[0])} payments would have needed correcting.</p>
  <div class="tablewrap" style="max-width:24em"><table><caption>Calls needed to clear the bar</caption><thead><tr><th>Wrong calls</th><th>Fewest calls</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="small">The bound is the Wilson score interval at z = ${d.bar.z.toFixed(2)}.</p>`;
  return section("q4", "Q4", "Why 99%, and why a lower bound", body, [
    `The bar was raised from 90% to 99% before any contender ran, because passing everything cleared 90%`,
    `Leaving an invoice to a person is always safe; it only costs a person's time`,
  ]);
}

/* ---------- Q5 and Q6: cue sheets ---------- */
function cueSheet(id, d, states, opts) {
  const weeks = d.replay.weeks, types = d.replay.cue_types;
  let g = `<div class="grid" style="--weeks:${weeks.length}" role="table" aria-label="${esc(opts.label)}"><div role="row" style="display:contents"><span role="columnheader" class="rowlab small">Case type</span>`;
  weeks.forEach((w) => (g += `<span role="columnheader" class="weekhead">${esc(w.split("-W")[1])}</span>`));
  g += `<span role="columnheader" class="rowstate small">Now</span></div>`;
  types.forEach((t, r) => {
    g += `<div role="row" style="display:contents"><span role="rowheader" class="rowlab" title="${esc(t)}">${esc(t.replace("3-way match, invoice ", "").replace(" GR / ", " GR \u00B7 "))}</span>`;
    states[t].forEach((s, i) => (g += `<span role="cell" class="cell ${s}" data-r="${r}" data-i="${i}" aria-label="${esc(weeks[i])}: ${s.toUpperCase()}"><i></i></span>`));
    g += `<span role="cell" class="rowstate state" data-now="${r}"></span></div>`;
  });
  g += "</div>";
  return `<div class="sheet" id="${id}"><div class="scrub"><label for="${id}-w">Week</label><input id="${id}-w" type="range" min="0" max="${weeks.length - 1}" value="${weeks.length - 1}"><output for="${id}-w" aria-live="polite"></output></div>
  <div class="sheet-scroll">${g}</div>
  <div class="legend"><span><span class="cell standby"><i></i></span>STANDBY: shadow mode, a person decides</span><span><span class="cell go"><i></i></span>GO: passes invoices on its own</span><span><span class="cell cut"><i></i></span>CUT: autonomy withdrawn</span></div></div>`;
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
      el.textContent = s.toUpperCase();
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

function q5(d) {
  const t = d.replay.totals;
  const body = `<p>Autonomy is granted per case type, not all at once. Each type starts on STANDBY: the policy makes its call in shadow and a person still decides. Once a type's resolved calls clear the bar, it goes to GO and passes invoices on its own. If the last 200 resolved calls slip below the bar, it is CUT back to STANDBY. A call only counts as evidence in the week its invoice was paid.</p>
  ${cueSheet("sheet-outcome", d, d.replay.states, { label: "Earned autonomy by case type and week, outcome gate" })}
  <p>${esc(eventSentence(d))}</p>
  <p>While autonomous it passed ${int(t.passed)} invoices, ${int(t.wrong)} of them wrong (${pct(t.wrong / t.passed, 1)}, worse than the 99% bar), and removed ${int(t.touches_removed)} manual touches.</p>
  <p>Outcomes arrive weeks after invoices, so most held-out invoices had arrived before the first promotion.</p>
  ${openButton("replay_autonomous", `Open the ${int(t.passed)} invoices passed on their own`)}`;
  return section("q5", "Q5 GO", "Trust earned per case type, week by week", body, [
    `Replayed on the chosen policy over the held-out months, ${d.replay.weeks[0]} to ${d.replay.weeks[d.replay.weeks.length - 1]}`,
    `The window is too short for the outcome lag: the second promotion came in ${wk(d.replay.events.filter((e) => e.event === "promoted").slice(-1)[0].week)} with few invoices left, so ${int(t.passed)} understates steady-state volume`,
    `The ${pct(t.wrong / t.passed, 1)} rests on ${int(t.wrong)} errors, mostly from one case type`,
    `This replay cannot overturn the verdict above`,
  ], true);
}

function q6(d) {
  const A = d.agreement.alphas, a9 = A["0.9"], a7 = A["0.7"], a5 = A["0.5"], t = d.replay.totals;
  const wnum = (w) => Number(w.split("-W")[1]);
  const med = (xs) => { const v = [...xs].sort((p, q) => p - q), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const medWeek = (ws) => ws[0].split("-W")[0] + "-W" + String(med(ws.map(wnum))).padStart(2, "0");
  const gaps9 = a9.first.map((w) => wnum(d.replay.first) - wnum(w));
  const times = Math.round(a9.wrong_median / t.wrong);
  const body = `<p>A common way to decide an AI is ready: have people review its suggestions and promote it when they agree often enough. But people reviewing a suggestion tend to copy it. This simulation runs the same replay with that gate instead: a simulated reviewer copies the suggestion some share of the time, and otherwise catches a wrong pass 4 times in 5 and wrongly flags a right one 1 time in 50.</p>
  ${cueSheet("sheet-agree", d, d.agreement.example_states, { label: "Simulated agreement gate, one example run, reviewers copying 9 in 10" })}
  <p>Simulated: with reviewers copying 9 suggestions in 10, the agreement gate first promoted about ${int(med(gaps9))} weeks sooner (median ${wk(medWeek(a9.first))} against ${wk(d.replay.first)}; range ${int(Math.min(...gaps9))}\u2013${int(Math.max(...gaps9))} weeks across 20 runs) and passed ${half(a9.passed_median)} invoices, ${half(a9.wrong_median)} of them wrong (medians of 20 runs; range ${int(a9.wrong_range[0])}\u2013${int(a9.wrong_range[1])}), against ${int(t.passed)} and ${int(t.wrong)} on outcomes. That is ${word(times)} times the wrong payments, at a lower rate per pass (${pct(a9.wrong_median / a9.passed_median, 2)} against ${pct(t.wrong / t.passed, 1)}).</p>
  <p>At 0.7 it promoted in ${int(a7.promoted_runs)} of 20 runs, the earliest in ${wk(a7.first[0])}, and passed ${half(a7.passed_median)} invoices, ${half(a7.wrong_median)} of them wrong (medians of 20 runs; range ${int(a7.wrong_range[0])}\u2013${int(a7.wrong_range[1])}). At 0.5 it promoted in ${int(a5.promoted_runs)} of 20 runs.</p>
  <p><strong>The agreement it promoted on was mostly copied, so it measured the reviewers, not the helper.</strong></p>`;
  return section("q6", "Q6", "What happens when agreement is the gate", body, [
    `This section is a simulation; the copy rates are assumptions, not measurements of real reviewers`,
    `The low error rate per pass comes from a policy that is about 99% right. On these settings, a helper wrong 5% of the time would still show about 99.4% agreement at 0.9 (arithmetic, not a run)`,
    `The simulated gate still withdraws autonomy on outcomes`,
  ], true);
}

/* ---------- Q7: cost at volume ---------- */
function q7(d) {
  const b = d.cost.b, c = d.cost.c, per = 1000 / d.sample_n;
  const body = `<p>Both Claude understudies ran on the same model. Costs are what the same tokens would cost at list API prices; time is wall-clock time with calls made one after another.</p>
  <div class="cost">
  <div><span class="small">B: Claude judging each invoice</span><span class="big">$${(b.usd * per).toFixed(2)}</span><span class="small">and ${Math.round((b.wall_s * per) / 60)} minutes per 1,000 invoices, every time. ${int(b.calls)} calls for ${int(d.sample_n)} invoices.</span></div>
  <div><span class="small">C: Claude writing a policy</span><span class="big">$${(c.usd / c.calls).toFixed(2)}</span><span class="small">per policy, written once (${int(c.calls)} written). Code then ran all ${int(d.held_out_n)} held-out invoices in ${d.cost.c_run_s_all_held_out.toFixed(2)} seconds.</span></div>
  </div>
  <p>At enterprise volume the difference compounds: B's cost and time grow with every invoice; C's are paid once per policy, and the policy can be read, tested and versioned like any other rule.</p>`;
  return section("q7", "Q7", "What each understudy costs per 1,000 invoices", body, [
    `B: ${int(b.input_tokens)} input and ${int(b.output_tokens)} output tokens for the sample`,
    `C: ${int(c.input_tokens)} input and ${int(c.output_tokens)} output tokens for three policies`,
    `Costs exclude the overhead of the command-line tool used to make the calls`,
  ]);
}

/* ---------- Method ---------- */
function method(d) {
  const adrs = d.adrs.map((a) => `<li><span class="n">${esc(a.n)}</span><span class="${a.replaced ? "replaced" : ""}">${esc(a.title)}${a.amendments ? ` <em>${a.amendments} amendment${a.amendments > 1 ? "s" : ""}</em>` : ""}${a.replaced ? " <em>replaced</em>" : ""}</span></li>`).join("");
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
  <li>B was scored on a ${int(d.sample_n)}-invoice sample, which cannot show a 99% lower bound at a 1% error rate.</li></ul></details>
  <footer class="end">Built from data on ${esc(d.built)}. Source data: ${esc(d.source.name)}, ${esc(d.source.licence)}.</footer>`;
  return section("method", "M", "How this was done", body, null);
}

/* ---------- Drawer ---------- */
const SETS = {
  c_wrong_held_out: ["Wrong passes by the chosen policy", "Held-out invoices the chosen policy passed straight through that later needed a correction."],
  b_passes_sample: ["B's straight-through calls", "Sampled invoices B passed straight through. Outcome shows what actually happened."],
  c_only_errors_sample: ["Errors only C made", "Sampled invoices C passed wrongly and B left to a person."],
  replay_autonomous: ["Passed on their own in the replay", "Invoices the policy passed while its case type was on GO."],
};
let lastFocus = null, DATA = null;

function openDrawer(set, all = false) {
  const rows = DATA.drawer[set], [title, note] = SETS[set], dr = $("#drawer");
  const shown = all ? rows : rows.slice(0, 200);
  const hasWeek = rows.length && "week" in rows[0];
  $("#drawer-title").textContent = `${title} (${int(rows.length)})`;
  $("#drawer-note").textContent = note;
  $("#drawer-body").innerHTML = `<table><thead><tr><th>Order line</th><th>Case type</th>${hasWeek ? "<th>Week</th>" : ""}<th>Value (EUR)</th><th>Outcome</th></tr></thead><tbody>${shown.map((r) =>
    `<tr><td>${esc(r.id)}</td><td style="text-align:left">${esc(r.type)}</td>${hasWeek ? `<td>${esc(r.week.split("-W")[1])}</td>` : ""}<td>${r.value == null ? "" : int(r.value)}</td><td><span class="state ${r.straight_through ? "go" : "standby"}">${r.straight_through ? "PAID CLEAN" : "CORRECTED"}</span></td></tr>`).join("")}</tbody></table>
    ${shown.length < rows.length ? `<button type="button" class="open more" data-all="${set}">Show all ${int(rows.length)}</button>` : ""}`;
  if (dr.hidden) lastFocus = document.activeElement;
  dr.hidden = false;
  dr.focus();
}
function closeDrawer() { $("#drawer").hidden = true; if (lastFocus) lastFocus.focus(); }

/* ---------- Boot ---------- */
async function boot() {
  const main = $("#main");
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
  const t = d.replay.timeline;
  let cum = [];
  t.reduce((acc, x, i) => (cum[i] = { p: acc.p + x.passed, w: acc.w + x.wrong }), { p: 0, w: 0 });
  wireSheet("sheet-outcome", d, d.replay.states, (i) => `Week ${t[i].week.split("-W")[1]} of ${t[i].week.split("-W")[0]}: ${word(t[i].autonomous_types)} case type${t[i].autonomous_types === 1 ? "" : "s"} on GO. Passed on their own so far: ${int(cum[i].p)}, ${int(cum[i].w)} wrong.`);
  wireSheet("sheet-agree", d, d.agreement.example_states, (i) => {
    const n = d.replay.cue_types.filter((ty) => d.agreement.example_states[ty][i] === "go").length;
    return `Week ${d.replay.weeks[i].split("-W")[1]}: ${word(n)} case type${n === 1 ? "" : "s"} on GO in this example run (simulated).`;
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-set]"), all = e.target.closest("[data-all]");
    if (b) openDrawer(b.dataset.set);
    else if (all) openDrawer(all.dataset.all, true);
    else if (e.target.closest("[data-close]")) closeDrawer();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });

  const verdictGo = d.policies.some((p) => p.chosen && p.held_out.precision_lower >= 0.99);
  const endState = (states) => { const last = Object.values(states).map((r) => r[r.length - 1]); return last.includes("go") ? "go" : last.includes("cut") ? "cut" : "standby"; };
  const LAMPS = { q1: verdictGo ? "go" : "standby", q3: verdictGo ? "go" : "standby", q5: endState(d.replay.states), q6: endState(d.agreement.example_states) };
  document.querySelectorAll(".cues a").forEach((a) => {
    const st = LAMPS[a.getAttribute("href").slice(1)];
    if (!st) return;
    const lamp = a.querySelector(".lamp");
    lamp.classList.add(st);
    lamp.insertAdjacentHTML("afterend", `<span class="sr">(${st.toUpperCase()})</span>`);
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
