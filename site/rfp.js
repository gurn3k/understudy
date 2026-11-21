"use strict";
/* Understudy: model request for a pilot proposal (ADR 0020), split into two documents (ADR 0030): the request that goes to
   every proposer (rfp.html) and the issuer's internal case (case.html: approval, cost and return, findings, sign-off).
   The page's <body data-doc> picks which one is drawn. Every study figure is read from data.json; nothing is typed by hand.
   Phase lengths, oversight hours, risk ratings and evaluation weights are the author's assumptions or judgment, and are labelled as such. */
const DOC = document.body.dataset.doc === "case" ? "case" : "request";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (n) => Math.round(n).toLocaleString("en-US");
const half = (n) => (Number.isInteger(n) ? int(n) : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
const word = (n) => ["None", "One", "Two", "Three", "Four"][n] || String(n);
const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
const usd = (x) => (x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e4 ? `$${int(Math.round(x / 1000))}k` : `$${int(x)}`);
const fill = (t) => `<span class="blank" title="To be completed by the adopting company">[${t}]</span>`;

/* Assumptions of mine, not measurements. Shown on the page as such. */
const PH = Calc.PH; // phase weeks, shared with the calculator (calc.js)
const OVERSIGHT_H = Calc.DEF.oh, DEF_MIN = Calc.DEF.min, DEF_RATE = Calc.DEF.rate; // input defaults: my assumptions
const DEF_FIX = Calc.DEF.fix, DEF_LOST = Calc.DEF.lost, WINDOWS_YR = Calc.WINDOWS_YR;
/* Control defaults (ADR 0025) are my assumptions, not tested values; they are read from data.json ("controls.defaults"),
   where tools/build_site.py also measures what each does on the study's data. */
const AGREE = "0.9", SIM_RUNS = 20; // the simulation shown: reviewers copy this share; runs per ADR 0017
const SCEN = [0.1, 0.25, 0.5, 1]; // shares of the on-paper volume, scenarios only
const TT = Calc.TT, PROC = Calc.PROC; // procurement timetable and its length, shared with the main report (calc.js)
/* Rows of the return table: none earned, the replay's observed share (a truncated window), then the scenarios. */
const scenRows = (g) => [[0, "none earned yet"], [g.earned_share, "observed in the replay; window too short"], ...SCEN.map((x) => [x, x === 1 ? "the on-paper ceiling" : ""])];

// cls "cards": on a phone each row stacks as a card; cells carry their column's name, and ARIA roles keep the table's meaning.
const tbl = (caption, heads, rows, cls = "") => {
  const cards = cls.split(" ").includes("cards"), r = (x) => (cards ? ` role="${x}"` : "");
  const lab = (i) => (cards ? ` data-label="${esc(heads[i].replace(/<[^>]+>/g, ""))}"` : "");
  return `<div class="tablewrap"><table class="rfp ${cls}"${r("table")}><caption>${caption}</caption><thead${r("rowgroup")}><tr${r("row")}>${heads.map((h) => `<th scope="col"${r("columnheader")}>${h}</th>`).join("")}</tr></thead><tbody${r("rowgroup")}>${rows.map((row) => `<tr${r("row")}>${row.map((c, i) => (i === 0 ? `<th scope="row"${r("rowheader")}>${c}</th>` : `<td${r("cell")}${lab(i)}>${c}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
};
const sec = (id, n, title, body) => `<section id="${id}" aria-labelledby="${id}-h"><div class="col"><h2 id="${id}-h"><span class="marg" aria-hidden="true">${n}</span>${title}</h2>${body}</div><div></div></section>`;
/* Bars drawn to scale (the main report's component). rows: [name, value, label, highlight] */
const bars = (label, rows, scale) => { const max = scale || Math.max(...rows.map((r) => r[1])) || 1; return `<p class="bars-title">${label}</p><ul class="bars" aria-label="${label}">${rows.map(([n, x, l, hit]) => `<li class="${hit ? "hit" : ""}"><span class="name">${n}</span><span class="track" aria-hidden="true"><span class="fill" style="width:${(x / max) * 100}%"></span></span><span class="val">${l}</span></li>`).join("")}</ul>`; };
const list = (xs, tag = "ul") => `<${tag} class="plainlist">${xs.map((x) => `<li>${x}</li>`).join("")}</${tag}>`;

/* The money chain, on one unit: the order line (ADR 0021). Same arithmetic as the main report's Q9. */
function figures(d) {
  const b = d.business, R = b.eur_usd, c = d.policies.find((p) => p.chosen), t = d.replay.totals;
  const b2 = d.b2 && d.b2.b_alone && d.b2.cost ? d.b2 : null;
  const firstWk = d.replay.weeks.indexOf(d.replay.first) + 1, firstIso = Number(d.replay.first.split("-W")[1]);
  const linesYr = b.paid * (12 / b.months);
  const v = Object.fromEntries(Object.entries(b.value).map(([k, x]) => [k, x * R]));
  return { b, R, c, t, b2, firstWk, firstIso, linesYr, v, cOnce: d.cost.c.usd / d.cost.c.calls, ag: d.agreement.alphas[AGREE],
    L: b.lines_per_mistake, g: b.gated, iso: b.footprint.isolated_paid / b.paid, meanWrong: b.anchors.mean_wrong * R,
    totalWeeks: PH.p0 + firstWk + PH.p2 + PH.p3, dryWeeks: PH.p0 + firstWk, stopWk: firstWk * 2,
    maxWeeks: PH.p0 + firstWk * 2 + PH.p2 + PH.p3 }; // the most before the stop rule ends practice mode (section 7)
}

function build(d) {
  const f = figures(d), { b, c, t, b2, firstWk, firstIso, linesYr, v, cOnce, ag, totalWeeks, stopWk, maxWeeks, L, g, iso } = f;
  const mc = d.bar.min_calls, ctl = d.controls, er = d.evidence.replay;
  const wkN = (w) => d.replay.weeks.indexOf(w) + 1, isoN = (w) => Number(w.split("-W")[1]);
  const wkL = (w) => `week ${wkN(w)} of the replay (ISO week ${isoN(w)})`;
  const [pr1, pr2] = ctl.promotions, dm = ctl.demotions[0];
  const DF = ctl.defaults, MARGIN = DF.margin, CONSEC = DF.consec, ORDER_CAP = DF.order_cap, SETTLE_DAYS = DF.settle_days;
  const m2d = ctl.m2_default, st1 = ctl.second_test[0], sl = ctl.settle, nWeeks = d.replay.weeks.length;
  const m2Line = m2d.promotions === 0 ? `under M2's default the replay would not have promoted any kind in its ${int(nWeeks)} weeks` : `under M2's default the replay's first promotion would have come in ${wkL(m2d.first)}`;
  const cl = d.evidence.clustering, rv = d.evidence.rulebook_by_vendor, wl = d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked);
  const out = [], cs = []; // out: the request (rfp.html); cs: the internal case (case.html)
  const isCase = DOC === "case";
  // A reference to a section of the request: plain on the request itself, a link from the internal case.
  const rq = (n) => (isCase ? `<a href="rfp.html#s${n}">the request's section ${n}</a>` : `section ${n}`);
  const head = (title, docTitle, howto, extra) => `<section id="s0" aria-labelledby="s0-h"><div class="col">
  <h1 id="s0-h">${title}</h1>
  <p class="jump"><a href="./">&larr; Back to the main report</a></p>
  <p class="small">This is a model document. I wrote it from my study, to show how a company with a formal process could ${isCase ? "make the internal case for a pilot" : "ask for a pilot"}. It is not issued by any organisation, and every placeholder in [brackets] is for the company that adopts it to complete. I wrote it after every result was known (decision record 0020); it changes no result.</p>
  <div class="callout rec howto" role="note" aria-label="How to use this document"><p><strong>How to use this document.</strong></p>
  ${list(howto)}</div>
  ${tbl("Document control", ["Item", "Entry"], [
    ["Title", docTitle],
    ["Reference", fill("Procurement reference, e.g. RFP-YYYY-NNN")],
    ["Version and date", `1.0, built ${esc(d.built)}`],
    ["Author", "The author of the Understudy study (first-person statements in this document are mine)"],
    ["Status", "Model document. Text in [brackets] is a placeholder for the adopting company to complete"],
    ...extra,
    ["Owner of this document", fill("Name, role and department")],
  ])}
  </div><div></div></section>`;

  /* Document control: the request */
  out.push(head("Request for Proposals: a controlled pilot of AI-assisted invoice clearing", "Request for Proposals: controlled pilot of AI-assisted invoice clearing", [
    "<strong>This is the request.</strong> Sections 1 to 12 and the appendices go to every proposer, the same text to each, with the placeholders completed.",
    "<strong>The issuer's internal case is a separate document.</strong> The approval to issue this request, the issuer's own cost and return figures, and the sign-off are kept there. It is not sent to proposers.",
    "<strong>Requirements are outcomes.</strong> Section 6 asks for results on the decision component, whatever makes the pay-or-hold call on a line; any approach may meet them. The study's rulebook is the reference design in Appendix E. Sections 1, 2 and 4 name the approaches the study tested, including the model; that is evidence, not a requirement.",
    "<strong>Voice, optional.</strong> I wrote this in the first person, as the study's author. An issuer that sends it formally may replace \"I\" and \"my\" with \"the Issuer\", and \"my assumption\", \"my default\" or \"my proposal\" with \"Issuer to set\". What a proposer must do already reads \"shall\".",
    "<strong>Before issue.</strong> The issuer completes every placeholder in [brackets], and confirms or replaces every figure marked as my assumption, my default or my proposal: phase lengths, control defaults, evaluation weights and dates. Send the document itself; this site's navigation, including its links to the main report, is not part of the request.",
  ], [["Classification", fill("e.g. Internal, Confidential")]]));
  /* Document control: the internal case */
  cs.push(head("Internal business case: a controlled pilot of AI-assisted invoice clearing", "Internal business case: controlled pilot of AI-assisted invoice clearing", [
    "<strong>This is the internal case.</strong> It asks the sponsor to approve issuing the pilot request (section 1), works out the cost and the return at your inputs (section 2), explains the desirable requirements (section 3) and records the sign-off (section 4). It is not sent to proposers.",
    `<strong>The request is a separate document.</strong> <a href="rfp.html">The request for proposals</a>, sections 1 to 12 and the appendices, goes to every proposer. "The request's section 7" here means section 7 of that document.`,
    "<strong>Before use.</strong> The issuer replaces every figure marked as my assumption or my default with its own, and enters its own inputs in section 2.",
  ], [["Classification", "Internal: not sent to proposers"]]));

  const phases = [["0 Set-up", PH.p0], ["1 Practice mode", firstWk], ["2 Limited autonomy", PH.p2], ["3 Review", PH.p3]];
  const timeline = `<figure class="tline"><div class="tline-bar" role="img" aria-label="Plan: procurement, about ${PROC} weeks; then ${phases.map(([n, w], i) => `${n}, ${i === 1 ? `${w} to ${stopWk}` : w} weeks`).join("; ")}"><span class="seg pre" style="flex:${PROC}"><b>Procurement</b><i>~${PROC} wk</i></span>${phases.map(([n, w], i) => `<span class="seg s${i}" style="flex:${w}"><b>${n}</b><i>${i === 1 ? `${w}–${stopWk}` : w} wk</i></span>`).join("")}</div><figcaption class="small">Procurement first: about ${PROC} weeks from issue to the award decision (${rq(12)}). Then the pilot: at least ${totalWeeks} weeks and at most ${maxWeeks} before the stop rule ends it. Each phase ends at a gate (${rq(7)}). Phase 1 ends when a kind of invoice proves the bar under M2. ${firstWk} weeks is the earliest that happened in the replay, under its own single-crossing rule; ${m2Line}. If no kind has qualified by week ${stopWk} of practice mode, the pilot stops, so Phase 1 runs ${firstWk} to ${stopWk} weeks.</figcaption></figure>`;
  const keyStudy = [
    ["What was tested?", `3 pre-registered approaches: the simple rule and the rulebook on ${int(d.held_out_n)} real test invoices, Claude checking each invoice on ${b2 ? int(b2.b_alone.n) + " (a follow-up sample)" : int(d.sample_n)}`, "None proved the 99% bar"],
    ["What did the best one do?", `Rulebook paid ${pct(b.paid / d.held_out_n, 1)}; ${pct(c.held_out.precision[0] / c.held_out.precision[1], 2)} right; worst likely case ${pct(c.held_out.precision_lower, 2)}`, "Below the bar: not proven"],
    ["The saving", `Not known yet. It rests on the share of order lines a person reviews today, which the records can't show. ${pct(iso, 1)} of the lines the rulebook would have paid show a person's own step`, "A footprint, not proof of review. Phase 0 measures it"],
    ["The risk", `${int(b.wrong)} of ${int(b.paid)} lines paid needed a fix (${pct(b.wrong / b.paid, 2)}), ${pct(v.wrong / v.paid, 1)} of value (${usd(v.wrong)})`, "Paid before a fix; not money lost"],
    ["Trust earned on outcomes (replay)", `${int(t.passed)} paid, ${int(t.wrong)} needed correction (${pct(t.wrong / t.passed, 1)}), ${d.evidence.replay.kinds === 1 ? "all in one kind" : `in ${int(d.evidence.replay.kinds)} kinds`}, ${int(d.evidence.replay.top_order)} on one order; first kind in week ${firstWk} of the replay (ISO week ${firstIso}) under the replay's own rule; ${m2d.promotions === 0 ? "none under M2's default" : `under M2's default, ${wkL(m2d.first)}`}`, "Not proven either; expect errors in the first months"],
  ];
  /* 1. The request's summary: what is asked for, and the study's evidence. No cost or return figures. */
  out.push(sec("s1", "1", "Summary of the request", `
  <p class="headline">I ask for proposals for a controlled pilot, not a roll-out: at least ${totalWeeks} weeks and at most ${maxWeeks} in four gated phases, after about ${PROC} weeks of procurement.</p>
  ${timeline}
  ${tbl("Key figures from the study", ["Question", "Answer", "What it means"], keyStudy, "keys")}
  <p>A proposal answers sections 2 to 12: the requirements in section 6, the plan and gates in section 7, the cost lines to price in section 11 and the instructions in section 12. Each gate is the issuer's decision, taken on its own measured figures.</p>
  <p class="small">The verdict stands as in the main report: no approach proved the 99% bar. This request asks how a company could find out, under controls, whether its own invoices would.</p>`));
  /* 1. The internal case's executive summary: the ask, with the cost and return at the reader's inputs. */
  cs.push(sec("s1", "1", "Executive summary", `
  <p class="headline">I ask for approval to procure a controlled pilot, not a roll-out: at least ${totalWeeks} weeks and at most ${maxWeeks} in four gated phases, after about ${PROC} weeks of procurement.</p>
  ${timeline}
  ${tbl("Key figures", ["Question", "Answer", "What it means"], [
    ...keyStudy,
    ["When it pays off", `<span data-out="pays-off"></span>.<span data-out="pays-off-q"></span>`, `At a late fix of <span data-out="late"></span>, on the cautious end of the replay's error rate, after oversight and blind checks (section 2)`],
    ["Pilot cost", `<span data-out="total"></span>: internal oversight and the rulebook (my assumptions), blind checks on <span data-out="kinds-lab"></span> window by window (M9; costed monthly, its shortest window), plus integration if entered`, `Supplier fees, model use, hosting, outcome scoring, audit, reconciliation and training are required lines still to price (section 2; proposers price theirs in ${rq(11)})`],
    ["Return", `<span data-out="return-line"></span>`, `At your inputs, including blind checks on <span data-out="kinds-lab"></span> window by window (M9; costed monthly, its shortest window)<span data-out="need-int"></span>; scenarios, not forecasts (section 2)`],
  ], "keys")}
  <p class="ask"><strong>The decision I ask for:</strong> approve issuing <a href="rfp.html">the request</a>, and on award fund Phase 0 to measure the inputs that decide it: the share of lines a person reviews today, minutes per review and the cost of a late fix. <span data-out="ask-note"></span> Gate 1 goes ahead only if those measurements give a positive net after running costs. Every later phase waits for a gate.</p>
  <p class="small">The verdict stands as in the main report: no approach proved the 99% bar. This document asks how a company could find out, under controls, whether its own invoices would.</p>`));

  out.push(sec("s2", "2", "Purpose and background", `
  <p>Every invoice line is cleared for payment, but the records can't show how many of them a person actually reviews first: most clearing steps are bulk postings, one login clearing many lines in the same minute. I tested whether AI could take the routine decisions off people's desks and still reach a strict accuracy bar, and how a company would prove it first. The answer at my bar was <em>no</em>, but it shows how to find out, and a pilot is how a company does that on its own invoices.</p>
  ${tbl("The study at a glance", ["Item", "Detail"], [
    ["Data", "One real multinational company's purchasing records, 2018, published for research"],
    ["Size", `${int(d.log.raw.cases)} order lines, ${int(d.log.raw.events)} recorded steps`],
    ["Unit", `The order line: the records have no invoice-document field. The ${int(b.paid)} lines the rulebook would have paid came in about ${int(b.groups_paid)} groups sharing an order and a receipt minute`],
    ["What the records show of people's hands", `${pct(iso, 1)} of those lines have a person's own step besides the clearing; most clearing steps are bulk postings. A footprint, not proof of review`],
    ["Result", "No approach proved the 99% bar"],
    ["What only a pilot can tell you", "The share of lines a person really reviews, minutes per review, and the real cost of a late fix"],
  ])}
  <p>This request asks proposers, an internal team or an outside supplier, how they would run that pilot to the requirements below.</p>`));

  out.push(sec("s3", "3", "Scope, objectives and acceptance", `
  <h3>In scope</h3>
  ${list(["Purchase invoices matched against orders and goods receipts (the kind the study covered).", "Practice mode (shadow mode) on every kind of invoice, then limited autonomy on kinds that qualify.", "Measurement of the share of order lines a person reviews today, minutes per review, the cost of a late fix (the work plus the share of value never recovered) and the rate of corrections after payment."])}
  <h3>Out of scope</h3>
  ${list(["Payment runs, supplier onboarding and supplier bank-detail changes.", "Building new fraud or duplicate-payment detection. I did not test either; the existing checks stay, and they must run on every line paid on its own (M14).", "Any invoice type the study did not cover."])}
  <h3>Objectives</h3>
  ${list([
    "<strong>O1.</strong> Prove or disprove the 99% bar on the company's own invoices.",
    "<strong>O2.</strong> Measure the share of order lines a person reviews today, minutes per review and the real cost of a late fix, and replace my assumptions with them.",
    "<strong>O3.</strong> Keep lines paid that need a correction within a budget agreed at Gate 1.",
    "<strong>O4.</strong> Leave a complete audit trail of every call and every outcome.",
  ])}
  <h3>Acceptance</h3>
  <p>A kind of invoice may be paid without a check only when the worst likely case of its settled calls (those it would have paid) reaches 99%, by a promotion rule that stays valid when it is checked every week (requirement M2). In practice that means at least:</p>
  ${tbl("Settled calls a kind needs before it is trusted", ["Mistakes among them", "Calls needed, if independent", `Allowing for orders (design effect ${cl.deff.toFixed(2)})`, `At M2's default of ${pct(MARGIN, 1)}, allowing for orders`], ctl.clustered_calls.map((m) => [word(m.errors), int(m.calls), `about ${int(m.clustered)}`, `about ${int(m.margin_clustered)}`]), "num")}
  <p class="small">Invoices on one order succeed or fail together, so a kind needs more calls than the independent count (requirement M10). The right-hand column uses the design effect measured on the rulebook's paid lines in the study; a proposal measures its own.</p>
  <p>The pilot as a whole is accepted when the Gate 4 review (section 7) is signed.</p>`));

  const ev = [
    ["A simple rule", "A fixed checklist from past records", int(d.held_out_n), int(d.a.held_out.coverage[0]), "none paid", "none paid", "Almost nothing"],
    ["Claude checking each invoice", "The AI reads each invoice and decides", b2 ? int(b2.b_alone.n) + " (follow-up)" : int(d.sample_n), b2 ? int(b2.b_alone.passed) : int(d.b.sample.passed), b2 ? int(b2.b_alone.wrong) : int(d.b.sample.errors), b2 ? pct(b2.b_alone.lower, 2) : pct(d.b.lower, 2), `About $${((b2 ? b2.cost.usd * 1000 / b2.b_alone.n : d.cost.b.usd * 1000 / d.sample_n)).toFixed(2)} per 1,000 invoices`],
    ["Claude's rulebook", "The AI writes rules once; software applies them", int(d.held_out_n), int(b.paid), int(b.wrong), pct(c.held_out.precision_lower, 2), `About $${cOnce.toFixed(2)} to write, nothing per invoice`],
  ];
  out.push(sec("s4", "4", "Evidence base", `
  <p>All figures come from the main report. Each approach could only pay an invoice without a check or hold it for a person, and each was scored against what really happened.</p>
  ${tbl("The three approaches on the test invoices (the bar: worst likely case of at least 99%)", ["Approach", "What it is", "Invoices judged", "Paid without a check", "Of those, wrong", "Worst likely case", "Cost to run"], ev)}
  <p><strong>The baseline to beat.</strong> The study's simple rule could not use the supplier. After the fact, a non-AI rule (the supplier shortlist) grouped by ${esc(d.evidence.vendor.picked)} paid ${pct(d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked).coverage, 1)} of the test invoices with a worst likely case of ${pct(d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked).lower, 2)}, resting on ${int(d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked).vendors)} suppliers (post hoc). On a later month it paid too few lines to prove the bar (main report, Method: "A later check: September 2018"). Requirement M11: any proposal must beat the same supplier shortlist, refitted on the issuer's own recent data in Phase 0.</p>
  <h3>Three ways to grant trust, on the same test invoices</h3>
  ${tbl("How trust was granted, and what it let through", ["Way", "Invoices paid", "Wrong", "Wrong rate", "Note"], [
    ["Trusted from day one (on paper)", int(b.paid), int(b.wrong), pct(b.wrong / b.paid, 2), "The ceiling; never tested live"],
    ["Earned on outcomes (replay)", int(t.passed), int(t.wrong), pct(t.wrong / t.passed, 1), `First kind in week ${firstWk} of the replay's ${d.replay.weeks.length} (ISO week ${firstIso}); all ${int(t.wrong)} mistakes in one kind, ${int(d.evidence.replay.top_order)} on one order; window too short for the steady state`],
    ["Trusted on agreement (simulation)", half(ag.passed_median), half(ag.wrong_median), `${pct(Calc.agPooled(d), 2)} across all runs`, `Reviewers copy ${Math.round(+AGREE * 10)} in 10; medians of ${SIM_RUNS} runs; assumed behaviour, not a study of people`],
  ])}
  ${bars("Lines paid that needed a correction", [["Earned on outcomes", t.wrong, int(t.wrong)], ["Trusted on agreement (simulation, assumed behaviour)", ag.wrong_median, half(ag.wrong_median), true]])}
  <p>In the simulation, trusting on agreement let through about ten times as many lines that needed a correction, at a lower rate per line, because it paid far more. The count is not why requirement M2 forbids it: when reviewers copy, agreement carries no information about whether the AI is right.</p>
  <h3>Limits of the evidence</h3>
  ${tbl("What the evidence can and cannot carry", ["Limit", "What it means for a proposal"], [
    ["Look-ahead", `The learning months' rates include outcomes that landed after the test began, and test outcomes helped choose invoices as the subject. A live system would not have either. Direction of the effect: not established.`],
    ["Forking paths", `${int(d.post_result.length)} changes were made after a test result was known (listed in the main report's Method section), including a new comparison rule and a second run.`],
    ["Repeated looks", `The replay's gate looked ${int(ctl.gate_looks)} times across ${int(ctl.gate_kinds)} kinds (every week a kind still in practice mode had settled calls), and both promotions came the first time a worst likely case crossed 99% (${pct(pr1.lower, 3)} and ${pct(pr2.lower, 3)}): an early pass by chance (${wkL(pr1.week)}); a borderline kind passing on its best week (${wkL(pr2.week)}). A test repeated every week passes by chance more often than once, so M2 asks for a rule that holds under weekly looks. That costs time: ${m2Line}, and it would have paid ${int(m2d.passed)} lines on their own.`],
    ["Clustering", `Invoices on the same order fail together. Allowing for that, the rulebook's worst likely case falls from ${pct(c.held_out.precision_lower, 2)} to ${pct(d.evidence.clustering.clustered_lower, 2)}. Intervals in a proposal must allow for it.`],
    ["Suppliers", `Counted with whole suppliers as the units, the rulebook's paid lines have a design effect of about ${int(Math.round(rv.deff))} across ${int(rv.vendors)} suppliers (worst likely case ${pct(rv.clustered_lower, 2)}). The supplier shortlist holds at ${pct(wl.by_vendor.clustered_lower, 2)} that way, but rests on ${int(wl.vendors)} suppliers. A policy built on a list of suppliers relies on those suppliers staying as they were (M10).`],
    ["Label", `"Needed a correction" is broad. Moving it one way at a time does not prove the bar: dropping delivery-indicator-only corrections gives ${pct(d.evidence.sensitivity.drop_cdi.clustered_lower, 2)} allowing for orders; counting corrections after clearing gives ${pct(d.evidence.sensitivity.post_clear_lower, 2)}.`],
  ], "fit")}
  ${list(["One company's records, from 2018. The method carries over; the numbers are theirs.", `"Fine" means no one corrected the invoice before payment. Counting corrections made after clearing, which the label leaves out, lowers the rulebook's worst likely case to ${pct(d.evidence.sensitivity.post_clear_lower, 2)}; corrections outside these records can't be counted.`, "The records hold no invoice text, so the AI never read an invoice document.", "The share of lines a person reviews, minutes per review and hourly cost are inputs, not measurements. The records hold logins and times, and most clearing steps in them are bulk postings."])}`));

  out.push(sec("s5", "5", "Assumptions, constraints and dependencies", `
  <h3>Assumptions (mine; replace them with your own in Phase 0)</h3>
  ${tbl("Assumptions", ["Assumption", "Default", "Why"], [
    ["Unit", "The order line", "The records have no invoice-document field"],
    ["Share of lines a person reviews today", "Not assumed: Phase 0 measures it", "The records show logins and times, not reviews"],
    ["Minutes per review, hourly cost", `${DEF_MIN} minutes, $${DEF_RATE} (my defaults; Phase 0 measures the issuer's own)`, "The records show when work happened, not how long it took"],
    ["Cost of a late fix", `$${DEF_FIX} of work, plus ${DEF_LOST}% of the line's value never recovered (my defaults; Phase 0 measures the issuer's own)`, "The records don't show it"],
    ["Oversight during the pilot", `${OVERSIGHT_H} hours a week`, "My judgment"],
    ["Phases 0, 2 and 3", `${PH.p0}, ${PH.p2} and ${PH.p3} weeks`, "My judgment"],
    ["Phase 1 (practice mode)", `At least ${firstWk} weeks, at most ${stopWk}`, `The earliest a kind qualified in the replay, under its single-crossing rule; ${m2Line}. Outcomes arrive weeks after invoices. The stop rule ends the pilot at week ${stopWk} (section 7)`],
    ["Procurement, before Phase 0", `About ${PROC} weeks`, "The timetable in section 12, from issue to the award decision"],
    ["Shorter pilots", "Not used", `Too few outcomes for this bar: in the replay the first kind qualified only in week ${firstWk} of the replay, because outcomes arrive weeks after invoices`],
    ["Volume", "No seasonality", "A simplification"],
  ])}
  <h3>Constraints</h3>
  ${list(["Nothing is paid on the decision component's say-so before Gate 2.", "Existing payment, approval and fraud controls stay in force throughout.", "The company's own policies override this document wherever they differ."])}
  <h3>Dependencies</h3>
  ${list(["Access to outcome data, including corrections made after payment.", "A named Component Owner and a Pilot Owner before Phase 0 ends.", "A place to log every call, its inputs and its outcome.", "Each line's price and quantity differences between invoice, order and goods receipt, as an input the decision component and the scoring can use. The study's rulebook did not use them.", "The data-protection requirements (M13) met and checked before any real invoice data is used."])}`));

  // Each requirement keeps only what the pilot shall do; why it is asked sits in Appendix F, keyed by its number.
  const why = (m) => ` <a class="why" href="#why-${m.toLowerCase()}">Why: Appendix F</a>`;
  out.push(sec("s6", "6", "Requirements", `
  <p>A proposer shall state, for each requirement, how the pilot will meet it and how the test will be run. <strong>Failing any M requirement disqualifies the proposal</strong>; the M requirements are pass/fail and carry no points (section 12).</p>
  <p><strong>The requirements are outcomes, not a design.</strong> They apply to <em>the decision component</em>: whatever makes the pay-or-hold call on a line, whether a rulebook written once and applied by software, a model called on each invoice, a trained classifier or a rules engine. Any approach that meets them may be proposed. The rulebook the study tested is the issuer's reference design, described in Appendix E; it is not a requirement.</p>
  ${tbl("Mandatory requirements", ["Ref", "The pilot shall", "Test"], [
    ["M1", "Start in practice mode on every kind of invoice, with people handling every invoice. The decision component's calls are hidden from the people who handle invoices: no screen, report or queue order they see shows or hints at a call.", "No invoice is paid on the decision component's say-so before Gate 2, and a check of the processors' screens and reports in Phase 0 finds no call."],
    ["M2", `Promote a kind of invoice only on its real outcomes, never on how often reviewers agree, by a rule that keeps the chance of ever promoting a kind whose true rate is below 99%, across all its weekly looks for the planned length of Phase 1, at or below 5%: a named sequential method (a confidence sequence or alpha spending), or my default: its worst likely case, allowing for orders, at or above ${pct(MARGIN, 1)} at ${word(CONSEC).toLowerCase()} weekly looks in a row.${why("M2")}`, "Shown by simulation at a true 99.0%, at the kind's volume and design effect, or on the issuer's earlier months: at most 5% of kinds promoted. Each promotion record cites outcome counts and every look taken."],
    ["M3", `Switch a kind off automatically when the upper end of the two-sided 95% Wilson interval of its last ${int(ctl.window)} settled calls paid on its own, taken in arrival order, falls below 99%. After promotion, also switch it off when the lower end of the two-sided 95% Wilson interval of its error rate, on every settled call it has paid on its own since promotion, rises above the upper end of the error interval it was promoted on. Both outcome streams (M9) count; a line flagged by both counts once.`, "A seeded failure switches the kind off; so does a seeded slow rise above the promotion interval."],
    ["M4", "Log every call, its inputs and its outcome, and keep the log for the retention period in section 10.", "An auditor can trace any paid invoice back to its call."],
    ["M5", "Have a named person review and sign off each version of the decision component (its rules, prompts, model and settings) before use, under change control. Trust belongs to the version that earned it: a new version keeps a kind's promotion and practice-mode record only if every part that can apply to that kind is unchanged, read side by side in both versions and signed as such, and, as a check, both versions make the same call on every line of that kind logged so far. Any other kind goes back to practice mode with no evidence.", "Every version in use has a signed record. A seeded change that alters one kind's calls sends that kind, and only that kind, back to practice mode."],
    ["M6", "Count corrections made after payment as mistakes.", "The outcome feed includes post-payment corrections."],
    ["M7", `Confirm in writing, before Gate 1, the 99% bar, the cost of a late fix, the correction budget (section 7), any value limit and when a call counts as settled. The budget is binding: going over it switches every kind off at once until the sponsor decides.`, "A signed Gate 1 record exists; a seeded breach of the budget switches every kind off."],
    ["M8", "Provide a kill switch that the Pilot Owner and the Finance Controller can use without the supplier.", "Tested in Phase 0."],
    ["M9", `Check a sample of the lines each kind paid on its own blind, window by window. A window runs at least a month, until the kind has paid ${int(b.blind.n)} lines on its own, and no longer than a calendar quarter. Each window a reviewer who does not see the AI's call checks ${int(b.blind.n)} of its lines, drawn as whole purchase orders, or all of them if fewer were paid, and reports the power reached. Keep two outcome streams and log both: corrections raised by suppliers and purchasing, and blind-check findings. The switch-off (M3) runs on both.${why("M9")}`, "The blind-check log shows each sample, who checked it, that the call was hidden, and which stream each outcome came from."],
    ["M10", `Give every interval allowing for purchase orders (cluster-robust at order level), state the method, and show a worked example. For a policy built on a list of suppliers, also give the bound with suppliers as the units, or state that it relies on the suppliers listed.${why("M10")}`, "Every promotion record shows the order-level bound, the method, and the supplier-level bound where it applies."],
    ["M11", `Beat the same supplier shortlist, refitted on the issuer's own recent data in Phase 0. The issuer, not the proposer, builds it on its recent months: every cell of ${esc(d.evidence.vendor.picked)} whose worst likely case on those months is at least 99%. On the same held-out months, the proposal must reach a worst likely case of 99% allowing for orders and pay more lines than the supplier shortlist; if the shortlist itself misses 99% there, the proposal must still reach 99% and pay more lines than the shortlist cells that do.${why("M11")}`, "Both are scored by the issuer on the same held-out months before Gate 2; a proposal that does not beat the supplier shortlist is disqualified."],
    ["M12", `Pay at most ${word(ORDER_CAP).toLowerCase()} lines of one purchase order on their own (my default; the issuer sets the number at Gate 1); the order's later lines go to a person, as they do today.${why("M12")}`, "A seeded order with more lines than the cap stops at the cap."],
    ["M13", "Meet every data-protection requirement in the table below before any invoice, supplier or call data leaves the company, and keep to them for as long as any of it is held.", "Each item has the evidence named in the table, checked by Risk and Compliance before Phase 0 uses real data."],
      ["M14", "Run the company's existing duplicate-payment and fraud checks on every line paid on its own, before it is paid, exactly as on lines a person pays. The pilot does not replace, skip or reorder them.", "In Phase 0, a seeded duplicate of a line already paid, sent down the path for lines paid on its own, is stopped before payment."],
    ["M15", `Hold for a person any line with no goods receipt recorded when its invoice arrives, whatever its kind's record. No goods receipt yet means hold.${why("M15")}`, "A seeded line with no goods receipt, in a kind that is paid on its own, is held."],
  ], "fit cards")}
  ${tbl("Data protection (all mandatory, under M13)", ["Ref", "The proposer shall", "Evidence"], [
    ["DP1 Retention and training use", `Keep invoice, supplier and call data only as long as the pilot and the retention period in section 10 need it, delete it on request, and never use it to train or improve any model without the company's written consent.`, "Contract terms, and the written data-use terms of any model provider used, for the plan used"],
    ["DP2 Residency", `Store and process the data only in ${fill("permitted countries or regions")}, including backups and any model calls.`, "A data-flow map naming each location"],
    ["DP3 Sub-processors", `List every sub-processor, including any model provider, give ${fill("e.g. 30")} days' notice of any change, and let the company object.`, "The current list, and the change-notice clause"],
    ["DP4 Breach notice", `Tell the company of any breach affecting its data within ${fill("e.g. 72")} hours of finding it, with what is known and what is being done.`, "The contract clause and an incident contact"],
    ["DP5 Attestations", `Hold a current independent security attestation covering the service, such as ${fill("e.g. an ISO/IEC 27001 certificate or a SOC 2 Type II report")}.`, "The report or certificate, with its date and scope"],
    ["DP6 Data-processing agreement", "Sign the company's data-processing agreement before any real data is shared, and send only the fields the decision component needs.", "The signed agreement and the field list"],
  ], "fit")}
  <h3>How the switch-off test works (M3), in numbers</h3>
  <p>The test uses the two-sided 95% Wilson interval. A call is <em>settled</em> once its line has been cleared for payment and ${SETTLE_DAYS} days have passed (my default; the issuer sets it at Gate 1), with any correction in that time counted against it. In the study, of the ${int(sl.lines)} paid lines with a correction after clearing (${int(d.evidence.sensitivity.post_clear)} scored fine, the other ${int(sl.lines - d.evidence.sensitivity.post_clear)} already counted as needing one), ${pct(sl.within[String(SETTLE_DAYS)], 0)} were corrected within ${SETTLE_DAYS} days, ${pct(sl.within["60"], 0)} within 60 and ${pct(sl.within["90"], 0)} within 90 (median ${int(sl.median_days)} days). So a correction found after a call is settled still counts: the call is re-scored, and the switch-off and the budget are recomputed. Only the last ${int(ctl.window)} settled calls the kind paid on its own count, in the order they arrived.</p>
  ${tbl("The switch-off at the edge", ["Wrong in the last " + int(ctl.window), "Right", "Interval", "Result"], [
    [int(ctl.fires_at - 1), `${pct(1 - (ctl.fires_at - 1) / ctl.window, 1)}`, `${pct(ctl.tolerated_lower, 2)} to ${pct(ctl.tolerated_upper, 2)}`, "Upper end above 99%: the kind stays on"],
    [int(ctl.fires_at), `${pct(1 - ctl.fires_at / ctl.window, 1)}`, `up to ${pct(ctl.fires_upper, 2)}`, "Upper end below 99%: the kind is switched off"],
  ], "fit")}
  <p><strong>In plain words:</strong> under the first test alone, a kind may run at up to ${int(ctl.fires_at - 1)} wrong in ${int(ctl.window)} (${pct((ctl.fires_at - 1) / ctl.window, 0)}), ${word(Math.round((ctl.fires_at - 1) / ctl.window / (1 - d.bar.bar))).toLowerCase()} times the ${pct(1 - d.bar.bar, 0)} the bar allows, and still stay on; the ${int(ctl.fires_at)}th switches it off. The second test watches every call since promotion: for the replay's first kind (promoted with an error interval up to ${pct(st1.err_upper, 2)}) it fires at ${int(st1.fires_200)} wrong in the first ${int(ctl.window)} and at ${int(st1.fires_1000)} in 1,000 (${pct(st1.fires_1000 / 1000, 1)}), so a kind slipping to between 1% and 2% is caught once enough calls build up. On ${int(ctl.window)} calls the test catches a kind truly running at 2% only ${pct(ctl.power_window, 0)} of the time. That is why the budget in M7 is binding and the blind checks are sized larger. In the replay, the first kind was promoted in ${wkL(pr1.week)} on ${int(pr1.evidence[0])} of ${int(pr1.evidence[1])} right, and switched off in ${wkL(dm.week)} at ${int(dm.recent[0])} of ${int(dm.recent[1])}, after its recent calls had run well past the edge.</p>
  ${tbl("Desirable requirements", ["Ref", "The pilot should", "Why"], [
    ["D1", "Set a value limit above which a person always checks.", "Most of the mistakes' value sat in the largest invoices in the study. A proposal I did not test."],
    ["D4", "Provide an exit plan and keep the data portable.", "A supplier or model may change."],
  ])}`));

  const ph = [
    ["0 Mobilise", `${PH.p0} (my assumption)`, "Name owners; consult the accounts-payable staff and their representatives (a works council where there is one) on how roles and workload change, and plan redeployment of freed hours; measure the baseline (share of lines a person reviews, minutes per review, cost of a late fix as the work plus the share of value never recovered, mistake rate); have an accounts-payable reviewer sign off the list of corrections that count as a mistake, deciding explicitly on Change Approval for PO; write the bar and the budget for lines paid that need a correction down; test the kill switch.", "G1: sponsor and finance approve the bar and the budget, and Phase 0's measured share reviewed, minutes per review and late-fix cost give a positive net after running costs (worked out in the issuer's internal case); otherwise stop"],
    ["1 Practice mode", `At least ${firstWk}, at most ${stopWk} under the stop rule (the replay's first kind qualified in week ${firstWk} of the replay, ISO week ${firstIso}, under its own single-crossing rule, and was switched off again later; ${m2Line}); it ends when G2 holds, and depends on your volume per kind`, "The decision component makes calls on every kind; people handle every invoice without seeing those calls (M1); every call is scored when its outcome arrives.", "G2: at least one kind meets the bar on its outcomes"],
    ["2 Limited autonomy", `${PH.p2} (my assumption)`, "Qualified kinds only. Automatic switch-off stays on. Blind checks run window by window (one month to one quarter) on each kind paid on its own (M9).", "G3: results review; the correction budget was respected"],
    ["3 Review", `${PH.p3} (my assumption)`, "Compare real figures with the assumptions; decide the next step.", "G4: formal decision to expand, extend or stop"],
  ];
  out.push(sec("s7", "7", "Pilot plan, gates and decision points", `
  <p>The plan runs at least ${totalWeeks} weeks (${(totalWeeks * 12 / 52).toFixed(1)} months), with Phase 1 at its minimum of ${firstWk} weeks, and at most ${maxWeeks} weeks (${(maxWeeks * 12 / 52).toFixed(1)} months): if no kind has qualified by week ${stopWk} of practice mode, the stop rule ends the pilot. How long it takes between the two depends on volume; no gate may be skipped. Procurement comes first: about ${PROC} weeks from issue to the award decision (section 12).</p>
  ${tbl("Phases and gates", ["Phase", "Weeks", "What happens", "Gate to leave"], ph)}
  <h3>Stop criteria</h3>
  <p>The Pilot Owner shall recommend stopping, and the sponsor shall decide, if any of these holds:</p>
  ${list([
    "The correction budget fixed at Gate 1 is exceeded. This also switches every kind off at once (M7).",
    "The pilot's own measured cost of a late fix exceeds the break-even in the issuer's internal case, recalculated at the pilot's own measured mistake rate.",
    `No kind of invoice has qualified by week ${stopWk} of practice mode (my judgment: twice the replay's ${firstWk}; the issuer sets its own). Under M2's default this may end the pilot: on the study's data no kind qualified in ${int(nWeeks)} weeks.`,
    "Outcome data, including corrections after payment, cannot be obtained.",
    "A control in section 10 cannot be met.",
  ])}
  <h3>The correction budget</h3>
  <p>Gate 1 sets the budget in two parts, count and value (M7). Unless the issuer sets its own, my default is a fixed count: ${pct(DF.budget_share, 0)} of the lines Phase 2 is planned to pay on their own (the bar itself), written down as a number at Gate 1, with their total value under ${fill("US$ cap set by Finance at Gate 1")}. It is a number fixed in advance, not a running share, so one early mistake does not trip it. Going over either part switches every kind off at once. Had the plan been the replay's ${int(t.passed)} lines, the count would have been ${int(ctl.budget_count_replay)}; the replay had ${int(t.wrong)} (${pct(t.wrong / t.passed, 1)}), so it would have been exceeded.</p>
  <div class="callout gate4"><p><strong>Success at Gate 4.</strong> The pilot succeeds only if all four hold:</p>
  ${list([
    "At least one kind of invoice is still paid on its own at the end of Phase 2.",
    "Lines that needed a correction stayed within the budget, in count and in value.",
    "The pilot's measured cost of a late fix is below the break-even in the issuer's internal case, recalculated at the pilot's own measured error rate.",
    "The share of the on-paper volume it earned is above the share the issuer's internal case needs to repay the pilot in its first year after, worked out on the pilot's own measured figures.",
  ], "ol")}
  <p class="small">Anything less is a stop or an extension, decided at Gate 4; it is not a roll-out.</p></div>`));

  /* Columns: Sponsor, Pilot Owner, Finance Controller or Internal Control, Internal Audit, Risk and Compliance, IT and Data,
     Component Owner, accounts-payable team lead. One A per row. Whoever writes a version does not sign it; whoever signs it
     does not approve its promotions; promotions, switch-offs and the monthly review are accountable outside the pilot team. */
  const raci = [
    ["Approve the bar, the pilot budget and the correction budget", "A", "R", "C", "C", "C", "I", "I", "C"],
    ["Write or change a version of the decision component", "I", "I", "I", "I", "I", "A/R", "C", "C"],
    ["Sign off a version of the decision component", "I", "C", "I", "C", "C", "C", "A/R", "C"],
    ["Approve a promotion of a kind", "I", "R", "A", "C", "I", "I", "I", "C"],
    ["Confirm or override an automatic switch-off", "I", "R", "A", "I", "C", "C", "I", "C"],
    ["Run the blind checks (M9)", "I", "C", "A", "C", "I", "C", "I", "R"],
    ["Review outcomes each month", "I", "R", "A", "C", "I", "R", "I", "C"],
    ["Hold the audit trail (write-once)", "I", "C", "C", "A", "C", "R", "I", "I"],
    ["Make the Gate 4 decision", "A/R", "R", "C", "C", "C", "C", "C", "C"],
  ];
  out.push(sec("s8", "8", "Governance and responsibilities", `
  <p>R is responsible, A accountable, C consulted, I informed. Names are blank; the roles are mine.</p>
  ${tbl("Responsibilities", ["Activity", "Sponsor", "Pilot Owner", "Finance Controller or Internal Control", "Internal Audit", "Risk and Compliance", "IT and Data", "Component Owner", "Accounts-payable team lead"], raci, "raci")}
  ${tbl("Named people", ["Role", "Name", "Date appointed"], ["Executive Sponsor", "Pilot Owner (accounts payable)", "Finance Controller or Internal Control", "Internal Audit", "Risk and Compliance", "IT and Data", "Component Owner", "Accounts-payable team lead"].map((r) => [r, fill("Full name, title"), fill("DD Month YYYY")]))}
  <p><strong>Segregation of duties.</strong> Whoever writes or changes a version of the decision component (IT and Data, or the proposer under its direction) shall not sign it. The Component Owner who signs it shall not approve its promotions. Promotions, decisions to confirm or override an automatic switch-off, and the monthly review are accountable to the Finance Controller, or to Internal Control where the company has one, not to the Pilot Owner who runs the pilot. The blind checks, the independent outcome source that can switch the pilot off, are accountable to the Finance Controller or Internal Control and run by the accounts-payable team lead, not by the Pilot Owner. The audit trail is accountable to Internal Audit and kept write-once; IT and Data operate it but, since they also write the decision component, cannot change it. The accounts-payable team lead is consulted throughout. The Pilot Owner reports to the sponsor at each gate.</p>`));

  const risks = [
    ["R1", "A line that needs a correction is paid", "High", "Medium", `${int(b.wrong)} of ${int(b.paid)} lines on paper; ${int(t.wrong)} of ${int(t.passed)} in the replay`, "M1, M2, M3, M7, M9, M12", "Pilot Owner"],
    ["R2", "A late fix costs more than the break-even", "Medium", "High", `Cautious break-even: ${int(L.gated_cautious)} lines per mistake × share reviewed × cost of a review`, "Measure it in Phase 0; stop rule", "Finance Controller"],
    ["R3", "Mistakes concentrate in one kind of invoice", "Medium", "Medium", `The replay's ${int(t.wrong)} mistakes were ${er.kinds === 1 ? "all in one kind" : `in ${int(er.kinds)} kinds`}, ${int(er.top_order)} of them on one order`, "Promote kind by kind; M3; M12", "Pilot Owner"],
    ["R4", "The decision component goes stale", "High", "Medium", "Suppliers, prices and buying habits change", "M5: a rewrite that changes a kind's rules restarts its practice mode, so changes follow a schedule the evidence can keep up with; retest before each", "Component Owner"],
    ["R5", "Mistakes found after payment go unnoticed", "Medium", "High", "Not in the study's records", "M6", "Finance Controller"],
    ["R6", "Reviewers copy the AI's suggestion", "Medium", "High", "The agreement simulation", "M1 (calls hidden in practice mode), M2, M9", "Internal Audit"],
    ["R7", "A few large invoices carry most of the value at risk", "Medium", "High", `${pct(v.wrong / v.paid, 1)} of paid value from ${pct(b.wrong / b.paid, 2)} of invoices`, "D1", "Risk and Compliance"],
    ["R8", "Fraud or duplicate payments", "Medium", "High", "Not tested: the records have no duplicate or fraud label. Paying a line on its own takes away the person who might have spotted one", "M14: the existing duplicate and fraud checks run on every line paid on its own", "Risk and Compliance"],
    ["R9", "Privacy or supplier-data terms are breached", "Medium", "High", "A live pilot sends supplier and invoice data to an outside service and, for some designs, an outside model; the study sent none", "M13 and the data-protection table (section 6)", "Risk and Compliance"],
    ["R10", "Roles and workload change for accounts-payable staff", "Medium", "Medium", "Not tested", "Consult the staff affected and their representatives (a works council where there is one) in Phase 0, before any kind is paid on its own; plan where the freed hours go, including redeployment", "Executive Sponsor"],
    ["R11", "The AI model or a supplier changes", "Medium", "Medium", "Models can change behaviour", "Retest on every change; D4", "IT and Data"],
    ["R12", "Seasonal volume hides a weakness", "Medium", "Medium", `The test covered ${b.months} months`, "Track by month through Phase 2", "Pilot Owner"],
    ["R13", "Staff lose practice on the kinds the AI pays (deskilling)", "Medium", "Medium", "Not tested; a switch-off hands a kind straight back to people", "Blind checks (M9) run by the accounts-payable team; rotate reviewers across kinds; keep written procedures for every kind", "Accounts-payable team lead"],
  ];
  out.push(sec("s9", "9", "Risk register", `
  <p>The ratings are my judgment, not measurements. Replace them with the company's own scale in Phase 0.</p>
  ${tbl("Risks", ["Ref", "Risk", "Likelihood", "Impact", "Evidence", "Mitigation", "Owner"], risks, "cards")}
  <p class="small">Risks beyond lines paid that need a correction (R4 to R13) are not measured by the study. They are what I would expect a risk committee to ask about.</p>`));

  out.push(sec("s10", "10", "Controls and compliance", `
  ${list([
    "<strong>Segregation of duties.</strong> Who writes a version of the decision component, who signs it and who approves promotions are different people. The blind checks are accountable outside the pilot team (Finance Controller or Internal Control), and the audit trail is write-once and accountable to Internal Audit (section 8).",
    "<strong>Change control.</strong> A version of the decision component is not used until signed. A change to the bar, a limit or a phase length is a recorded change approved at a gate.",
    "<strong>Audit trail.</strong> Every call, input and outcome is logged and kept for the retention period the company's policy sets: " + fill("e.g. 7 years, per records policy") + ".",
    "<strong>Independent review.</strong> Internal Audit reviews a sample of paid invoices before Gate 3.",
    "<strong>Data protection.</strong> Nothing leaves the company until every item under M13 is met; Risk and Compliance checks them before Phase 0 uses real data and at each gate.",
    "<strong>Existing controls.</strong> Payment-approval limits, fraud and duplicate checks and period-end controls stay in force, on lines paid on their own as on every other line (M14).",
    "<strong>Regulation.</strong> The company's compliance function decides which rules apply. This document does not state any.",
  ])}`));

  const bl = b.blind, bad = 1 / L.gated_cautious;
  const req = (t) => `<strong>Required.</strong> ${t}`;
  // How M9's window is sized. The internal case adds what that sizing means for its own cost.
  const blindSizing = (costed) => `The switch-off test on ${int(bl.n)} lines catches a true ${pct(bl.q, 0)} error rate ${pct(bl.power, 0)} of the time. Power does not rise smoothly with the window: ${int(bl.first_n)} lines already reach 80%, but ${int(1000)} fall back to ${pct(bl.power_1000, 0)}, so I size in steps of 50 to the first that holds. On paper, ${word(ctl.kinds_month_full).toLowerCase()} of the ${int(ctl.kinds_paid)} kinds the rulebook pays reach ${int(bl.n)} lines a month; the replay's first kind pays about ${int(ctl.first_kind_month)} (all of a month's lines reach ${pct(ctl.power_first_kind_month, 0)} power), and ${int(ctl.kind_months.filter((x) => x <= 200).length)} pay 200 or fewer, so for them every line paid alone is checked${costed ? ", which leaves no saving. The cost here is monthly, the cautious end, and never counts more checks than lines paid alone" : ""}. ${int(ctl.small_n)} lines would catch it only ${pct(ctl.power_400, 0)} of the time. Drawn as whole purchase orders, lines on one order are not independent, so this power holds only if the window is enlarged by the kind's own design effect, measured in practice mode${costed ? `; the cost here uses ${int(bl.n)}` : ""}.`;
  const priced = (t) => `<span class="small">${t}</span>`;
  /* 11. The request: the cost lines a proposer prices. The issuer's own lines are named but not priced here. */
  out.push(sec("s11", "11", "Cost lines to price", `
  <p>A response prices every line marked <em>proposer prices</em>, in this format, with every assumption stated; the evaluated price in section 12 is their total. The issuer's own lines are listed so the whole pilot is in view; the issuer prices them itself and does not share them.</p>
  ${tbl("Cost lines", ["Line", "Basis", "Amount"], [
    [`Phase 0: set-up and baseline${priced("Issuer's own line")}`, `Oversight hours a week × ${PH.p0} weeks × hourly cost`, "Not priced by the proposer"],
    [`Oversight, phases 1 to 3${priced("Issuer's own line")}`, "Oversight hours a week × the weeks of phases 1 to 3 × hourly cost", "Not priced by the proposer"],
    [`Blind checks (M9)${priced("Issuer's own line")}`, `${int(bl.n)} lines a kind of invoice per check window × minutes per review, run by the accounts-payable team lead (section 8). How the window is sized is below`, "Not priced by the proposer"],
    [`Weekly reconciliation of calls against outcomes${priced("Issuer's own line")}`, "Hours a week × the weeks of the pilot", "Not priced by the proposer"],
    [`Audit${priced("Issuer's own line")}`, "Internal Audit's review before Gate 3 (section 10)", "Not priced by the proposer"],
    [`Training, staff consultation and change management${priced("Issuer's own line")}`, "", "Not priced by the proposer"],
    [`Integration and data access${priced(req("Proposer prices its part"))}`, "One-off", fill("US$ amount")],
    [`Supplier fees${priced(req("Proposer prices"))}`, "Fixed and variable", fill("US$ amount")],
    [`Model or API use${priced(req("Proposer prices"))}`, "Per call or per version, with any model named", fill("US$ amount")],
    [`Hosting and logging${priced(req("Proposer prices"))}`, "For the pilot and the retention period", fill("US$ amount")],
    [`Outcome scoring${priced(req("Proposer prices"))}`, "Matching each call to its outcome as it arrives", fill("US$ amount")],
  ], "cards")}
  <p class="small">For reference, writing the study's rulebook (the reference design, Appendix E) cost $${cOnce.toFixed(2)} at API list prices on the run date, and nothing per line. A proposal prices its own design in the lines above.</p>
  <h3>How the blind-check window is sized (M9)</h3>
  <p>${blindSizing(false)}</p>`));
  /* 2. The internal case: the cost lines at the reader's inputs, the saving and the return. */
  cs.push(sec("s2", "2", "Cost model and expected benefit", `
  <p>These figures use your inputs. The defaults are my assumptions, not measurements. Change them to match the company; everything below updates. Every count is in order lines.</p>
  ${Calc.html("in", `The share reviewed is the figure the saving rests on, and the records can't show it: ${pct(iso, 1)} of the lines the rulebook would have paid show a person's own step, a footprint, not proof of review. Until you enter it, results that need it use every line (100%) and say "upper limit". The tables below show the working.`)}
  ${tbl("Cost lines", ["Line", "Basis", "Amount"], [
    [`Phase 0: set-up and baseline<span class="small">My assumption</span>`, `<span data-out="p0-basis"></span>`, `<span data-out="p0-cost"></span>`],
    [`Oversight, phases 1 to 3<span class="small">My assumption</span>`, `<span data-out="oh-basis"></span>`, `<span data-out="oh-cost"></span>`],
    [`Blind checks<span class="small">${req("M9, sized to catch a doubled error rate")}</span>`, `${int(bl.n)} lines a kind of invoice per check window × your minutes per review = <span data-out="blind-h"></span> a kind a window. ${blindSizing(true)}`, `<span data-out="blind-cost"></span> a kind a window; <span data-out="blind-pilot"></span> in the pilot`],
    [`Weekly reconciliation of calls against outcomes<span class="small">${req("Yours to estimate")}</span>`, "Hours a week × the weeks of the pilot", fill("US$ amount")],
    [`Writing the rulebook (the reference design, ${isCase ? '<a href="rfp.html#ap">the request\'s Appendix E</a>' : "Appendix E"})<span class="small">Measured</span>`, "At API list prices on the run date; nothing per line. A proposal prices its own design in the lines below", `$${cOnce.toFixed(2)}`],
    [`Integration and data access<span class="small">${req("Yours to enter above")}</span>`, "One-off", `<span data-out="int-cost"></span>`],
    [`Supplier fees<span class="small">${req("Proposer to price")}</span>`, `Fixed and variable (${rq(11)})`, fill("US$ amount")],
    [`Model or API use<span class="small">${req("Proposer to price")}</span>`, "Per call or per version, with any model named", fill("US$ amount")],
    [`Hosting and logging<span class="small">${req("Proposer to price")}</span>`, "For the pilot and the retention period", fill("US$ amount")],
    [`Outcome scoring<span class="small">${req("Proposer to price")}</span>`, "Matching each call to its outcome as it arrives", fill("US$ amount")],
    [`Audit<span class="small">${req("Yours to estimate")}</span>`, `Internal Audit's review before Gate 3 (${rq(10)})`, fill("US$ amount")],
    [`Training, staff consultation and change management<span class="small">${req("Yours to estimate")}</span>`, "", fill("US$ amount")],
    ["Total so far", "Phase 0, oversight, the rulebook, blind checks (M9: monthly windows during Phase 2, on the kinds you enter above), and integration if entered. Not the required lines still blank", `<span data-out="total"></span>`],
  ])}
  <p><strong>No saving for at least ${f.dryWeeks} weeks.</strong> Nothing is paid without a person in Phase 0 (${PH.p0} weeks) or in practice mode (at least ${firstWk} weeks), so the pilot costs money for that long before it can save any. The costs here take Phase 1 at that minimum. <span data-out="oh-max"></span></p>
  ${tbl("Where the on-paper saving comes from", ["Step", "Figure"], [
    [`Order lines the rulebook would have paid, ${b.months} test months`, `${int(b.paid)} (about ${int(b.groups_paid)} invoice groups)`],
    ["Scaled to a year (no seasonality)", `× ${12 / b.months} = ${int(linesYr)}`],
    ["× share a person reviews today", `<span data-out="share-used"></span>`],
    ["× minutes per review ÷ 60 × hourly cost", `<span data-out="money2"></span>`],
    ["What it assumes", "Trust from day one: a ceiling, not a forecast"],
  ], "num")}
  ${bars(`Order lines paid without a person in the same ${b.months} months`, [["On paper (trusted from day one)", b.paid, int(b.paid)], ["Earned in the replay", g.passed, `${int(g.passed)} (${pct(g.earned_share, 1)})`, true]])}
  <p class="small">In the replay, trust began only in week ${firstWk} of the replay (ISO week ${firstIso}), so the window shows the slow start, not the steady state. I do not estimate the steady state.</p>
  <h3>For the executive decision: return on the pilot, by scenario</h3>
  <p>How much of the on-paper volume a company would earn the right to pay is what the pilot finds out. So the table shows scenarios, not a forecast.</p>
  ${tbl("Error rate used for the scenarios", ["Source", "Wrong rate"], [
    [`Test, on paper (${int(b.wrong)} of ${int(b.paid)})`, `${pct(1 / L.paper, 2)}; worst likely case ${pct(1 / L.paper_cautious, 2)}`],
    [`Replay, gated (${int(g.wrong)} of ${int(g.passed)}, ${word(g.top_order_wrong).toLowerCase()} on one order)`, `${pct(1 / L.gated, 2)}; likely ${pct(1 / L.gated_generous, 2)} to ${pct(bad, 2)}`],
    ["Used: the cautious end", pct(bad, 2)],
  ], "num")}
  <p class="small">A kind is only trusted once it proves 99%, so this rate is a cautious stand-in, not what the pilot would aim for. It is the same rate the break-even above uses. The same oversight hours continue after the pilot.</p>
  <div class="cost biz-tiles">
  <div><span class="small">Earned share needed to repay the pilot in its first year after</span><span class="big" data-out="need"></span><span class="small" data-out="need-note"></span></div>
  <div><span class="small">Lines paid that need a correction a year, at the full on-paper volume</span><span class="big" data-out="wrong-yr"></span><span class="small">Order lines, at the cautious rate above. Each is paid before a needed fix; it is not money lost.</span></div>
  </div>
  <p class="small note-int" data-out="roi-warn" role="status"></p>
  ${tbl("Return in the first year after the pilot, if it earns a share of the on-paper volume (scenarios, not forecasts; benefit during the pilot not counted)", ["Share earned", "Lines paid alone a year", "Needing a correction a year", "Gross saving", "Net yearly benefit", "First-year return on the pilot (ROI)", "Payback"],
    scenRows(g).map(([x, why], k) => [`${pct(x, x && x < 0.1 ? 1 : 0)}${why ? `<span class="small">${why}</span>` : ""}`, `<span data-out="sc-checks-${k}"></span>`, `<span data-out="sc-wrong-${k}"></span>`, `<span data-out="sc-gross-${k}"></span>`, `<span data-out="sc-net-${k}"></span>`, `<span data-out="sc-roi-${k}"></span>`, `<span data-out="sc-pay-${k}"></span>`]), "scen")}
  ${tbl("How each figure is worked out", ["Figure", "Formula"], [
    ["Gross saving", "Lines paid alone × share reviewed today × minutes per review ÷ 60 × hourly cost: review hours freed, priced. Capacity, not jobs"],
    ["Late-fix cost", "Lines paid alone × the cautious error rate × (work per fix + share never recovered × average value of a wrongly paid line)"],
    ["Net yearly benefit", "Gross saving − late-fix cost − oversight (hours a week × 52) − blind checks (kinds × 12 monthly windows × one window's cost, but never more checks than lines paid alone). At 0% earned nothing is paid on its own, so there are no blind checks and it is the oversight cost alone"],
    ["First-year ROI", "(Net yearly benefit − total pilot cost) ÷ total pilot cost"],
    ["Payback", "Total pilot cost ÷ monthly net benefit, from the end of the pilot"],
    ["Total pilot cost", "The cost lines above with a figure, blind checks included; integration only if entered"],
    ["Blind checks (M9)", `${WINDOWS_YR} windows a year (M9 sets the window at one month), about ${(PH.p2 * 12 / 52).toFixed(1)} during Phase 2, each ${int(b.blind.n)} lines a kind × minutes per review, on the kinds you enter, capped at the lines paid alone. Quarterly windows, M9's longest, are shown beside the decision as a sensitivity`],
    ["Not included", "The required lines still blank, discounting, tax, seasonality, benefit during the pilot"],
  ])}
  <p class="small">The ${pct(g.earned_share, 1)} row is what the replay earned on the same test lines; its window was too short to show the steady state, so it is a floor seen once, not an estimate. ${pct(SCEN[SCEN.length - 1], 0)} is the on-paper ceiling. None of these rows changes the verdict: no approach proved the 99% bar.</p>
  <p class="small">The baseline measures that replace these inputs are listed in <a href="rfp.html#ap">the request's Appendix C</a>; Phase 0 collects them before Gate 1.</p>`));

  out.push(sec("s12", "12", "Instructions to proposers, timetable and evaluation", `
  <p>A proposer may be an internal team or an outside supplier. A response shall follow the section numbers of this document, answer every M and D requirement in section 6 one by one, and state every assumption it changes.</p>
  ${tbl("Timetable (proposed offsets from the issue date)", ["Event", "Offset", "Date"], TT.map(([e, w]) => [e, w ? `T + ${w} weeks` : "T", fill("DD Month YYYY")]))}
  <h3>How to submit</h3>
  ${tbl("Submission", ["Item", "Entry"], [
    ["Where to submit", fill("Portal or address, set at issue")],
    ["Deadline", `Responses due at T + ${TT[3][1]} weeks: ${fill("date and time zone set at issue")}. ${fill("Late-response rule, set at issue")}`],
    ["Format", `One document, searchable PDF, plus the cost lines of section 11 as a spreadsheet; ${fill("language set at issue")}`],
    ["Length", `${fill("Page limit set at issue, e.g. 20 pages")}, not counting CVs, references and certificates`],
    ["Questions", `In writing only, to ${fill("contact role and address set at issue")}, by Questions close (T + ${TT[1][1]} weeks). Answers go to every proposer at once (T + ${TT[2][1]}), without saying who asked. No other contact with the issuer's staff about this request before the award.`],
    ["Signature", "Signed by a person with authority to commit the proposer, naming the legal entity that would contract"],
  ], "fit")}
  <h3>What a response contains</h3>
  ${list(["Approach, mapped to the requirements.", "How it groups invoices into kinds, and why: each kind needs enough volume to prove the bar (section 3), and lines alike enough to be trusted together.","Plan against the phases and gates in section 7, with named people.", "Cost, in the format of section 11, with every assumption stated.", "Evidence of relevant past work and references.", "Declarations: conflicts of interest, confidentiality, data handling.", "Validity of the offer: " + fill("e.g. 90") + " days.", "An exit plan.", "Answers to the commercial terms below, row by row."])}
  <h3>Evaluation criteria</h3>
  <p><strong>Failing any M requirement disqualifies the proposal.</strong> The M requirements carry no points: they are checked first, pass or fail, and only proposals that meet every one are scored, on the criteria below. The weights are my proposal; the issuer sets its own and publishes them to proposers.</p>
  ${tbl("Proposed weights, for proposals that meet every M requirement", ["Criterion", "Weight (points of 100)", "What is scored"], [
    ["How the controls are run (D1, section 10)", "25", "How the M controls run day to day, the value limit (D1), segregation of duties and the audit trail"],
    ["Approach and measurement", "25", "How the decision component works; how it groups invoices into kinds, and why; how calls are matched to outcomes; the promotion rule (M2) and the interval method (M10)"],
    ["Cost", "20", "By the price formula below, not on the scale"],
    ["Delivery plan and governance", "15", "The plan against the phases and gates of section 7, with named people and roles (section 8)"],
    ["Team and experience", "10", "Relevant past work and references"],
    ["Exit and portability", "5", "The exit plan and the data the company keeps (D4)"],
  ], "cards")}
  <h3>Scoring scale and price formula</h3>
  <p>Each evaluator scores every criterion but cost on the scale below, alone, before the panel agrees one score per criterion. A criterion's points are its weight × score ÷ 5.</p>
  ${tbl("Scoring scale", ["Score", "Meaning"], [
    ["0", "Not answered, or the answer does not address the criterion"],
    ["1", "Major gaps or risks; little evidence"],
    ["2", "Partly meets the need; significant gaps"],
    ["3", "Meets the need; minor gaps"],
    ["4", "Meets the need fully, with evidence"],
    ["5", "Meets the need fully, with strong evidence, and lowers a risk in section 9"],
  ], "fit")}
  ${list([
    `<strong>Price.</strong> Cost points = 20 × the lowest evaluated price ÷ this proposal's evaluated price. The evaluated price is the total of every cost line in section 11 the proposer prices, over the pilot at its longest (${maxWeeks} weeks). Fees that depend on volume are priced at ${fill("the issuer's stated volume, e.g. order lines a year, set at issue")}, with every kind paid on its own from the start of Phase 2, so every proposal is priced on the same volume. A price far below the others is checked for what it leaves out before it is scored.`,
    `<strong>Minimum.</strong> A proposal scoring below 3 on "How the controls are run" or "Approach and measurement", or below ${fill("e.g. 60")} points in all, is not shortlisted (my proposal; the issuer sets its own).`,
    "<strong>Tie-break.</strong> On equal points, the higher score on \"How the controls are run\" wins; then the lower evaluated price.",
  ])}
  <h3>Reservations</h3>
  ${list(["The issuer is not bound to award a contract, and may cancel or change this request; any change goes to every proposer at once.", "The issuer may ask shortlisted proposers to clarify, and may negotiate with one or more of them.", "Each proposer bears its own costs of responding.", "Responses are kept confidential and used only to evaluate them."])}
  <h3>Commercial terms</h3>
  <p>The issuer completes what it sets before issue; a response gives what the proposer states for each term, and any departure. This is a model for a pilot, not a contract: the contract itself is the issuer's own.</p>
  ${tbl("Commercial terms", ["Term", "The issuer sets", "The proposer states"], [
    ["Pricing model", `${fill("Pricing basis set at issue, e.g. fixed price per phase")}`, "Its pricing model and every rate, priced on the cost lines of section 11, and whether any fee rises with the number of lines paid on their own"],
    ["Payment milestones", `Payment follows the work done to each gate, not the gate's result: stopping at a gate is a valid outcome. ${fill("Share of the price paid at each gate, set at issue")}`, "What it delivers at each gate, against those milestones"],
    ["Intellectual property", `The issuer owns its data, the call log and outcomes, and the rules, prompts and settings built for it. ${fill("Any other terms, set at issue")}`, "What it brings that it already owns, and the licence it grants to use it during the pilot and the exit"],
    ["Liability for lines paid on the system's call", fill("The issuer's position and any cap, set at issue"), "The liability it accepts for lines paid on the decision component's call that needed a correction, and its cap"],
    ["Insurance", fill("Cover required and amounts, set at issue, e.g. professional indemnity and cyber"), "Its current cover, with insurer, amount and expiry"],
    ["Termination", `The issuer may stop at any gate, and at once if the correction budget is breached (M7) or a data-protection requirement fails (M13), with ${fill("notice period set at issue")}. Fees cover work done to that point only.`, "Any fee or notice it asks for on termination"],
    ["Data return and deletion", `On stop or at the end, the data and the call log are returned in ${fill("open format set at issue")} within ${fill("e.g. 30")} days; every copy is then deleted, including backups and sub-processors' copies, and deletion is confirmed in writing.`, "How it returns the data, deletes it and confirms the deletion (with its exit plan, D4)"],
    ["Confidentiality and start of work", "The issuer's data is confidential. No work starts before a signed contract.", "Acceptance, or any departure"],
    ["Contract", fill("The issuer's standard terms, named at issue"), "Any departure from them"],
  ], "cards")}
  <p class="small">Changes to this document follow the change log in Appendix D.</p>`));

  const rates = d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1]);
  const topShareWrong = b.top10.wrong_value / b.value.wrong, topSharePaid = b.top10.paid_value / b.value.paid;
  const dcard = (id, title, found, visual, why, ask, tag = "Recommended, not tested") => `<article class="dcard"><p class="dcard-id">${id} · ${tag}</p><h3>${title}</h3><p><strong>What I found:</strong> ${found}</p>${visual}<p><strong>Why it matters:</strong> ${why}</p><p class="dcard-ask"><strong>What I ask proposers:</strong> ${ask}</p></article>`;
  cs.push(sec("s3", "3", "Special findings: the desirable requirements, and why I recommend them", `
  <p class="headline">The mandatory requirements keep the pilot under control. These three come from things I saw in the study. The blind check is mandatory (M9); I would score the other two.</p>
  <p class="small">Each is a recommendation drawn from the evidence, not a tested result. None changes the verdict: no approach proved the 99% bar.</p>
  <div class="dcards">
  ${dcard("D1", "Send the largest invoices to a person", `the largest tenth of the invoices the rulebook paid (${usd(b.top10.line * f.R)} and up) held ${pct(b.top10.wrong / b.wrong, 0)} of its mistakes (${int(b.top10.wrong)} of ${int(b.wrong)}) but ${pct(topShareWrong, 0)} of their value. That tenth also held ${pct(topSharePaid, 0)} of all the value paid, so the mistakes' value is more concentrated than the money paid, but not by as much as ${pct(topShareWrong, 0)} alone suggests.`,
    bars("Largest tenth of paid invoices: share of each total", [["Share of invoices paid", b.top10.count / b.paid, pct(b.top10.count / b.paid, 0)], ["Share of mistakes, by count", b.top10.wrong / b.wrong, pct(b.top10.wrong / b.wrong, 0)], ["Share of value paid", topSharePaid, pct(topSharePaid, 0)], ["Share of mistakes' value", topShareWrong, pct(topShareWrong, 0), true]], 1),
    "a value limit is a common accounts-payable control, and on these invoices that tenth held most of the mistakes' value. The line here was drawn from the same invoices after the results, so it describes what happened; it does not show a limit would help.",
    "set the limit from the company's own policy or earlier months, before the pilot, and test it there.")}
  ${dcard("M9", "Check a sample of paid invoices blind, window by window", `when reviewers copied the AI ${Math.round(+AGREE * 10)} times in 10 (a simulation with assumed behaviour), trusting it on agreement let through about ${half(ag.wrong_median)} lines that needed a correction, against ${int(t.wrong)} when trust was earned on outcomes, though it paid far more (about ${int(ag.passed_median)} against ${int(t.passed)}), so a lower rate per invoice.`,
    "", "reviewers who can see the AI's answer tend to agree with it. A blind check, where the reviewer does not see the AI's call, measures the AI, not the reviewer.",
    "describe the sample size, who checks, and how the AI's answer is hidden from them.", "Mandatory, not tested")}
  ${dcard("D4", "Plan the exit, and keep the data portable", `three rulebooks the same AI drafted from the same inputs landed between ${pct(Math.min(...rates), 2)} and ${pct(Math.max(...rates), 2)} fine on the same invoices: consistent, but not independent checks.`,
    "", "a new rulebook or a new AI model can behave differently. The company needs to be able to retest, switch supplier or stop, without losing the record of every call.",
    "describe the exit steps, the data the company keeps, and how every version of the decision component is retested before use.")}
  </div>
  <p>Under the evaluation weights in ${rq(12)}, D1 counts under "How the controls are run" and D4 under "Exit and portability". M9, like every M requirement, is pass/fail and carries no points.</p>`));

  cs.push(sec("s4", "4", "Approvals and sign-off", `
  <p>Each person below signs three times: now, to approve issuing the request and funding Phase 0 on award; at Gate 1; and at Gate 4.</p>
  ${tbl("Sign-off", ["Role", "Name", "Stage", "Decision", "Signature", "Date"], ["Executive Sponsor", "Pilot Owner", "Finance Controller or Internal Control", "Internal Audit", "Risk and Compliance"].flatMap((r) => ["Issue", "Gate 1", "Gate 4"].map((st) => [r, fill("Full name, title"), st, "Approve / Reject", fill("Signature"), fill("DD Month YYYY")])))}`));

  out.push(sec("ap", "App.", "Appendices", `
  <h3>A. Glossary</h3>
  ${tbl("Terms", ["Term", "Meaning"], [
    ["Decision component", "Whatever makes the pay-or-hold call on a line in the pilot: a rulebook written once and applied by software (the reference design, Appendix E), a model called on each invoice, a trained classifier or a rules engine. The requirements in section 6 apply to it whatever its design."],
    ["Practice mode (shadow mode)", "The decision component makes its calls, hidden from the people who still handle every invoice; each call is scored on its outcome."],
    ["Kind of invoice", `In the study, the spend area (which department bought) × the item category (the order's matching setting: the invoice is matched to each recorded delivery, or it may be entered before the goods arrive). The category is a setting, not the order things happened in: on orders that allow the invoice first, ${pct(d.evidence.kind_setting.before_gr_gr_first / d.evidence.kind_setting.before_gr_lines, 1)} of the test lines had the goods received first anyway. A proposal may group invoices differently, and shall say why its grouping fits (section 12).`],
    ["Allowing for orders", "An interval that treats each purchase order, not each line, as the independent unit, because lines on one order succeed or fail together. It is wider, so more calls are needed."],
    ["Worst likely case", "The lowest the true share of paid invoices that turn out fine is likely to be, given how many were checked (95% sure). Also called the lower bound."],
    ["The 99% bar", "Of the invoices paid without a check, at least 99 in 100 must turn out fine, judged by the worst likely case."],
    ["Settled call", `A call whose outcome is known: its line was cleared for payment ${SETTLE_DAYS} days ago or more (my default; set at Gate 1), and any correction in that time counts against it. A correction found later still counts: the call is re-scored. For acceptance, only calls the decision component would have paid without a check count; for the switch-off rule, only calls it paid on its own, in arrival order.`],
    ["Two-sided 95% Wilson interval", "The range the true share right is likely to sit in, 95% sure, given the calls counted. Its lower end is the worst likely case; its upper end is the best likely case."],
    ["Order line", "The unit of every count and amount here. The study's records have no invoice-document field, so one \"invoice\" in the study is one order line."],
    ["Late fix", "Correcting a line after it was paid instead of before. Its cost is the work to fix it plus any share of its value never recovered."],
    ["Gate", "A formal decision point in section 7."],
    ["Blind check", "A person decides on a line the AI paid on its own without seeing the AI's call, so the result measures the AI, not the reviewer (M9)."],
  ])}
  <h3>B. Where each figure comes from</h3>
  ${list(["The bar and the verdict: decision records 0005, 0010, 0015, 0016.", "Practice mode, promotion and switch-off rules: 0013 and 0017; evidence per rulebook version: 0026; calls hidden in practice mode, and the override rate dropped: 0027.", "The agreement simulation: 0014 and 0017.", "The follow-up run: 0018.", "Savings, break-even and value at stake: 0019, re-based on order lines in 0021.", "The controls in sections 3, 6, 7 and 8 (promotion, switch-off, blind checks, intervals, data protection, roles, Gate 4): 0025.", "Who reads which sections, the ask, outcome requirements and how proposals are scored: 0028.", "The later check on September 2018, and M11's refitted supplier shortlist: 0029.", "This request kept apart from the issuer's internal case (approval, cost and return, sign-off): 0030.", "This document: 0020. Money is in US dollars; invoice values are converted from euros at " + f.R.toFixed(3) + ", the ECB's 2018 average."])}
  <h3>C. Benchmarks to collect</h3>
  <p>I quote no outside figure. Published accounts-payable benchmarks vary widely with definitions and sample, so the pilot measures the issuer's own, per order line, in Phase 0 and before Gate 1. A proposal states how it supports each measure.</p>
  ${tbl("Baseline measures", ["Measure", "The issuer's figure", "Source and date"], ["Order lines per invoice document", "Cost to process one order line", "Share of order lines a person actually reviews before payment (not just clears)", "Minutes per review", "Share of order lines needing a correction before payment", "Minutes to resolve an exception", "Work to fix a line after it was paid", "Share of a wrongly paid line's value never recovered", "Share of lines corrected after payment", "Order lines per month, by kind", "Annual volume trend and seasonal peaks"].map((m) => [m, fill("Value, with unit"), fill("System or report, period")]))}
  <h3>D. Change log</h3>
  ${tbl("Changes", ["Version", "Date", "Change", "Approved by"], [["1.0", esc(d.built), "First issue as a model document", fill("Name, role")]])}
  <h3>E. Reference design: the study's rulebook</h3>
  <p>This is the design the study tested, given for reference. A proposer may offer it, adapt it or offer another approach; the requirements in section 6 apply the same way to each.</p>
  ${tbl("The reference design", ["Item", "What the study did"], [
    ["What it is", "An AI model writes a rulebook once from past records: rules for when a line may be paid without a check. Ordinary software then applies the rules to each line. No model is called per invoice."],
    ["What it decides", "Pay without a check, or hold for a person. It never rejects or changes an invoice."],
    ["Versions", "A new rulebook is a new version, signed before use (M5); a kind keeps its record only if its rules are unchanged."],
    ["Cost in the study", `About $${cOnce.toFixed(2)} to write one rulebook, at the model's API list prices on the run date; nothing per line.`],
    ["Result in the study", `It paid ${pct(b.paid / d.held_out_n, 1)} of the test lines with a worst likely case of ${pct(c.held_out.precision_lower, 2)}: below the 99% bar, not proven (section 4).`],
  ], "fit")}
  <h3>F. Why each requirement is asked</h3>
  <p>The study's reasons, kept out of the requirements so that section 6 says only what the pilot shall do. None of them is a tested control unless it says so.</p>
  <dl class="whys">
  <div id="why-m2"><dt>M2</dt><dd>A test repeated every week passes by chance more often than once. In the replay both promotions came the first time a worst likely case crossed 99% (section 4, "Repeated looks"), so M2 asks for a rule that holds under weekly looks; ${m2Line}. The default is my assumption; the issuer may name its own sequential method instead.</dd></div>
  <div id="why-m9"><dt>M9</dt><dd>Reviewers who can see the AI's call tend to agree with it, so their agreement says little about the AI (section 4, the agreement simulation). A reviewer who does not see the call measures the AI. How the window is sized: section 11.</dd></div>
  <div id="why-m10"><dt>M10</dt><dd>Lines on one order succeed or fail together. With no mistakes, ${int(mc[0].calls)} independent calls prove 99%; at the study's design effect of ${cl.deff.toFixed(2)} that is about ${int(ctl.clustered_calls[0].clustered)} lines (section 3).</dd></div>
  <div id="why-m11"><dt>M11</dt><dd>A non-AI rule that may use the supplier is the baseline any proposal must beat (section 4). The study's own rule paid too few lines on a later month to prove the bar, so it is refitted on the issuer's data rather than carried over.</dd></div>
  <div id="why-m12"><dt>M12</dt><dd>This is a lesson from the replay, where ${int(er.top_order)} of the ${int(er.wrong)} mistakes were on one order, not a tested control. On the replay, a cap of ${int(ORDER_CAP)} would have cut lines paid on their own from ${int(t.passed)} to ${int(ctl.order_cap.passed)} and mistakes from ${int(t.wrong)} to ${int(ctl.order_cap.wrong)}.</dd></div>
  <div id="why-m15"><dt>M15</dt><dd>This is a hard rule written outside the rulebook, not a tested control: the study's rulebook had no such rule. In the study's test lines, the rulebook paid ${int(ctl.no_gr.paid)} lines with no goods receipt when the invoice arrived, and ${int(ctl.no_gr.wrong)} of them (${pct(ctl.no_gr.wrong / ctl.no_gr.paid, 1)}) needed a correction, against ${pct(b.wrong / b.paid, 2)} of all lines it paid. That was counted after the results were known, so it describes those lines and does not test the rule.</dd></div>
  <div id="why-d2-d3"><dt>D2, D3</dt><dd>Not used. A blind check is mandatory, as M9. D3, the override rate, is dropped: the decision component's calls are hidden in practice mode (M1), so there is nothing to override.</dd></div>
  </dl>`));
  return isCase ? cs : out;
}

function wire(d) {
  const set = (k, s) => document.querySelectorAll(`[data-out="${k}"]`).forEach((x) => (x.textContent = s));
  Calc.wire("in", d, (B, v, x) => {
    const L = B.L, kTxt = `${v.k} kind${v.k === 1 ? "" : "s"}`, need = (lpm) => Calc.needTxt(x.need(lpm));
    set("money2", v.sh === null ? `up to ${usd(x.saving)} (every line reviewed: an upper limit, not a plan)` : `${usd(x.saving)} gross a year`);
    set("share-used", v.sh === null ? "every line (100%), an upper limit: not entered" : `${pct(v.sh, 1)} (yours)`);
    set("p0-basis", `${v.h} hours a week × ${PH.p0} weeks × $${int(v.r)}, plus integration below`);
    set("p0-cost", usd(x.p0));
    set("oh-basis", `${v.h} hours a week × ${B.totalWeeks - PH.p0} weeks × $${int(v.r)}`);
    set("oh-cost", usd(x.ohRest));
    set("oh-max", `If Phase 1 runs to the stop rule's ${B.stopWk} weeks, the pilot runs ${B.maxWeeks} weeks and oversight for phases 1 to 3 rises from ${usd(x.ohRest)} to ${usd(x.ohMax)}.`);
    set("blind-h", `${int(x.blindH)} hours`);
    set("blind-cost", usd(x.blindWin));
    set("blind-pilot", `${usd(x.blindPilot)} for ${kTxt} over about ${B.p2Windows.toFixed(1)} monthly windows`);
    set("kinds-lab", kTxt);
    set("int-cost", v.hasInt ? usd(v.i) : "not entered");
    set("total", usd(x.total));
    set("need-low", need(L.gated_cautious));
    set("late", `$${int(x.M)}`);
    set("wrong-yr", int(x.wrongFull));
    set("need-int", (v.hasInt ? "" : ", before integration cost") + (v.sh === null ? ", with every line counted as reviewed today (an upper limit)" : ""));
    set("need", x.ask <= 1 ? pct(x.ask, 1) : "not reachable");
    set("return-line", x.ask <= 1 ? `Repays itself in its first year after the pilot if it earns ${pct(x.ask, 1)} of the on-paper volume` : "Does not repay itself in its first year after the pilot at these inputs, even at the full on-paper volume");
    const qTxt = ` With quarterly blind-check windows instead of monthly: ${x.needNetQ > 1 ? "still not" : `at ${pct(x.needNetQ, 1)}`}.`;
    set("ask-note", x.needNet > 1 ? "At these inputs it does not pay (section 2); Phase 0 finds out whether the company's real figures change that." : `At these inputs it pays only if a person reviews at least ${pct(x.needNet, 1)} of these lines today; Phase 0 measures that.`);
    set("pays-off-q", qTxt);
    set("pays-off", x.needNet > 1 ? `Not at these inputs: even with every line reviewed today, late fixes, oversight and blind checks cost more than the time saved (late fixes alone would need ${Calc.needTxt(x.need(B.L.gated_cautious))} reviewed)` : `Only if a person today reviews at least ${pct(x.needNet, 1)} of these lines (late fixes alone: ${Calc.needTxt(x.need(B.L.gated_cautious))})`);
    const upper = v.sh === null ? " Share reviewed not entered, so every line counts as reviewed today: an upper limit." : "";
    const blindTxt = ` It counts blind checks on ${kTxt}, costed at M9's shortest (monthly) window (${usd(x.blindYr)} a year).`;
    set("need-note", (x.ask <= 1 ? `of the on-paper volume, with a late fix at $${int(x.M)}. Below this, the first year after the pilot does not repay it.` : `With a late fix at $${int(x.M)}, even the full on-paper volume does not repay the pilot in a year.`) + blindTxt + upper);
    // With no integration cost entered, the ROI and payback columns are hidden and one note says why (no repeated cells).
    set("roi-warn", v.hasInt ? "" : "The first-year return and payback columns appear once you enter your integration cost above (0 is allowed).");
    document.querySelectorAll("table.scen").forEach((tb) => tb.classList.toggle("no-int", !v.hasInt));
    scenRows(B.g).forEach(([e], j) => {
      const r = x.row(e);
      set(`sc-checks-${j}`, int(r.lines));
      set(`sc-wrong-${j}`, int(r.wrong));
      set(`sc-gross-${j}`, usd(r.gross));
      set(`sc-net-${j}`, Calc.signed(r.net));
      set(`sc-roi-${j}`, !v.hasInt ? "" : r.roi === null ? "n/a (pilot under $1k)" : `${r.roi < 0 ? "−" : ""}${int(Math.abs(r.roi) * 100)}%`);
      set(`sc-pay-${j}`, !v.hasInt ? "" : r.pay ? `${r.pay.toFixed(1)} months` : "does not pay back");
    });
  });
}

