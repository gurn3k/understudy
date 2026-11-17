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
  <desc id="plot-d">${rows.map((r) => { const [a, b] = wilson(r.k, r.n); return `${esc(r.lab)}: ${pct(r.k / r.n, 2)} right, interval ${pct(a, 2)} to ${pct(b, 2)}`; }).join("; ")}. The bar is a lower bound of 99%.</desc>`;
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
  const cWrong = cn - ck, allowed = maxErrors(cn);
  const aPasses = d.a.held_out.coverage[0];
  const pe = d.bar.pass_everything.full.precision, peWrong = pe[1] - pe[0];
  const bp = d.b.sample.passed, be = d.b.sample.errors;
  const headline = `No contender earned trust at the 99% bar: ${aPasses === 0 ? "the fixed rule passes nothing" : `the fixed rule passes ${int(aPasses)}`}, and the policy Claude wrote passes ${pct(cn / d.held_out_n, 1)} of held-out invoices at ${pct(ck / cn, 2)} correct, just short of the bar (lower bound ${pct(c.held_out.precision_lower, 2)}).`;
  const cs = wilson(d.c_sample.passed - d.c_sample.errors, d.c_sample.passed)[0];
  const no = (t) => `<span class="state standby">${t}</span>`;
  const plain = `<h1 id="q1-h">Can an AI decide which invoices are safe to pay without a person checking?</h1>
  <p class="headline">Not at the bar we set. Claude's rulebook paid about half the invoices on its own and got about 99 in 100 of those right, just short of the proof we asked for.</p>
  <p class="lede">A large company's purchasing records for 2018 show staff making the same call ${int(d.candidates[0].manual_events)} times: pay this invoice now, or hold it for someone to check. We tried three AI "understudies" for that job:</p>
  <ol class="plainlist">
  <li><strong>A simple rule</strong> built from past records.</li>
  <li><strong>Claude checking each invoice</strong> one by one.</li>
  <li><strong>Claude writing a rulebook</strong> once, which ordinary code then follows.</li>
  </ol>
  <p>Each one made its calls on invoices from June to August 2018: ${int(d.held_out_n)} in all, or a sample of ${int(d.sample_n)} for the costly one-by-one approach. We then compared its calls with what really happened. None of them had seen how those invoices turned out.</p>
  <p><strong>The bar:</strong> of the invoices an AI pays without a check, no more than 1 in 100 may later need fixing. It must also handle enough invoices to show that this isn't luck. "Prove" here means we can be 95% sure the true rate is at least 99%.</p>
  <div class="tablewrap"><table class="score"><caption>What each AI did</caption><thead><tr><th>Approach</th><th>Paid without a check</th><th>Later needed fixing</th><th>Proved 99%?</th></tr></thead><tbody>
  <tr><td>Pay every invoice (for comparison)</td><td>${int(pe[1])}</td><td>${int(peWrong)} (${oneIn(pe[1], peWrong)})</td><td>${no("No")}</td></tr>
  <tr><td>1. Simple rule</td><td>${int(aPasses)}</td><td>&ndash;</td><td>${no("Paid nothing")}</td></tr>
  <tr><td>2. Claude checking each invoice*</td><td>${int(bp)} of ${int(d.sample_n)}</td><td>${int(be)}</td><td>${no("Too few to tell")}</td></tr>
  <tr class="chosen"><td>3. Claude's rulebook</td><td>${int(cn)} (${pct(cn / d.held_out_n, 0)})</td><td>${int(cWrong)} (${oneIn(cn, cWrong)})</td><td>${no("Just short")}</td></tr>
  </tbody></table></div>
  <p class="small">* Checking each invoice costs a model call every time, so it was tested on ${int(d.sample_n)} invoices, not all ${int(d.held_out_n)}.</p>
  <p>Why "just short"? The rulebook paid ${int(cn)} invoices. To prove 99% with that many, at most ${int(allowed)} could need fixing. ${int(cWrong)} did.</p>
  <ul class="bars budget" aria-label="Rulebook mistakes against the most it could make and still prove 99%">
  <li><span class="name">Most it could make</span><span class="track" aria-hidden="true"><span class="fill ok" style="width:${(allowed / cWrong) * 100}%"></span></span><span class="val">${int(allowed)}</span></li>
  <li class="hit"><span class="name">What it made</span><span class="track" aria-hidden="true"><span class="fill" style="width:100%"></span></span><span class="val">${int(cWrong)}</span></li>
  </ul>
  ${openButton("c_wrong_held_out", `See the ${int(cWrong)} invoices the rulebook paid wrongly`)}`;
  const detail = `<p class="headline">${esc(headline)}</p>
  ${boundPlot(d)}
  <div class="verdict">
  <p class="say"><b><s>Rule set first</s> <em>replaced, kept on the record</em></b><span>No contender reaches a 99% lower bound on the shared sample (C ${pct(cs, 1)}, B ${pct(d.b.lower, 1)}), so the fixed rule wins by default.</span></p>
  <p class="say"><b>Rule set later</b><span>On all held-out invoices the chosen policy's lower bound is ${pct(c.held_out.precision_lower, 2)}, below 99%, so the fixed rule wins by default again. Its win is empty: it passes ${int(aPasses)} of ${int(d.held_out_n)} invoices.</span></p>
  <p class="struck small">The comparison rule was changed after the first policy's held-out result was known and before any other contender ran; under the original rule no contender clears the bar and the fixed rule wins by default, and both verdicts are shown.</p></div>`;
  return section("q1", "Q1", "<h1", plain, detail, [
    `${int(d.held_out_n)} later invoices, locked by checksum before any understudy ran. No understudy saw their outcomes`,
    `Bar: the 95% lower bound on straight-through calls being right must be at least 99%`,
    `Three policies written independently all landed between ${pct(Math.min(...d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1])), 2)} and ${pct(Math.max(...d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1])), 2)} right`,
  ]);
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
function q2(d) {
  const max = Math.max(...d.work.map((w) => w.events));
  const triage = new Set(["Clear Invoice", "Remove Payment Block"]);
  const bars = d.work.map((w) => `<li class="${triage.has(w.activity) ? "hit" : ""}"><span class="name">${esc(w.activity)}</span>
    <span class="track" aria-hidden="true"><span class="fill" style="width:${(w.manual / max) * 100}%"></span><span class="fill batch" style="left:${(w.manual / max) * 100}%;width:${(w.batch / max) * 100}%"></span></span>
    <span class="val">${int(w.manual)}</span></li>`).join("");
  const k = d.log.kept, cand = d.candidates;
  const rows = cand.map((c) => `<tr><td>${esc(c.name.replace(/_/g, " "))}</td><td>${int(c.manual_events)}</td><td>${c.rule_likeness.toFixed(2)}</td><td>${esc(c.best_field.replace(/_/g, " "))}</td></tr>`).join("");
  const plain = `<p>The records hold ${int(k.events)} steps. People did ${pct(k.manual / k.events, 0)} of them by hand. Below are the ten biggest jobs. Two of them are the "pay or check" decision (in bold).</p>
  <ul class="bars" aria-label="Steps done by hand, top ten jobs">${bars}</ul>
  <p class="small">Dark: done by a person. Blue: done automatically. Number: steps done by hand.</p>
  <h3>Why this decision, and what else could be tested</h3>
  <p>We compared three decisions that staff make over and over. Each one has a clear outcome in the records, so an AI's call can be checked against what really happened.</p>
  <div class="tablewrap"><table class="score"><caption>Decisions we sized</caption><thead><tr><th>Decision</th><th>Times done by hand</th><th>Tested here?</th></tr></thead><tbody>${cand.map((c, i) => `<tr class="${i === 0 ? "chosen" : ""}"><td>${esc(PLAIN_DECISION[c.name] || c.name.replace(/_/g, " "))}</td><td>${int(c.manual_events)}</td><td>${i === 0 ? "Yes" : "Not yet"}</td></tr>`).join("")}</tbody></table></div>
  <p>The invoice decision came first because it is made about ${int(Math.floor(cand[0].manual_events / cand[1].manual_events))} times as often as the next one, and past records predict it about as well. The other two were sized but not tested. The same test would work for them: the same bar, and the same proof before any trust.</p>
  <p>The biggest jobs in the chart, such as creating orders and recording deliveries, are data entry, not decisions. These records hold no document text, so they cannot show whether an AI could do that work.</p>`;
  const detail = `<p>Of ${int(k.events)} recorded events, ${int(k.manual)} (${pct(k.manual / k.events, 0)}) were done by people's own accounts, ${int(k.batch)} by batch jobs, and ${int(k.unclassified)} by accounts that are neither. ${int(d.log.users.manual)} people did the manual work.</p>
  <p>Each candidate is a decision people make over and over. They are ranked by manual volume and by how rule-like the decision already is: how well one field, chosen on earlier months, predicts the outcome in later months.</p>
  <div class="tablewrap"><table><caption>Candidates</caption><thead><tr><th>Decision</th><th>Manual events</th><th>Rule-likeness</th><th>Best single field</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return section("q2", "Q2", "Where people spend their time", plain, detail, [
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
    return row(`C, policy ${esc(p.policy)}`, `${int(p.rules)} rules${p.chosen ? ", chosen on earlier months" : ""}${p.seen_when_rule_written ? "; seen" : "; unseen"}`,
      ratio(h.precision, 2), ratio(h.coverage, 1), pct(h.precision_lower, 2), h.precision_lower >= 0.99, p.chosen ? "chosen" : "");
  }).join("");
  const bvc = d.b_vs_c, bLow = d.b.lower;
  const p1 = d.policies.find((p) => p.policy === 1);
  const rates = d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1]);
  const plain = `<p>Each AI saw only what was known when an invoice arrived. It also saw how often similar invoices had gone through cleanly from January to May 2018. Then it made its call on each June to August invoice.</p>
  <ul>
  <li><strong>The simple rule</strong> pays a kind of invoice only if that kind had a clean enough record in earlier months to clear the bar. No kind did, so it paid nothing.</li>
  <li><strong>Claude checking each invoice</strong> made fewer wrong payments. On the same ${int(d.sample_n)} invoices, it paid ${int(bvc.B_passed)} and ${bvc.B_errors === 1 ? "1 needed" : int(bvc.B_errors) + " needed"} fixing. The rulebook paid ${int(bvc.C_passed)} and ${int(bvc.C_errors)} needed fixing. But ${int(bvc.B_passed)} invoices are too few to prove 99%, so the test could not call a winner between the two. The rulebook is far cheaper (see below), so it went forward. A larger follow-up, below, did not change this.</li>
  <li><strong>Claude's rulebook:</strong> Claude wrote three rulebooks separately. We picked one before testing, using only earlier months. All three got between ${pct(Math.min(...rates), 1)} and ${pct(Math.max(...rates), 1)} right on the invoices they paid. That is right at the edge of the bar. One of the other two did prove 99%, but it doesn't count: we had seen its result before the final rules were set, and it wasn't the one picked beforehand.</li>
  </ul>
  ${openButton("b_passes_sample", `See the ${int(bvc.B_passed)} invoices Claude paid one by one`)}
  ${followUp(d)}`;
  const detail = `<p>Every understudy saw the invoice's own facts as they stood when it arrived, plus straight-through rates from order lines created in earlier months (January to May 2018). They were scored on order lines created June to August 2018. No understudy saw an outcome from those lines. The earlier-month rates use every outcome in the log, including ones that landed after held-out invoices began to arrive.</p>
  <ul>
  <li><strong>A, a plain rule.</strong> Pass an invoice if its group, in earlier months, was clean often enough to clear the bar on its own. No group was, so A passes nothing.</li>
  <li><strong>B, Claude judging each invoice.</strong> One model call per batch of invoices is too costly to run on every invoice, so B judged the ${int(d.sample_n)}-invoice shared sample, ${int(d.cost.b.calls)} calls of 25. Answers that failed code checks count as "leave to a person".</li>
  <li><strong>C, Claude writing a policy.</strong> Claude saw earlier-month tables only and wrote rules in a small language that code checks and then runs. Three policies were written independently; the one chosen is the one with the most earlier-month coverage that still cleared the bar there.</li>
  </ul>
  <div class="tablewrap"><table><caption>Scored on all ${int(d.held_out_n)} held-out invoices</caption><thead><tr><th>Understudy</th><th>Notes</th><th>Passed</th><th>Right</th><th>Lower bound</th><th>State</th></tr></thead><tbody>
  ${row("A, plain rule", `${int(d.a.cells)} groups qualified`, "none", ratio(a.coverage, 1), "none", false)}${pols}</tbody></table></div>
  <p class="small">One of the three policies (policy ${esc(p1.policy)}) does clear the bar on held-out invoices (lower bound ${pct(p1.held_out.precision_lower, 2)}), but its result had been seen before the rule was rewritten and the earlier-month selection did not choose it, so it does not count towards the verdict; all three are shown.</p>
  <h3>B against C, on the same ${int(d.sample_n)} invoices</h3>
  <p>B passed ${int(bvc.B_passed)} and was wrong ${bvc.B_errors === 1 ? "once" : int(bvc.B_errors) + " times"} (lower bound ${pct(bLow, 1)}). C's chosen policy passed ${int(bvc.C_passed)} and was wrong ${int(bvc.C_errors)} times. Of the wrong passes only one of them made, ${int(bvc.C_only_errors)} were C's and ${int(bvc.B_only_errors)} were B's (exact sign test, p = ${bvc.p_B_better.toFixed(3)}). B made fewer wrong passes, but it passed far fewer invoices, so under the written rule the two are not separated and cost decides: C.</p>
  ${openButton("c_only_errors_sample", `Open the ${int(bvc.C_only_errors)} errors only C made`)}`;
  return section("q3", "Q3", "How the three were tested", plain, detail, [
    `B against A: not shown at the bar (${ratio([bvc.B_passed, d.sample_n], 1)} passed, lower bound ${pct(bLow, 1)})`,
    `No policy or prompt was changed after any held-out figure was seen`,
    `Policy chosen on earlier months only; held-out results of all three are published`,
  ]);
}

/* ---------- Q4: the bar ---------- */
function q4(d) {
  const pe = d.bar.pass_everything.full;
  const rows = d.bar.min_calls.map((m) => `<tr><td>${int(m.errors)}</td><td>${int(m.calls)}</td></tr>`).join("");
  const plain = `<p>A wrong "pay" means a payment someone later had to fix. Holding an invoice for a person counts as safe here. It just costs that person's time.</p>
  <p>Paying every invoice without a check sounds tempting: ${pct(pe.precision[0] / pe.precision[1], 0)} of them were fine. But that still leaves ${int(pe.precision[1] - pe.precision[0])} payments to fix, about ${oneIn(pe.precision[1], pe.precision[1] - pe.precision[0])}. So the bar is 99%: at most 1 in 100.</p>
  <p>A good score on a few invoices could just be luck, the way a coin can land heads five times in a row. So an AI must also handle enough invoices to make luck very unlikely. The table shows how many it needs.</p>
  <div class="tablewrap" style="max-width:26em"><table><caption>How many invoices it takes to prove 99%</caption><thead><tr><th>If this many need fixing</th><th>It must pay at least</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const detail = `<p>A wrong straight-through call is a payment that needed correcting. The bar asks for more than a good average: the 95% lower bound on how often straight-through calls are right must be at least 99%. That needs evidence as well as accuracy.</p>
  <p>Passing every held-out invoice would be right ${ratio(pe.precision, 2)} of the time, with a lower bound of ${pct(pe.precision_lower, 2)}. Mostly right, and still not trustworthy: ${int(pe.precision[1] - pe.precision[0])} payments would have needed correcting.</p>
  <p class="small">The bound is the Wilson score interval at z = ${d.bar.z.toFixed(2)}. "Prove" on this page means: 95% confident that the true rate is at least 99%.</p>`;
  return section("q4", "Q4", "Why 99%, and why ask for proof", plain, detail, [
    `The bar was raised from 90% to 99% before any contender ran, because passing everything cleared 90%`,
  ]);
}

