"use strict";
/* Understudy: model request for a pilot proposal (ADR 0020). Every study figure is read from data.json; nothing is typed by hand.
   Phase lengths, oversight hours, risk ratings and evaluation weights are the author's assumptions or judgment, and are labelled as such. */

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
const AGREE = "0.9", SIM_RUNS = 20; // the simulation shown: reviewers copy this share; runs per ADR 0017
const SCEN = [0.1, 0.25, 0.5, 1]; // shares of the on-paper volume, scenarios only
/* Rows of the return table: none earned, the replay's observed share (a truncated window), then the scenarios. */
const scenRows = (g) => [[0, "none earned yet"], [g.earned_share, "observed in the replay; window too short"], ...SCEN.map((x) => [x, x === 1 ? "the on-paper ceiling" : ""])];

const tbl = (caption, heads, rows, cls = "") =>
  `<div class="tablewrap"><table class="rfp ${cls}"><caption>${caption}</caption><thead><tr>${heads.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
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
    totalWeeks: PH.p0 + firstWk + PH.p2 + PH.p3, dryWeeks: PH.p0 + firstWk, stopWk: firstWk * 2 };
}

function build(d) {
  const f = figures(d), { b, c, t, b2, firstWk, firstIso, linesYr, v, cOnce, ag, totalWeeks, stopWk, L, g, iso } = f;
  const mc = d.bar.min_calls;
  const out = [];

  /* Document control and 1. summary */
  out.push(`<section id="s0" aria-labelledby="s0-h"><div class="col">
  <h1 id="s0-h">Request for Proposals: a controlled pilot of AI-assisted invoice clearing</h1>
  <p class="jump"><a href="./">&larr; Back to the main report</a></p>
  <p class="small">This is a model document. I wrote it from my study, to show how a company with a formal process could ask for a pilot. It is not issued by any organisation, and every placeholder in [brackets] is for the company that adopts it to complete. I wrote it after every result was known (decision record 0020); it changes no result.</p>
  ${tbl("Document control", ["Item", "Entry"], [
    ["Title", "Request for Proposals: controlled pilot of AI-assisted invoice clearing"],
    ["Reference", fill("Procurement reference, e.g. RFP-YYYY-NNN")],
    ["Version and date", `1.0, built ${esc(d.built)}`],
    ["Author", "The author of the Understudy study (first-person statements in this document are mine)"],
    ["Status", "Model document. Text in [brackets] is a placeholder for the adopting company to complete"],
    ["Classification", fill("e.g. Internal, Confidential")],
    ["Owner of this document", fill("Name, role and department")],
  ])}
  </div><div></div></section>`);

  const phases = [["0 Set-up", PH.p0], ["1 Practice mode", firstWk], ["2 Limited autonomy", PH.p2], ["3 Review", PH.p3]];
  const timeline = `<figure class="tline"><div class="tline-bar" role="img" aria-label="Pilot plan: ${phases.map(([n, w], i) => `${n}, ${i === 1 ? "about " : ""}${w} weeks`).join("; ")}">${phases.map(([n, w], i) => `<span class="seg s${i}" style="flex:${w}"><b>${n}</b><i>${i === 1 ? "~" : ""}${w} wk</i></span>`).join("")}</div><figcaption class="small">${totalWeeks} weeks in all. Each phase ends at a gate (section 7). Phase 1 ends when a kind of invoice proves the bar, which took ${firstWk} weeks in the replay.</figcaption></figure>`;
  out.push(sec("s1", "1", "Executive summary", `
  <p class="headline">I ask for approval of a controlled pilot, not a roll-out: ${totalWeeks} weeks in four gated phases.</p>
  ${timeline}
  ${tbl("Key figures", ["Question", "Answer", "What it means"], [
    ["What was tested?", `3 pre-registered approaches, ${int(d.held_out_n)} real invoices`, "None proved the 99% bar"],
    ["What did the best one do?", `Rulebook paid ${pct(b.paid / d.held_out_n, 1)}; ${pct(c.held_out.precision[0] / c.held_out.precision[1], 2)} right; worst likely case ${pct(c.held_out.precision_lower, 2)}`, "Below the bar: not proved"],
    ["The saving", `Not known yet. It rests on the share of order lines a person reviews today, which the records can't show. ${pct(iso, 1)} of the lines the rulebook would have paid show a person's own step`, "A footprint, not proof of review. Phase 0 measures it"],
    ["The risk", `${int(b.wrong)} of ${int(b.paid)} lines paid needed a fix (${pct(b.wrong / b.paid, 2)}), ${pct(v.wrong / v.paid, 1)} of value (${usd(v.wrong)})`, "Paid before a fix; not money lost"],
    ["Trust earned on outcomes (replay)", `${int(t.passed)} paid, ${int(t.wrong)} needed correction (${pct(t.wrong / t.passed, 1)}), ${d.evidence.replay.kinds === 1 ? "all in one kind" : `in ${int(d.evidence.replay.kinds)} kinds`}, ${int(d.evidence.replay.top_order)} on one order; first kind in week ${firstWk} of the replay (ISO week ${firstIso})`, "Not proven either; expect errors in the first months"],
    ["When it pays off", `<span data-out="pays-off"></span>`, `At a late fix of <span data-out="late"></span>, on the cautious end of the replay's error rate, after oversight and blind checks (section 11)`],
    ["Pilot cost", `<span data-out="total"></span>: internal oversight, monthly blind checks on <span data-out="kinds-lab"></span> and the rulebook (my assumptions), plus integration if entered`, "Supplier fees, model use, hosting, outcome scoring, audit, reconciliation and training are required lines still to price (section 11)"],
    ["Return", `<span data-out="return-line"></span>`, `At your inputs, including monthly blind checks on <span data-out="kinds-lab"></span> (my assumption)<span data-out="need-int"></span>; scenarios, not forecasts (section 11)`],
  ], "keys")}
  <p class="ask"><strong>The decision I ask for:</strong> approve Phase 0 (set-up and baseline) now. Every later phase waits for a gate.</p>
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
  ${list(["Payment runs, supplier onboarding and supplier bank-detail changes.", "Fraud and duplicate-payment detection. I did not test either; existing controls stay as they are.", "Any invoice type the study did not cover."])}
  <h3>Objectives</h3>
  ${list([
    "<strong>O1.</strong> Prove or disprove the 99% bar on the company's own invoices.",
    "<strong>O2.</strong> Measure the share of order lines a person reviews today, minutes per review and the real cost of a late fix, and replace my assumptions with them.",
    "<strong>O3.</strong> Keep lines paid that need a correction within a budget agreed at Gate 1.",
    "<strong>O4.</strong> Leave a complete audit trail of every call and every outcome.",
  ])}
  <h3>Acceptance</h3>
  <p>A kind of invoice may be paid without a check only when the worst likely case of its settled calls (those it would have paid) reaches 99%. In practice that means:</p>
  ${tbl("Settled calls a kind needs before it is trusted", ["Mistakes among them", "Calls needed, at least"], mc.map((m) => [word(m.errors), int(m.calls)]), "num")}
  <p>The pilot as a whole is accepted when the Gate 4 review (section 7) is signed.</p>`));

  const ev = [
    ["A simple rule", "A fixed checklist from past records", int(d.held_out_n), int(d.a.held_out.coverage[0]), "none paid", "none paid", "Almost nothing"],
    ["Claude checking each invoice", "The AI reads each invoice and decides", b2 ? int(b2.b_alone.n) + " (follow-up)" : int(d.sample_n), b2 ? int(b2.b_alone.passed) : int(d.b.sample.passed), b2 ? int(b2.b_alone.wrong) : int(d.b.sample.errors), b2 ? pct(b2.b_alone.lower, 2) : pct(d.b.lower, 2), `About $${((b2 ? b2.cost.usd * 1000 / b2.b_alone.n : d.cost.b.usd * 1000 / d.sample_n)).toFixed(2)} per 1,000 invoices`],
    ["Claude's rulebook", "The AI writes rules once; software applies them", int(d.held_out_n), int(b.paid), int(b.wrong), pct(c.held_out.precision_lower, 2), `About $${cOnce.toFixed(2)} to write, nothing per invoice`],
  ];
  out.push(sec("s4", "4", "Evidence base", `
  <p>All figures come from the main report. Each approach could only pay an invoice without a check or hold it for a person, and each was scored against what really happened.</p>
  ${tbl("The three approaches on the test invoices (the bar: worst likely case of at least 99%)", ["Approach", "What it is", "Invoices judged", "Paid without a check", "Of those, wrong", "Worst likely case", "Cost to run"], ev)}
  <p><strong>The baseline to beat.</strong> The study's simple rule could not use the supplier. After the fact, a non-AI rule grouped by ${esc(d.evidence.vendor.picked)} paid ${pct(d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked).coverage, 1)} of the test invoices with a worst likely case of ${pct(d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked).lower, 2)}, resting on ${int(d.evidence.vendor.rows.find((r) => r.key === d.evidence.vendor.picked).vendors)} suppliers (post hoc, to be confirmed). Any proposal must beat a supplier whitelist like this, built on the issuer's own data.</p>
  <h3>Three ways to grant trust, on the same test invoices</h3>
  ${tbl("How trust was granted, and what it let through", ["Way", "Invoices paid", "Wrong", "Wrong rate", "Note"], [
    ["Trusted from day one (on paper)", int(b.paid), int(b.wrong), pct(b.wrong / b.paid, 2), "The ceiling; never tested live"],
    ["Earned on outcomes (replay)", int(t.passed), int(t.wrong), pct(t.wrong / t.passed, 1), `First kind in week ${firstWk} of the replay's ${d.replay.weeks.length} (ISO week ${firstIso}); all ${int(t.wrong)} mistakes in one kind, ${int(d.evidence.replay.top_order)} on one order; window too short for the steady state`],
    ["Trusted on agreement (simulation)", half(ag.passed_median), half(ag.wrong_median), `about ${pct(ag.wrong_median / ag.passed_median, 2)}`, `Reviewers copy ${Math.round(+AGREE * 10)} in 10; medians of ${SIM_RUNS} runs; assumed behaviour, not a study of people`],
  ])}
  ${bars("Lines paid that needed a correction", [["Earned on outcomes", t.wrong, int(t.wrong)], ["Trusted on agreement (simulation, assumed behaviour)", ag.wrong_median, half(ag.wrong_median), true]])}
  <p>In the simulation, trusting on agreement let through about ten times as many lines that needed a correction, at a lower rate per line, because it paid far more. The count is not why requirement M2 forbids it: when reviewers copy, agreement carries no information about whether the AI is right.</p>
  <h3>Limits of the evidence</h3>
  ${tbl("What the evidence can and cannot carry", ["Limit", "What it means for a proposal"], [
    ["Look-ahead", `The learning months' rates include outcomes that landed after the test began, and test outcomes helped choose invoices as the subject. A live system would not have either. Direction of the effect: not established.`],
    ["Forking paths", `${int(d.post_result.length)} changes were made after a test result was known (listed in the main report's Method section), including a new comparison rule and a second run.`],
    ["Clustering", `Invoices on the same order fail together. Allowing for that, the rulebook's worst likely case falls from ${pct(c.held_out.precision_lower, 2)} to ${pct(d.evidence.clustering.clustered_lower, 2)}. Intervals in a proposal must allow for it.`],
    ["Label", `"Needed a correction" is broad. Moving it one way at a time does not prove the bar: dropping delivery-indicator-only corrections gives ${pct(d.evidence.sensitivity.drop_cdi.clustered_lower, 2)} allowing for orders; counting corrections after clearing gives ${pct(d.evidence.sensitivity.post_clear_lower, 2)}.`],
  ], "fit")}
  ${list(["One company's records, from 2018. The method carries over; the numbers are theirs.", `"Fine" means no one corrected the invoice before payment. Counting corrections made after clearing, which the label leaves out, lowers the rulebook's worst likely case to ${pct(d.evidence.sensitivity.post_clear_lower, 2)}; corrections outside these records can't be counted.`, "The records hold no invoice text, so the AI never read an invoice document.", "The share of lines a person reviews, minutes per review and hourly cost are inputs, not measurements. The records hold logins and times, and most clearing steps in them are bulk postings."])}`));

  out.push(sec("s5", "5", "Assumptions, constraints and dependencies", `
  <h3>Assumptions (mine; replace them with your own in Phase 0)</h3>
  ${tbl("Assumptions", ["Assumption", "Default", "Why"], [
    ["Unit", "The order line", "The records have no invoice-document field"],
    ["Share of lines a person reviews today", "Not assumed: you enter it; until then the figures show every line (100%), an upper limit", "The records show logins and times, not reviews"],
    ["Minutes per review, hourly cost", `${DEF_MIN} minutes, $${DEF_RATE} (inputs in section 11)`, "The records show when work happened, not how long it took"],
    ["Cost of a late fix", `$${DEF_FIX} of work, plus ${DEF_LOST}% of the line's value never recovered (inputs in section 11)`, "The records don't show it"],
    ["Oversight during the pilot", `${OVERSIGHT_H} hours a week`, "My judgment"],
    ["Phases 0, 2 and 3", `${PH.p0}, ${PH.p2} and ${PH.p3} weeks`, "My judgment"],
    ["Phase 1 (practice mode)", `About ${firstWk} weeks`, "When the first kind qualified in the replay; outcomes arrive weeks after invoices"],
    ["Shorter pilots", "Not used", "Some supplier-written guides online suggest 30 to 90 days. I have not checked them, and that is unlikely to collect enough outcomes for this bar"],
    ["Volume", "No seasonality", "A simplification"],
  ])}
  <h3>Constraints</h3>
  ${list(["Nothing is paid on the rulebook's say-so before Gate 2.", "Existing payment, approval and fraud controls stay in force throughout.", "The company's own policies override this document wherever they differ."])}
  <h3>Dependencies</h3>
  ${list(["Access to outcome data, including corrections made after payment.", "A named Rulebook Owner and a Pilot Owner before Phase 0 ends.", "A place to log every call, its inputs and its outcome.", "A review of data privacy and supplier-data terms before any real invoice data is used."])}`));

  out.push(sec("s6", "6", "Requirements", `
  <p>A proposer shall state, for each requirement, how the pilot will meet it and how the test will be run.</p>
  ${tbl("Mandatory requirements", ["Ref", "The pilot shall", "Test"], [
    ["M1", "Start in practice mode on every kind of invoice, with people handling every invoice.", "No invoice is paid on the rulebook's say-so before Gate 2."],
    ["M2", "Promote a kind of invoice only on its real outcomes, never on how often reviewers agree.", "Each promotion record cites outcome counts."],
    ["M3", "Switch a kind off automatically when the best likely case (95% upper bound) of its last 200 settled calls that it paid on its own falls below 99%.", "A seeded failure switches the kind off."],
    ["M4", "Log every call, its inputs and its outcome, and keep the log for the retention period in section 10.", "An auditor can trace any paid invoice back to its call."],
    ["M5", "Have a named person read and sign off each rulebook version before use, under change control.", "Every version in use has a signed record."],
    ["M6", "Count corrections made after payment as mistakes.", "The outcome feed includes post-payment corrections."],
    ["M7", "Confirm in writing, before Gate 1, the 99% bar, the cost of a late fix, the wrong-payment budget and any value limit.", "A signed Gate 1 record exists."],
    ["M8", "Provide a kill switch that the Pilot Owner and the Finance Controller can use without the supplier.", "Tested in Phase 0."],
  ])}
  ${tbl("Desirable requirements", ["Ref", "The pilot should", "Why"], [
    ["D1", "Set a value limit above which a person always checks.", "Most of the mistakes' value sat in the largest invoices in the study. A proposal I did not test."],
    ["D2", "Run monthly blind spot-checks of paid invoices.", "It guards against reviewers copying the AI."],
    ["D3", "Track how often people overrule the rulebook, as a warning sign only.", "Agreement is not accuracy."],
    ["D4", "Provide an exit plan and keep the data portable.", "A supplier or model may change."],
  ])}
  <p class="jump"><a href="#s14">The findings behind D1 to D4 are in section 14 &rarr;</a></p>`));

  const ph = [
    ["0 Mobilise", `${PH.p0} (my assumption)`, "Name owners; measure the baseline (share of lines a person reviews, minutes per review, cost of a late fix as the work plus the share of value never recovered, mistake rate); have an accounts-payable reviewer sign off the list of corrections that count as a mistake, deciding explicitly on Change Approval for PO; write the bar and the budget for lines paid that need a correction down; test the kill switch.", "G1: sponsor and finance approve the bar and the budget"],
    ["1 Practice mode", `About ${firstWk} (the replay's first kind qualified in week ${firstWk} of the replay, ISO week ${firstIso}; that kind was switched off again later, so this length rests on a promotion later withdrawn); it ends when G2 holds, and depends on your volume per kind`, "The rulebook makes calls on every kind; people handle every invoice; every call is scored when its outcome arrives.", "G2: at least one kind meets the bar on its outcomes"],
    ["2 Limited autonomy", `${PH.p2} (my assumption)`, "Qualified kinds only. Automatic switch-off stays on. Blind spot-checks run monthly.", "G3: results review; the wrong-payment budget was respected"],
    ["3 Review", `${PH.p3} (my assumption)`, "Compare real figures with the assumptions; decide the next step.", "G4: formal decision to expand, extend or stop"],
  ];
  out.push(sec("s7", "7", "Pilot plan, gates and decision points", `
  <p>The plan runs about ${totalWeeks} weeks (${(totalWeeks * 12 / 52).toFixed(1)} months) if Phase 1 takes about ${firstWk} weeks. It may take longer or shorter, depending on volume; no gate may be skipped.</p>
  ${tbl("Phases and gates", ["Phase", "Weeks", "What happens", "Gate to leave"], ph)}
  <h3>Stop criteria</h3>
  <p>The Pilot Owner shall recommend stopping, and the sponsor shall decide, if any of these holds:</p>
  ${list([
    "The wrong-payment budget fixed at Gate 1 is exceeded.",
    "The pilot's own measured cost of a late fix exceeds the break-even in section 11, recalculated at the pilot's own measured mistake rate.",
    `No kind of invoice has qualified by week ${stopWk} of practice mode (my judgment: twice the replay's ${firstWk}; the issuer sets its own).`,
    "Outcome data, including corrections after payment, cannot be obtained.",
    "A control in section 10 cannot be met.",
  ])}`));

  const raci = [
    ["Approve the bar, the pilot budget and the wrong-payment budget", "A", "R", "C", "C", "C", "I", "I"],
    ["Sign off a rulebook version", "I", "A", "C", "C", "C", "C", "R"],
    ["Approve a promotion of a kind", "I", "A/R", "R", "C", "I", "I", "C"],
    ["Trigger a switch-off", "I", "A/R", "R", "I", "I", "C", "C"],
    ["Review outcomes each month", "I", "A", "R", "C", "I", "R", "C"],
    ["Hold the audit trail", "I", "C", "C", "C", "C", "A/R", "C"],
    ["Make the Gate 4 decision", "A/R", "R", "C", "C", "C", "C", "C"],
  ];
  out.push(sec("s8", "8", "Governance and responsibilities", `
  <p>R is responsible, A accountable, C consulted, I informed. Names are blank; the roles are mine.</p>
  ${tbl("Responsibilities", ["Activity", "Sponsor", "Pilot Owner", "Finance Controller", "Internal Audit", "Risk and Compliance", "IT and Data", "Rulebook Owner"], raci, "raci")}
  ${tbl("Named people", ["Role", "Name", "Date appointed"], ["Executive Sponsor", "Pilot Owner (accounts payable)", "Finance Controller", "Internal Audit", "Risk and Compliance", "IT and Data", "Rulebook Owner"].map((r) => [r, fill("Full name, title"), fill("DD Month YYYY")]))}
  <p>The Rulebook Owner who signs a rulebook version shall not approve its promotions (segregation of duties). The Pilot Owner reports to the sponsor at each gate.</p>`));

  const risks = [
    ["R1", "A line that needs a correction is paid", "High", "Medium", `${int(b.wrong)} of ${int(b.paid)} lines on paper; ${int(t.wrong)} of ${int(t.passed)} in the replay`, "M1, M2, M3, M7", "Pilot Owner"],
    ["R2", "A late fix costs more than the break-even", "Medium", "High", `Cautious break-even: ${int(L.gated_cautious)} lines per mistake × share reviewed × cost of a review (section 11)`, "Measure it in Phase 0; stop rule", "Finance Controller"],
    ["R3", "Mistakes concentrate in one kind of invoice", "Medium", "Medium", `The replay's ${int(t.wrong)} mistakes were mostly from one kind`, "Promote kind by kind; M3", "Pilot Owner"],
    ["R4", "The rulebook goes stale", "High", "Medium", "Suppliers, prices and buying habits change", "M5; scheduled retest and rewrite", "Rulebook Owner"],
    ["R5", "Mistakes found after payment go unnoticed", "Medium", "High", "Not in the study's records", "M6", "Finance Controller"],
    ["R6", "Reviewers copy the AI's suggestion", "Medium", "High", "The agreement simulation", "M2, D2, D3", "Internal Audit"],
    ["R7", "A few large invoices carry most of the value at risk", "Medium", "High", `${pct(v.wrong / v.paid, 1)} of paid value from ${pct(b.wrong / b.paid, 2)} of invoices`, "D1", "Risk and Compliance"],
    ["R8", "Fraud or duplicate payments", "Low", "High", "Not tested", "Out of scope; existing controls stay", "Risk and Compliance"],
    ["R9", "Privacy or supplier-data terms are breached", "Low", "High", "The study used no invoice text", "Review before any real data is used", "Risk and Compliance"],
    ["R10", "Staff resist or roles are unclear", "Medium", "Medium", "Not tested", "Explain the change in Phase 0", "Executive Sponsor"],
    ["R11", "The AI model or a supplier changes", "Medium", "Medium", "Models can change behaviour", "Retest on every change; D4", "IT and Data"],
    ["R12", "Seasonal volume hides a weakness", "Medium", "Medium", `The test covered ${b.months} months`, "Track by month through Phase 2", "Pilot Owner"],
  ];
  out.push(sec("s9", "9", "Risk register", `
  <p>The ratings are my judgment, not measurements. Replace them with the company's own scale in Phase 0.</p>
  ${tbl("Risks", ["Ref", "Risk", "Likelihood", "Impact", "Evidence", "Mitigation", "Owner"], risks)}
  <p class="small">Risks beyond lines paid that need a correction (R4 to R12) are not measured by the study. They are what I would expect a risk committee to ask about.</p>`));

  out.push(sec("s10", "10", "Controls and compliance", `
  ${list([
    "<strong>Segregation of duties.</strong> Who writes a rulebook, who signs it and who approves promotions are different people.",
    "<strong>Change control.</strong> A rulebook version is not used until signed. A change to the bar, a limit or a phase length is a recorded change approved at a gate.",
    "<strong>Audit trail.</strong> Every call, input and outcome is logged and kept for the retention period the company's policy sets: " + fill("e.g. 7 years, per records policy") + ".",
    "<strong>Independent review.</strong> Internal Audit reviews a sample of paid invoices before Gate 3.",
    "<strong>Existing controls.</strong> Payment-approval limits, fraud checks and period-end controls stay in force.",
    "<strong>Regulation.</strong> The company's compliance function decides which rules apply. This document does not state any.",
  ])}`));

  const bl = b.blind, bad = 1 / L.gated_cautious;
  const req = (t) => `<strong>Required.</strong> ${t}`;
  out.push(sec("s11", "11", "Cost model and expected benefit", `
  <p>These figures use your inputs. The defaults are my assumptions, not measurements. Change them to match the company; everything below updates. Every count is in order lines.</p>
  ${Calc.html("in", `The share reviewed is the figure the saving rests on, and the records can't show it: ${pct(iso, 1)} of the lines the rulebook would have paid show a person's own step, a footprint, not proof of review. Until you enter it, results that need it use every line (100%) and say "upper limit". The tables below show the working.`)}
  ${tbl("Cost lines", ["Line", "Basis", "Amount"], [
    [`Phase 0: set-up and baseline<span class="small">My assumption</span>`, `<span data-out="p0-basis"></span>`, `<span data-out="p0-cost"></span>`],
    [`Oversight, phases 1 to 3<span class="small">My assumption</span>`, `<span data-out="oh-basis"></span>`, `<span data-out="oh-cost"></span>`],
    [`Blind checks<span class="small">${req("Sized to catch a doubled error rate")}</span>`, `${int(bl.n)} lines a kind of invoice per check window × your minutes per review = <span data-out="blind-h"></span> a kind a window. The switch-off test on ${int(bl.n)} lines catches a true ${pct(bl.q, 0)} error rate ${pct(bl.power, 0)} of the time. Power does not rise smoothly with the window: ${int(bl.first_n)} lines already reach 80%, but ${int(1000)} fall back to ${pct(bl.power_1000, 0)}, so I size in steps of 50 to the first that holds.`, `<span data-out="blind-cost"></span> a kind a window; <span data-out="blind-pilot"></span> in the pilot`],
    [`Weekly reconciliation of calls against outcomes<span class="small">${req("Yours to estimate")}</span>`, "Hours a week × the weeks of the pilot", fill("US$ amount")],
    [`Writing the rulebook<span class="small">Measured</span>`, "At API list prices on the run date; nothing per line", `$${cOnce.toFixed(2)}`],
    [`Integration and data access<span class="small">${req("Yours to enter above")}</span>`, "One-off", `<span data-out="int-cost"></span>`],
    [`Supplier fees<span class="small">${req("Proposer to price")}</span>`, "Fixed and variable", fill("US$ amount")],
    [`Model or API use<span class="small">${req("Proposer to price")}</span>`, "Per call or per rulebook version, with the model named", fill("US$ amount")],
    [`Hosting and logging<span class="small">${req("Proposer to price")}</span>`, "For the pilot and the retention period", fill("US$ amount")],
    [`Outcome scoring<span class="small">${req("Proposer to price")}</span>`, "Matching each call to its outcome as it arrives", fill("US$ amount")],
    [`Audit<span class="small">${req("Yours to estimate")}</span>`, "Internal Audit's review before Gate 3 (section 10)", fill("US$ amount")],
    [`Training and change management<span class="small">${req("Yours to estimate")}</span>`, "", fill("US$ amount")],
    ["Total so far", "Phase 0, oversight, the rulebook, blind checks (my assumption: monthly windows during Phase 2, on the kinds you enter above), and integration if entered. Not the required lines still blank", `<span data-out="total"></span>`],
  ])}
  <p><strong>No saving for about ${f.dryWeeks} weeks.</strong> Nothing is paid without a person in Phase 0 (${PH.p0} weeks) or in practice mode (about ${firstWk} weeks), so the pilot costs money for that long before it can save any.</p>
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
  <p class="warn" data-out="roi-warn" role="status"></p>
  ${tbl("Return in the first year after the pilot, if it earns a share of the on-paper volume (scenarios, not forecasts; benefit during the pilot not counted)", ["Share earned", "Lines paid alone a year", "Needing a correction a year", "Gross saving", "Net yearly benefit", "First-year return on the pilot (ROI)", "Payback"],
    scenRows(g).map(([x, why], k) => [`${pct(x, x && x < 0.1 ? 1 : 0)}${why ? `<span class="small">${why}</span>` : ""}`, `<span data-out="sc-checks-${k}"></span>`, `<span data-out="sc-wrong-${k}"></span>`, `<span data-out="sc-gross-${k}"></span>`, `<span data-out="sc-net-${k}"></span>`, `<span data-out="sc-roi-${k}"></span>`, `<span data-out="sc-pay-${k}"></span>`]), "scen")}
  ${tbl("How each figure is worked out", ["Figure", "Formula"], [
    ["Gross saving", "Lines paid alone × share reviewed today × minutes per review ÷ 60 × hourly cost"],
    ["Late-fix cost", "Lines paid alone × the cautious error rate × (work per fix + share never recovered × average value of a wrongly paid line)"],
    ["Net yearly benefit", "Gross saving − late-fix cost − oversight (hours a week × 52) − blind checks (kinds × 12 monthly windows × one window's cost). At 0% earned nothing is paid on its own, so there are no blind checks and it is the oversight cost alone"],
    ["First-year ROI", "(Net yearly benefit − total pilot cost) ÷ total pilot cost"],
    ["Payback", "Total pilot cost ÷ monthly net benefit, from the end of the pilot"],
    ["Total pilot cost", "The cost lines above with a figure, blind checks included; integration only if entered"],
    ["Blind checks (my assumption)", `${WINDOWS_YR} windows a year (monthly), about ${(PH.p2 * 12 / 52).toFixed(1)} during Phase 2, each ${int(b.blind.n)} lines a kind × minutes per review, on the kinds you enter. The check window is still to be fixed in the requirements; these figures change with it`],
    ["Not included", "The required lines still blank, discounting, tax, seasonality, benefit during the pilot"],
  ])}
  <p class="small">The ${pct(g.earned_share, 1)} row is what the replay earned on the same test lines; its window was too short to show the steady state, so it is a floor seen once, not an estimate. ${pct(SCEN[SCEN.length - 1], 0)} is the on-paper ceiling. None of these rows changes the verdict: no approach proved the 99% bar.</p>
  <h3>Benchmarks to collect from your own records</h3>
  <p>I quote no outside figure. Published accounts-payable benchmarks vary widely with definitions and sample, so the pilot should measure your own, per order line. Fill in these before Gate 1.</p>
  ${tbl("Baseline measures", ["Measure", "Your figure", "Source and date"], ["Order lines per invoice document", "Cost to process one order line", "Share of order lines a person actually reviews before payment (not just clears)", "Minutes per review", "Share of order lines needing a correction before payment", "Minutes to resolve an exception", "Work to fix a line after it was paid", "Share of a wrongly paid line's value never recovered", "Share of lines corrected after payment", "Order lines per month, by kind", "Annual volume trend and seasonal peaks"].map((m) => [m, fill("Value, with unit"), fill("System or report, period")]))}`));

  out.push(sec("s12", "12", "Instructions to proposers, timetable and evaluation", `
  <p>A proposer may be an internal team or an outside supplier. A response shall follow the section numbers of this document, answer M1 to M8 and D1 to D4 one by one, and state every assumption it changes.</p>
  ${tbl("Timetable (proposed offsets from the issue date)", ["Event", "Offset", "Date"], [["Issue date", "T", fill("DD Month YYYY")], ["Questions close", "T + 2 weeks", fill("DD Month YYYY")], ["Answers published to all proposers", "T + 3 weeks", fill("DD Month YYYY")], ["Responses due", "T + 4 weeks", fill("DD Month YYYY")], ["Shortlist and clarifications", "T + 6 weeks", fill("DD Month YYYY")], ["Decision and Gate 1 package", "T + 8 weeks", fill("DD Month YYYY")]])}
  <h3>What a response contains</h3>
  ${list(["Approach, mapped to the requirements.", "Plan against the phases and gates in section 7, with named people.", "Cost, in the format of section 11, with every assumption stated.", "Evidence of relevant past work and references.", "Declarations: conflicts of interest, confidentiality, data handling.", "Validity of the offer: " + fill("e.g. 90") + " days.", "An exit plan."])}
  <h3>Evaluation criteria</h3>
  <p>The weights are my proposal; the issuer sets its own and publishes them to proposers.</p>
  ${tbl("Proposed weights", ["Criterion", "Weight (points of 100)"], [["Safety and controls (M1 to M8, D1 to D3, section 10)", "25"], ["Approach and measurement", "25"], ["Cost", "20"], ["Delivery plan and governance", "15"], ["Team and experience", "10"], ["Exit and portability", "5"]])}
  <h3>Terms</h3>
  <p>A proposer shall treat the issuer's data as confidential, shall not start work before a signed approval, and accepts that the issuer may stop at any gate. Changes to this document follow the change log in Appendix D.</p>`));

  out.push(sec("s13", "13", "Approvals and sign-off", `
  <p>I recommend that each person below signs once, at Gate 1, and again at Gate 4.</p>
  ${tbl("Sign-off", ["Role", "Name", "Decision", "Signature", "Date"], ["Executive Sponsor", "Pilot Owner", "Finance Controller", "Internal Audit", "Risk and Compliance"].map((r) => [r, fill("Full name, title"), "Approve / Reject", fill("Signature"), fill("DD Month YYYY")]))}`));

  const rates = d.policies.map((p) => p.held_out.precision[0] / p.held_out.precision[1]);
  const topShareWrong = b.top10.wrong_value / b.value.wrong, topSharePaid = b.top10.paid_value / b.value.paid;
  const dcard = (id, title, found, visual, why, ask) => `<article class="dcard"><p class="dcard-id">${id} · Recommended, not tested</p><h3>${title}</h3><p><strong>What I found:</strong> ${found}</p>${visual}<p><strong>Why it matters:</strong> ${why}</p><p class="dcard-ask"><strong>What I ask proposers:</strong> ${ask}</p></article>`;
  out.push(sec("s14", "14", "Special findings: the desirable requirements, and why I recommend them", `
  <p class="headline">The mandatory requirements keep the pilot under control. These four extras come from things I saw in the study, and I would score them.</p>
  <p class="small">Each is a recommendation drawn from the evidence, not a tested result. None changes the verdict: no approach proved the 99% bar.</p>
  <div class="dcards">
  ${dcard("D1", "Send the largest invoices to a person", `the largest tenth of the invoices the rulebook paid (${usd(b.top10.line * f.R)} and up) held ${int(b.top10.wrong)} of its ${int(b.wrong)} mistakes, but ${pct(topShareWrong, 0)} of their value.`,
    bars("Largest tenth of paid invoices: share of each total", [["Share of invoices paid", b.top10.count / b.paid, pct(b.top10.count / b.paid, 0)], ["Share of mistakes, by count", b.top10.wrong / b.wrong, pct(b.top10.wrong / b.wrong, 0)], ["Share of value paid", topSharePaid, pct(topSharePaid, 0)], ["Share of mistakes' value", topShareWrong, pct(topShareWrong, 0), true]], 1),
    "a value limit is a common accounts-payable control, and on these invoices that tenth held most of the mistakes' value. The line here was drawn from the same invoices after the results, so it describes what happened; it does not show a limit would help.",
    "set the limit from the company's own policy or earlier months, before the pilot, and test it there.")}
  ${dcard("D2", "Check a sample of paid invoices blind, every month", `when reviewers copied the AI ${Math.round(+AGREE * 10)} times in 10 (a simulation with assumed behaviour), trusting it on agreement let through about ${half(ag.wrong_median)} lines that needed a correction, against ${int(t.wrong)} when trust was earned on outcomes, though it paid far more (about ${int(ag.passed_median)} against ${int(t.passed)}), so a lower rate per invoice.`,
    "", "reviewers who can see the AI's answer tend to agree with it. A blind check, where the reviewer does not see the AI's call, measures the AI, not the reviewer.",
    "describe the sample size, who checks, and how the AI's answer is hidden from them.")}
  ${dcard("D3", "Watch how often people overrule it, as a warning sign only", "agreement mostly measured the reviewers in the simulation, not the AI.",
    "", "a rising override rate is worth looking into. A low one is not proof of accuracy, so it must never be used to grant trust (requirement M2).",
    "show the override rate on the monthly report, next to outcome-based accuracy.")}
  ${dcard("D4", "Plan the exit, and keep the data portable", `three rulebooks written separately by the same AI landed between ${pct(Math.min(...rates), 2)} and ${pct(Math.max(...rates), 2)} fine on the same invoices.`,
    "", "a new rulebook or a new AI model can behave differently. The company needs to be able to retest, switch supplier or stop, without losing the record of every call.",
    "describe the exit steps, the data the company keeps, and how every rulebook version is retested before use.")}
  </div>
  <p>Under the evaluation weights in section 12, D1 to D3 count under "Safety and controls" and D4 under "Exit and portability".</p>`));

  out.push(sec("ap", "App.", "Appendices", `
  <h3>A. Glossary</h3>
  ${tbl("Terms", ["Term", "Meaning"], [
    ["Practice mode (shadow mode)", "The rulebook makes its calls, but people still handle every invoice."],
    ["Kind of invoice", "Which department made the purchase, and whether the invoice arrived before or after the goods."],
    ["Worst likely case", "The lowest the true share of paid invoices that turn out fine is likely to be, given how many were checked (95% sure). Also called the lower bound."],
    ["The 99% bar", "Of the invoices paid without a check, at least 99 in 100 must turn out fine, judged by the worst likely case."],
    ["Settled call", "A call whose outcome is known. For acceptance, only calls the rulebook would have paid without a check count; for the switch-off rule, only calls it paid on its own."],
    ["Order line", "The unit of every count and amount here. The study's records have no invoice-document field, so one \"invoice\" in the study is one order line."],
    ["Late fix", "Correcting a line after it was paid instead of before. Its cost is the work to fix it plus any share of its value never recovered."],
    ["Gate", "A formal decision point in section 7."],
  ])}
  <h3>B. Where each figure comes from</h3>
  ${list(["The bar and the verdict: decision records 0005, 0010, 0015, 0016.", "Practice mode, promotion and switch-off rules: 0013 and 0017.", "The agreement simulation: 0014 and 0017.", "The follow-up run: 0018.", "Savings, break-even and value at stake: 0019, re-based on order lines in 0021.", "This document: 0020. Money is in US dollars; invoice values are converted from euros at " + f.R.toFixed(3) + ", the ECB's 2018 average."])}
  <h3>C. Benchmarks to collect</h3>
  <p>See the table at the end of section 11.</p>
  <h3>D. Change log</h3>
  ${tbl("Changes", ["Version", "Date", "Change", "Approved by"], [["1.0", esc(d.built), "First issue as a model document", fill("Name, role")]])}`));
  return out;
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
    set("pays-off", x.needNet > 1 ? `Not at these inputs: even with every line reviewed today, late fixes, oversight and blind checks cost more than the time saved (late fixes alone would need ${Calc.needTxt(x.need(B.L.gated_cautious))} reviewed)` : `Only if a person today reviews at least ${pct(x.needNet, 1)} of these lines (late fixes alone: ${Calc.needTxt(x.need(B.L.gated_cautious))})`);
    const upper = v.sh === null ? " Share reviewed not entered, so every line counts as reviewed today: an upper limit." : "";
    const blindTxt = ` It counts blind checks on ${kTxt} each month (${usd(x.blindYr)} a year), my assumption.`;
    set("need-note", (x.ask <= 1 ? `of the on-paper volume, with a late fix at $${int(x.M)}. Below this, the first year after the pilot does not repay it.` : `With a late fix at $${int(x.M)}, even the full on-paper volume does not repay the pilot in a year.`) + blindTxt + upper);
    set("roi-warn", v.hasInt ? "" : "Integration cost not entered: return and payback are hidden until you enter your integration cost above (0 is allowed).");
    scenRows(B.g).forEach(([e], j) => {
      const r = x.row(e);
      set(`sc-checks-${j}`, int(r.lines));
      set(`sc-wrong-${j}`, int(r.wrong));
      set(`sc-gross-${j}`, usd(r.gross));
      set(`sc-net-${j}`, Calc.signed(r.net));
      set(`sc-roi-${j}`, !v.hasInt ? "enter integration cost" : r.roi === null ? "n/a" : `${r.roi < 0 ? "−" : ""}${int(Math.abs(r.roi) * 100)}%`);
      set(`sc-pay-${j}`, !v.hasInt ? "enter integration cost" : r.pay ? `${r.pay.toFixed(1)} months` : "does not pay back");
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
  } catch (e) {
    main.innerHTML = `<p class="loading">The data could not be loaded (${esc(e.message)}). Reload the page to try again.</p>`;
    return;
  }
  const parts = build(d);
  main.innerHTML = parts.join("");
  const names = { s1: "Summary", s2: "Purpose", s3: "Scope", s4: "Evidence", s5: "Assumptions", s6: "Requirements", s7: "Pilot plan", s8: "Governance", s9: "Risks", s10: "Controls", s11: "Cost", s12: "Proposers", s13: "Approvals", s14: "Findings", ap: "Appendices" };
  $("#toc").innerHTML = Object.entries(names).map(([id, n]) => `<li><a href="#${id}"><i class="lamp"></i><span>${id === "ap" ? "A" : id.slice(1)}</span> ${n}</a></li>`).join("");
  wire(d);
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