async function boot() {
  const main = $("#content");
  let d;
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(res.status);
    d = await res.json();
    // Drawn inside the try, so data that parses but lacks a field shows the message, not "Loading" for ever.
    main.innerHTML = build(d).join("");
    const names = DOC === "case"
      ? { s1: "Summary", s2: "Return", s3: "Findings", s4: "Approvals" }
      : { s1: "Summary", s2: "Purpose", s3: "Scope", s4: "Evidence", s5: "Assumptions", s6: "Requirements", s7: "Pilot plan", s8: "Governance", s9: "Risks", s10: "Controls", s11: "Cost lines", s12: "Proposers", ap: "Appendices" };
    $("#toc").innerHTML = Object.entries(names).map(([id, n]) => `<li><a href="#${id}"><i class="lamp"></i>${id === "ap" ? '<span aria-hidden="true">A</span>' : `<span><span class="sr">Section </span>${id.slice(1)}</span>`} ${n}</a></li>`).join("");
    wire(d);
  } catch (e) {
    main.innerHTML = `<p class="loading">The data could not be loaded (${esc(e.message)}). Reload the page to try again.</p>`;
    return;
  }
  const links = [...document.querySelectorAll(".cues a, .tabs a[href^='#']")];
  const obs = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    links.forEach((a) => (a.getAttribute("href") === "#" + en.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  }), { rootMargin: "-30% 0px -60% 0px" });
  document.querySelectorAll("main section").forEach((s) => obs.observe(s));
  /* The page is drawn after load, so a link to a section needs a scroll once it exists. */
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
}

$(".theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) { /* storage blocked: theme still switches */ }
});
boot();