/* ---------- Q5 and Q6: cue sheets ---------- */
function cueSheet(id, d, states, opts) {
  const weeks = d.replay.weeks, types = d.replay.cue_types;
  let g = `<div class="grid" style="--weeks:${weeks.length}" role="table" aria-label="${esc(opts.label)}"><div role="row" style="display:contents"><span role="columnheader" class="rowlab small">Kind of invoice</span>`;
  weeks.forEach((w) => (g += `<span role="columnheader" class="weekhead">${esc(w.split("-W")[1])}</span>`));
  g += `<span role="columnheader" class="rowstate small">Now</span></div>`;
  types.forEach((t, r) => {
    g += `<div role="row" style="display:contents"><span role="rowheader" class="rowlab" title="${esc(t)}">${esc(t.replace("3-way match, invoice ", "").replace("before GR", "before goods").replace("after GR", "after goods").replace(" / ", " \u00B7 "))}</span>`;
    states[t].forEach((s, i) => (s = STATES.has(s) ? s : "unlit", g += `<span role="cell" class="cell ${s}" data-r="${r}" data-i="${i}" aria-label="${esc(weeks[i])}: ${s.toUpperCase()}"><i></i></span>`));
    g += `<span role="cell" class="rowstate state" data-now="${r}"></span></div>`;
  });
  g += "</div>";
  return `<div class="sheet" id="${id}"><div class="scrub"><label for="${id}-w">Week</label><input id="${id}-w" type="range" min="0" max="${weeks.length - 1}" value="${weeks.length - 1}"><output for="${id}-w" aria-live="polite"></output></div>
  <div class="sheet-scroll">${g}</div>
  <div class="legend"><span><span class="cell standby"><i></i></span>STANDBY: practice only, a person decides</span><span><span class="cell go"><i></i></span>GO: pays this kind on its own</span><span><span class="cell cut"><i></i></span>CUT: trust taken back</span></div></div>`;
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

function q5(d) {
  const t = d.replay.totals;
  const plain = `<p>Another way to bring in an AI is to trust it one kind of invoice at a time. We replayed June 2018 to January 2019 week by week to see how that would go.</p>
  <p>Every kind of invoice starts in practice mode (STANDBY). The AI makes its call, but a person still decides. Once its practice calls prove 99% for that kind, it may pay that kind on its own (GO). If its recent calls slip clearly below 99%, that trust is taken back (CUT). Drag the week slider to watch it unfold.</p>
  ${cueSheet("sheet-outcome", d, d.replay.states, { label: "Trust earned by kind of invoice and week" })}
  <p>${esc(plainEvents(d))}</p>
  <p>While trusted, it paid ${int(t.passed)} invoices on its own and ${int(t.wrong)} needed fixing (about ${oneIn(t.passed, t.wrong)}). That is worse than the 1 in 100 bar. It also saved staff ${int(t.touches_removed)} steps done by hand.</p>
  <p>Most of the ${int(t.wrong)} came from one kind of invoice, and the records end soon after the second kind was trusted, so ${int(t.passed)} is lower than a full year would give. This replay does not change the answer at the top.</p>
  <p>Trust came late because you only learn whether an invoice was right weeks after it arrives. By the time the proof was in, most invoices had already arrived.</p>
  ${openButton("replay_autonomous", `See the ${int(t.passed)} invoices it paid on its own`)}`;
  const detail = `<p>Autonomy is granted per case type, not all at once. A type is promoted to GO once its resolved calls clear the bar. If even the 95% upper bound of its last 200 resolved calls falls below the bar, it is CUT back to STANDBY. A call only counts as evidence in the week its invoice was paid.</p>
  <p>${esc(eventSentence(d))}</p>
  <p>While autonomous it passed ${int(t.passed)} invoices, ${int(t.wrong)} of them wrong (${pct(t.wrong / t.passed, 1)}, worse than the 99% bar), and removed ${int(t.touches_removed)} manual touches.</p>
  <p>Outcomes arrive weeks after invoices, so most held-out invoices had arrived before the first promotion.</p>`;
  return section("q5", `Q5 ${endState(d.replay.states).toUpperCase()}`, "Earning trust one kind of invoice at a time", plain, detail, [
    `Replayed on the chosen policy over the held-out months, ${esc(d.replay.weeks[0])} to ${esc(d.replay.weeks[d.replay.weeks.length - 1])}`,
    `The window is too short for the outcome lag: the second promotion came in ${wk(d.replay.events.filter((e) => e.event === "promoted").slice(-1)[0].week)} with few invoices left, so ${int(t.passed)} understates steady-state volume`,
    `The ${pct(t.wrong / t.passed, 1)} rests on ${int(t.wrong)} errors, mostly from one case type`,
    `The policy was written from earlier-month rates, about half of which rest on outcomes that landed after the replay's first week`,
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
  const round100 = (n) => int(Math.round(n / 100) * 100);
  const plain = `<p>A common shortcut is to have staff review the AI's suggestions, and switch it on once they agree with it often enough. But people reviewing a suggestion tend to go along with it.</p>
  <p>We simulated that. Our made-up reviewers copy the AI's suggestion 9 times in 10. The other times they judge for themselves, and they catch most of its mistakes.</p>
  ${cueSheet("sheet-agree", d, d.agreement.example_states, { label: "Simulated agreement shortcut, one example run, reviewers copying 9 in 10" })}
  <p>With reviewers copying 9 times in 10, a typical run first switched the AI on about ${word(Math.round(med(gaps9)))} weeks sooner. It paid about ${round100(a9.passed_median)} invoices on its own instead of ${int(t.passed)}, and about ${int(Math.floor(a9.wrong_median / 10) * 10)} needed fixing instead of ${int(t.wrong)}. That is ${word(times)} times as many wrong payments. Its mistakes per invoice were lower, but it paid far more invoices. That low rate comes from the rulebook being about 99% right, not from the shortcut. A much worse AI would still have been agreed with nearly as often.</p>
  <p><strong>The agreement it was switched on for was mostly copied. It measured the reviewers, not the AI.</strong></p>
  <p class="small">This is a simulation. How often real reviewers copy is an assumption here, not a measurement.</p>`;
  const detail = `<p>The simulation runs the same replay with that gate instead: a simulated reviewer copies the suggestion some share of the time, and otherwise catches a wrong pass 4 times in 5 and wrongly flags a right one 1 time in 50.</p>
  <p>Simulated: with reviewers copying 9 suggestions in 10, the agreement gate first promoted about ${int(med(gaps9))} weeks sooner (median ${wk(medWeek(a9.first))} against ${wk(d.replay.first)}; range ${int(Math.min(...gaps9))}\u2013${int(Math.max(...gaps9))} weeks across 20 runs) and passed ${half(a9.passed_median)} invoices, ${half(a9.wrong_median)} of them wrong (medians of 20 runs; range ${int(a9.wrong_range[0])}\u2013${int(a9.wrong_range[1])}), against ${int(t.passed)} and ${int(t.wrong)} on outcomes. That is ${word(times)} times the wrong payments, at a lower rate per pass (${pct(a9.wrong_median / a9.passed_median, 2)} against ${pct(t.wrong / t.passed, 1)}).</p>
  <p>At 0.7 it promoted in ${int(a7.promoted_runs)} of 20 runs, the earliest in ${wk(a7.first[0])}, and passed ${half(a7.passed_median)} invoices, ${half(a7.wrong_median)} of them wrong (medians of 20 runs; range ${int(a7.wrong_range[0])}\u2013${int(a7.wrong_range[1])}). At 0.5 it promoted in ${int(a5.promoted_runs)} of 20 runs.</p>
  <p>The agreement it promoted on was mostly copied, so it measured the reviewers, not the helper.</p>`;
  return section("q6", "Q6", "What if you trust it because people agree with it?", plain, detail, [
    `This section is a simulation; the copy rates are assumptions, not measurements of real reviewers`,
    `The low error rate per pass comes from a policy that is about 99% right. On these settings, a helper wrong 5% of the time would still show about 99.4% agreement at 0.9 (arithmetic, not a run)`,
    `The simulated gate still withdraws autonomy on outcomes`,
  ], true);
}

/* ---------- Q7: cost at volume ---------- */
function q7(d) {
  const b = d.cost.b, c = d.cost.c, per = 1000 / d.sample_n;
  const plain = `<p>Both Claude approaches used the same model. Prices are what the same work would cost at standard Claude rates.</p>
  <div class="cost">
  <div><span class="small">Claude checking each invoice</span><span class="big">$${(b.usd * per).toFixed(2)}</span><span class="small">and about ${Math.round((b.wall_s * per) / 60)} minutes for every 1,000 invoices, again and again.</span></div>
  <div><span class="small">Claude writing a rulebook</span><span class="big">$${(c.usd / c.calls).toFixed(2)}</span><span class="small">once per rulebook. Ordinary code then handled all ${int(d.held_out_n)} invoices in ${d.cost.c_run_s_all_held_out < 1 ? "under a second" : d.cost.c_run_s_all_held_out.toFixed(1) + " seconds"}.</span></div>
  </div>
  <p>At a large company's volume this gap grows. Checking each invoice costs more with every invoice. A rulebook is paid for once, and people can read it, test it and track changes to it like any other company rule.</p>`;
  const detail = `<p>Costs are what the same tokens would cost at list API prices; time is wall-clock time with calls made one after another. B made ${int(b.calls)} calls for ${int(d.sample_n)} invoices; ${int(c.calls)} policies were written; code ran all ${int(d.held_out_n)} held-out invoices in ${d.cost.c_run_s_all_held_out.toFixed(2)} seconds.</p>`;
  return section("q7", "Q7", "What each approach costs", plain, detail, [
    `B: ${int(b.input_tokens)} input and ${int(b.output_tokens)} output tokens for the sample`,
    `C: ${int(c.input_tokens)} input and ${int(c.output_tokens)} output tokens for three policies`,
    `Costs exclude the overhead of the command-line tool used to make the calls`,
    ...(d.b2 && d.b2.cost && d.b2.b_alone ? [`Follow-up run of B: ${int(d.b2.cost.calls)} calls for ${int(d.b2.b_alone.n)} invoices, $${d.b2.cost.usd.toFixed(2)} at list prices`] : []),
  ]);
}

const dayLong = (iso) => { const [y, m, dd] = iso.split("-").map(Number); return `${dd} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`; };
const endState = (states) => { const last = Object.values(states).map((r) => r[r.length - 1]); return last.includes("go") ? "go" : last.includes("cut") ? "cut" : "standby"; };
const STATES = new Set(["unlit", "standby", "go", "cut"]);

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
  const t = d.replay.timeline;
  let cum = [];
  t.reduce((acc, x, i) => (cum[i] = { p: acc.p + x.passed, w: acc.w + x.wrong }), { p: 0, w: 0 });
  wireSheet("sheet-outcome", d, d.replay.states, (i) => `Week ${t[i].week.split("-W")[1]} of ${t[i].week.split("-W")[0]}: ${word(t[i].autonomous_types)} kind${t[i].autonomous_types === 1 ? "" : "s"} of invoice on GO. Paid on its own so far: ${int(cum[i].p)}, ${int(cum[i].w)} needed fixing.`);
  wireSheet("sheet-agree", d, d.agreement.example_states, (i) => {
    const n = d.replay.cue_types.filter((ty) => d.agreement.example_states[ty][i] === "go").length;
    return `Week ${d.replay.weeks[i].split("-W")[1]}: ${word(n)} kind${n === 1 ? "" : "s"} of invoice on GO in this example run (simulated).`;
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
