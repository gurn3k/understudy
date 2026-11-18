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
const PH = { p0: 4, p2: 12, p3: 2 }; // weeks
const OVERSIGHT_H = 8; // hours a week of oversight during the pilot
const DEF_MIN = 5, DEF_RATE = 40; // input defaults: my assumptions
const AGREE = "0.9", SIM_RUNS = 20; // the simulation shown: reviewers copy this share; runs per ADR 0017
const LATE_FIX = 100; // US$ per late fix: an assumption for the scenario table
const SCEN = [0.1, 0.25, 0.5, 1]; // shares of the on-paper volume, scenarios only

const tbl = (caption, heads, rows, cls = "") =>
  `<div class="tablewrap"><table class="rfp ${cls}"><caption>${caption}</caption><thead><tr>${heads.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
const sec = (id, n, title, body) => `<section id="${id}" aria-labelledby="${id}-h"><div class="col"><h2 id="${id}-h"><span class="marg" aria-hidden="true">${n}</span>${title}</h2>${body}</div><div></div></section>`;
/* Bars drawn to scale (the main report's component). rows: [name, value, label, highlight] */
const bars = (label, rows) => { const max = Math.max(...rows.map((r) => r[1])) || 1; return `<p class="bars-title">${label}</p><ul class="bars" aria-label="${label}">${rows.map(([n, x, l, hit]) => `<li class="${hit ? "hit" : ""}"><span class="name">${n}</span><span class="track" aria-hidden="true"><span class="fill" style="width:${(x / max) * 100}%"></span></span><span class="val">${l}</span></li>`).join("")}</ul>`; };
const list = (xs, tag = "ul") => `<${tag} class="plainlist">${xs.map((x) => `<li>${x}</li>`).join("")}</${tag}>`;

function figures(d) {
  const b = d.business, R = b.eur_usd, c = d.policies.find((p) => p.chosen), t = d.replay.totals;
  const b2 = d.b2 && d.b2.b_alone && d.b2.cost ? d.b2 : null;
  const firstWk = d.replay.weeks.indexOf(d.replay.first) + 1;
  const perYear = b.touches_paid * (12 / b.months);
  const v = Object.fromEntries(Object.entries(b.value).map(([k, x]) => [k, x * R]));
  return { b, R, c, t, b2, firstWk, perYear, v, cOnce: d.cost.c.usd / d.cost.c.calls, ag: d.agreement.alphas[AGREE],
    totalWeeks: PH.p0 + firstWk + PH.p2 + PH.p3, stopWk: firstWk * 2 };
}

function build(d) {
  const f = figures(d), { b, c, t, b2, firstWk, perYear, v, cOnce, ag, totalWeeks, stopWk } = f;
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
    ["What was tested?", `3 approaches, ${int(d.held_out_n)} real invoices`, "None proved the 99% bar"],
    ["How close did the best get?", `Rulebook paid ${pct(b.paid / d.held_out_n, 1)}; ${pct(c.held_out.precision[0] / c.held_out.precision[1], 2)} right; worst likely case ${pct(c.held_out.precision_lower, 2)}`, "Below the bar: not proved"],
    ["The prize on paper", `${int(perYear)} checks a year; <span data-out="hours"></span>; <span data-out="fte"></span> full-time people; <span data-out="money"></span> a year`, "Only if trusted from day one"],
    ["The risk", `${int(b.wrong)} of ${int(b.paid)} paid needed a fix (${pct(b.wrong / b.paid, 2)}), ${pct(v.wrong / v.paid, 1)} of value (${usd(v.wrong)})`, "Paid before a fix; not money lost"],
    ["Trust earned safely (replay)", `First kind in week ${firstWk}; ${int(t.passed)} paid, ${int(t.wrong)} wrong (${pct(t.wrong / t.passed, 1)})`, "Expect errors in the first months"],
    ["Pilot cost", `<span data-out="pilot"></span> oversight, plus integration`, `<span data-out="share"></span> of the on-paper yearly saving; a gross ceiling before late-fix costs`],
    ["Return", `Repays itself in its first year after the pilot if it earns <span data-out="need"></span> of the on-paper volume`, `At <span data-out="late"></span> per late fix<span data-out="need-int"></span>; scenarios, not forecasts (section 11)`],
  ], "keys")}
  <p class="ask"><strong>The decision I ask for:</strong> approve Phase 0 (set-up and baseline) now. Every later phase waits for a gate.</p>
  <p class="small">The verdict stands as in the main report: no approach proved the 99% bar. This document asks how a company could find out, safely, whether its own invoices would.</p>`));

  out.push(sec("s2", "2", "Purpose and background", `
  <p>People handle nearly every invoice by hand before it is paid. I tested whether AI could safely take the routine ones off their desks, and how a company would prove it first. The answer at my bar was <em>no</em>, but it shows how to find out, and a pilot is how a company does that on its own invoices.</p>
  ${tbl("The study at a glance", ["Item", "Detail"], [
    ["Data", "One real multinational company's purchasing records, 2018, published for research"],
    ["Size", `${int(d.log.raw.cases)} order lines, ${int(d.log.raw.events)} recorded steps`],
    ["Done by hand today", `${pct(b.manual_clear_share, 1)} of the steps that clear an invoice or lift a payment block`],
    ["Result", "No approach proved the 99% bar"],
    ["What only a pilot can tell you", "Real minutes per check, and the real cost of a late fix"],
  ])}
  <p>This request asks proposers, an internal team or an outside supplier, how they would run that pilot to the requirements below.</p>`));

  out.push(sec("s3", "3", "Scope, objectives and acceptance", `
  <h3>In scope</h3>
  ${list(["Purchase invoices matched against orders and goods receipts (the kind the study covered).", "Practice mode (shadow mode) on every kind of invoice, then limited autonomy on kinds that qualify.", "Measurement of minutes per check, cost of a late fix and the rate of corrections after payment."])}
  <h3>Out of scope</h3>
  ${list(["Payment runs, supplier onboarding and supplier bank-detail changes.", "Fraud and duplicate-payment detection. I did not test either; existing controls stay as they are.", "Any invoice type the study did not cover."])}
  <h3>Objectives</h3>
  ${list([
    "<strong>O1.</strong> Prove or disprove the 99% bar on the company's own invoices.",
    "<strong>O2.</strong> Measure real minutes per check and the real cost of a late fix, and replace my assumptions with them.",
    "<strong>O3.</strong> Keep wrong payments within a budget agreed at Gate 1.",
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
  <h3>Three ways to grant trust, on the same test invoices</h3>
  ${tbl("How trust was granted, and what it let through", ["Way", "Invoices paid", "Wrong", "Wrong rate", "Note"], [
    ["Trusted from day one (on paper)", int(b.paid), int(b.wrong), pct(b.wrong / b.paid, 2), "The ceiling; never tested live"],
    ["Earned on outcomes (replay)", int(t.passed), int(t.wrong), pct(t.wrong / t.passed, 1), `First kind in week ${firstWk} of ${d.replay.weeks.length}; mostly one kind; window too short for the steady state`],
    ["Trusted on agreement (simulation)", half(ag.passed_median), half(ag.wrong_median), `about ${pct(ag.wrong_median / ag.passed_median, 2)}`, `Reviewers copy ${Math.round(+AGREE * 10)} in 10; medians of ${SIM_RUNS} runs; assumed behaviour, not a study of people`],
  ])}
  ${bars("Wrong payments let through", [["Earned on outcomes", t.wrong, int(t.wrong)], ["Trusted on agreement (simulation, assumed behaviour)", ag.wrong_median, half(ag.wrong_median), true]])}
  <p>Trusting on agreement let through about ten times the wrong payments, though at a lower rate per invoice, because it paid far more. That is why requirement M2 forbids it.</p>
  <h3>Limits of the evidence</h3>
  ${list(["One company's records, from 2018. The method carries over; the numbers are theirs.", "\"Fine\" means no one corrected the invoice before payment. Corrections after payment are not in the records, so the true share could be lower.", "The records hold no invoice text, so the AI never read an invoice document.", "Minutes per check and hourly cost are assumptions, not measurements."])}`));

  out.push(sec("s5", "5", "Assumptions, constraints and dependencies", `
  <h3>Assumptions (mine; replace them with your own in Phase 0)</h3>
  ${tbl("Assumptions", ["Assumption", "Default", "Why"], [
    ["Minutes per check, hourly cost", `${DEF_MIN} minutes, $${DEF_RATE} (inputs in section 11)`, "The records show when work happened, not how long it took"],
    ["Oversight during the pilot", `${OVERSIGHT_H} hours a week`, "My judgment"],
    ["Phases 0, 2 and 3", `${PH.p0}, ${PH.p2} and ${PH.p3} weeks`, "My judgment"],
    ["Phase 1 (practice mode)", `About ${firstWk} weeks`, "When the first kind qualified in the replay; outcomes arrive weeks after invoices"],
    ["Shorter pilots", "Not used", "Some supplier-written guides online suggest 30 to 90 days. I have not checked them, and that is unlikely to collect enough outcomes for this bar"],
    ["Volume and working year", "No seasonality; 1,800 hours a person", "A simplification"],
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
  ])}`));

  const ph = [
    ["0 Mobilise", `${PH.p0} (my assumption)`, "Name owners; measure the baseline (minutes per check, cost of a late fix, mistake rate); write the bar and the wrong-payment budget down; test the kill switch.", "G1: sponsor and finance approve the bar and the budget"],
    ["1 Practice mode", `About ${firstWk} (the replay's first kind qualified in week ${firstWk}); it ends when G2 holds, and depends on your volume per kind`, "The rulebook makes calls on every kind; people handle every invoice; every call is scored when its outcome arrives.", "G2: at least one kind meets the bar on its outcomes"],
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
    ["R1", "A wrong payment goes out", "High", "Medium", `${int(b.wrong)} of ${int(b.paid)} on paper; ${int(t.wrong)} of ${int(t.passed)} in the replay`, "M1, M2, M3, M7", "Pilot Owner"],
    ["R2", "A late fix costs more than the break-even", "Medium", "High", `Break-even about ${int(Math.round(b.checks_per_mistake))} checks' worth (section 11)`, "Measure it in Phase 0; stop rule", "Finance Controller"],
    ["R3", "Mistakes concentrate in one kind of invoice", "Medium", "Medium", `The replay's ${int(t.wrong)} mistakes were mostly from one kind`, "Promote kind by kind; M3", "Pilot Owner"],
    ["R4", "The rulebook goes stale", "High", "Medium", "Suppliers, prices and buying habits change", "M5; scheduled retest and rewrite", "Rulebook Owner"],
    ["R5", "Mistakes found after payment go unseen", "Medium", "High", "Not in the study's records", "M6", "Finance Controller"],
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
  <p class="small">Risks beyond wrong payments (R4 to R12) are not measured by the study. They are what I would expect a risk committee to ask about.</p>`));

  out.push(sec("s10", "10", "Controls and compliance", `
  ${list([
    "<strong>Segregation of duties.</strong> Who writes a rulebook, who signs it and who approves promotions are different people.",
    "<strong>Change control.</strong> A rulebook version is not used until signed. A change to the bar, a limit or a phase length is a recorded change approved at a gate.",
    "<strong>Audit trail.</strong> Every call, input and outcome is logged and kept for the retention period the company's policy sets: " + fill("e.g. 7 years, per records policy") + ".",
    "<strong>Independent review.</strong> Internal Audit reviews a sample of paid invoices before Gate 3.",
    "<strong>Existing controls.</strong> Payment-approval limits, fraud checks and period-end controls stay in force.",
    "<strong>Regulation.</strong> The company's compliance function decides which rules apply. This document does not state any.",
  ])}`));

  out.push(sec("s11", "11", "Cost model and expected benefit", `
  <p>These figures use your inputs. The defaults are my assumptions, not measurements. Change them to match the company; everything below updates.</p>
  <div class="biz-inputs" role="group" aria-label="Your inputs">
  <label>Minutes a person spends per check <select id="in-min">${[2, 5, 10].map((m) => `<option value="${m}"${m === DEF_MIN ? " selected" : ""}>${m}</option>`).join("")}</select></label>
  <label>Cost of an hour of their time (US$) <input id="in-rate" type="number" min="1" max="500" step="1" value="${DEF_RATE}" inputmode="numeric"></label>
  <label>Oversight hours a week during the pilot <input id="in-oh" type="number" min="0" max="80" step="1" value="${OVERSIGHT_H}" inputmode="numeric"></label>
  <label>Your one-off integration cost (US$) <input id="in-int" type="number" min="0" step="1000" value="" placeholder="not entered" inputmode="numeric"></label>
  </div>
  <div class="cost biz-tiles">
  <div><span class="small">Pilot cost, my lines only</span><span class="big" data-out="pilot"></span><span class="small" data-out="pilot-note"></span></div>
  <div><span class="small">Saving on paper, a year</span><span class="big" data-out="money"></span><span class="small" data-out="hours-note"></span></div>
  <div><span class="small">Pilot cost as a share of the on-paper yearly saving</span><span class="big" data-out="share"></span><span class="small">A gross ceiling, before late-fix costs. Excludes integration unless you enter it. A size comparison, not a forecast.</span></div>
  <div><span class="small">Break-even cost of one late fix</span><span class="big" data-out="breakeven"></span><span class="small">About ${int(Math.round(b.checks_per_mistake))} checks' worth. At the worst likely case, <span data-out="breakeven-low"></span>.</span></div>
  </div>
  ${tbl("Cost lines", ["Line", "Basis", "Amount"], [
    ["Oversight", `<span data-out="oh-basis"></span>`, `<span data-out="oh-cost"></span>`],
    ["Writing the rulebook", "Measured at API list prices on the run date; nothing per invoice", `$${cOnce.toFixed(2)}`],
    ["Integration and data access", "Yours to enter above", `<span data-out="int-cost"></span>`],
    ["Training, change management and audit time", "Yours to estimate", fill("US$ amount")],
    ["Total of the lines above", "", `<span data-out="total"></span>`],
  ])}
  ${tbl("Where the on-paper saving comes from", ["Step", "Figure"], [
    [`Manual steps on the invoices the rulebook would have paid, ${b.months} test months`, int(b.touches_paid)],
    ["Scaled to a year (no seasonality)", `× ${12 / b.months} = ${int(perYear)}`],
    ["What it assumes", "Trust from day one: a ceiling, not a forecast"],
  ], "num")}
  ${bars(`Manual steps removed in the same ${b.months} months`, [["On paper (trusted from day one)", b.touches_paid, int(b.touches_paid)], ["Earned in the replay", t.touches_removed, `${int(t.touches_removed)} (${pct(t.touches_removed / b.touches_paid, 1)})`, true]])}
  <p class="small">In the replay, trust began only in week ${firstWk}, so the window shows the slow start, not the steady state. I do not estimate the steady state.</p>
  <h3>For the executive decision: return on the pilot, by scenario</h3>
  <p>How much of the on-paper saving a company would earn is what the pilot finds out. So the table shows scenarios, not a forecast.</p>
  ${tbl("Error rate used for the scenarios", ["Source", "Wrong rate"], [
    ["Test: worst likely case", pct(1 - c.held_out.precision_lower, 2)],
    [`Replay: while trusted (${int(t.wrong)} of ${int(t.passed)})`, pct(t.wrong / t.passed, 2)],
    ["Used: the higher, to be cautious", pct(Math.max(1 - c.held_out.precision_lower, t.wrong / t.passed), 2)],
  ], "num")}
  <p class="small">A kind is only trusted once it proves 99%, so this rate is a cautious stand-in, not what the pilot would aim for. The same oversight hours continue after the pilot.</p>
  <div class="biz-inputs" role="group" aria-label="Scenario inputs">
  <label>Cost of one late fix (US$) <input id="in-late" type="number" min="0" max="100000" step="10" value="${LATE_FIX}" inputmode="numeric"></label>
  <p class="small">My assumption. In this table the time saved stops covering late fixes above about <span data-out="be-scen"></span> each, before oversight. It differs from the break-even above because it counts every manual step (${(b.touches_paid / b.paid).toFixed(2)} per invoice paid) and uses the higher error rate.</p>
  </div>
  <div class="cost biz-tiles">
  <div><span class="small">Earned share needed to repay the pilot in its first year after</span><span class="big" data-out="need"></span><span class="small" data-out="need-note"></span></div>
  <div><span class="small">Wrong payments a year, at the full on-paper volume</span><span class="big" data-out="wrong-yr"></span><span class="small">At the higher of the two error rates above. Each is paid before a needed fix; it is not money lost.</span></div>
  </div>
  <p class="warn" data-out="roi-warn" role="status"></p>
  ${tbl("Return in the first year after the pilot, if it earns a share of the on-paper volume (scenarios, not forecasts; benefit during the pilot not counted)", ["Share earned", "Checks removed a year", "Wrong payments a year", "Net yearly benefit", "First-year return on the pilot (ROI)", "Payback"],
    SCEN.map((x) => [pct(x, 0), `<span data-out="sc-checks-${x}"></span>`, `<span data-out="sc-wrong-${x}"></span>`, `<span data-out="sc-net-${x}"></span>`, `<span data-out="sc-roi-${x}"></span>`, `<span data-out="sc-pay-${x}"></span>`]), "scen")}
  ${tbl("How each figure is worked out", ["Figure", "Formula"], [
    ["Net yearly benefit", "Time saved × hourly cost − wrong payments × late-fix cost − oversight (hours a week × 52)"],
    ["First-year ROI", "(Net yearly benefit − total pilot cost) ÷ total pilot cost"],
    ["Payback", "Total pilot cost ÷ monthly net benefit, from the end of the pilot"],
    ["Total pilot cost", "The cost lines above; integration only if entered; training and audit time not included"],
    ["Not included", "Discounting, tax, seasonality, benefit during the pilot"],
  ])}
  <p class="small">${pct(SCEN[SCEN.length - 1], 0)} is the on-paper ceiling, and even the ${pct(SCEN[0], 0)} row is far above what the replay earned (chart above). None of these rows changes the verdict: no approach proved the 99% bar.</p>
  <h3>Benchmarks to collect from your own records</h3>
  <p>I quote no outside figure. Published accounts-payable benchmarks vary widely with definitions and sample, so the pilot should measure your own. Fill in these before Gate 1.</p>
  ${tbl("Baseline measures", ["Measure", "Your figure", "Source and date"], ["Cost to process one invoice", "Share of invoices paid with no manual touch", "Share of invoices needing a correction before payment", "Minutes per manual check", "Minutes to resolve an exception", "Cost of fixing a payment after it was made", "Share of payments corrected after payment", "Invoices per month, by kind", "Annual volume trend and seasonal peaks"].map((m) => [m, fill("Value, with unit"), fill("System or report, period")]))}`));

  out.push(sec("s12", "12", "Instructions to proposers, timetable and evaluation", `
  <p>A proposer may be an internal team or an outside supplier. A response shall follow the section numbers of this document, answer M1 to M8 and D1 to D4 one by one, and state every assumption it changes.</p>
  ${tbl("Timetable (proposed offsets from the issue date)", ["Event", "Offset", "Date"], [["Issue date", "T", fill("DD Month YYYY")], ["Questions close", "T + 2 weeks", fill("DD Month YYYY")], ["Answers published to all proposers", "T + 3 weeks", fill("DD Month YYYY")], ["Responses due", "T + 4 weeks", fill("DD Month YYYY")], ["Shortlist and clarifications", "T + 6 weeks", fill("DD Month YYYY")], ["Decision and Gate 1 package", "T + 8 weeks", fill("DD Month YYYY")]])}
  <h3>What a response contains</h3>
  ${list(["Approach, mapped to the requirements.", "Plan against the phases and gates in section 7, with named people.", "Cost, in the format of section 11, with every assumption stated.", "Evidence of relevant past work and references.", "Declarations: conflicts of interest, confidentiality, data handling.", "Validity of the offer: " + fill("e.g. 90") + " days.", "An exit plan."])}
  <h3>Evaluation criteria</h3>
  <p>The weights are my proposal; the issuer sets its own and publishes them to proposers.</p>
  ${tbl("Proposed weights", ["Criterion", "Weight (points of 100)"], [["Safety and controls (M1 to M8, section 10)", "25"], ["Approach and measurement", "25"], ["Cost", "20"], ["Delivery plan and governance", "15"], ["Team and experience", "10"], ["Exit and portability", "5"]])}
  <h3>Terms</h3>
  <p>A proposer shall treat the issuer's data as confidential, shall not start work before a signed approval, and accepts that the issuer may stop at any gate. Changes to this document follow the change log in Appendix D.</p>`));

  out.push(sec("s13", "13", "Approvals and sign-off", `
  <p>I recommend that each person below signs once, at Gate 1, and again at Gate 4.</p>
  ${tbl("Sign-off", ["Role", "Name", "Decision", "Signature", "Date"], ["Executive Sponsor", "Pilot Owner", "Finance Controller", "Internal Audit", "Risk and Compliance"].map((r) => [r, fill("Full name, title"), "Approve / Reject", fill("Signature"), fill("DD Month YYYY")]))}`));

  out.push(sec("ap", "App.", "Appendices", `
  <h3>A. Glossary</h3>
  ${tbl("Terms", ["Term", "Meaning"], [
    ["Practice mode (shadow mode)", "The rulebook makes its calls, but people still handle every invoice."],
    ["Kind of invoice", "Which department made the purchase, and whether the invoice arrived before or after the goods."],
    ["Worst likely case", "The lowest the true share of paid invoices that turn out fine is likely to be, given how many were checked (95% sure). Also called the lower bound."],
    ["The 99% bar", "Of the invoices paid without a check, at least 99 in 100 must turn out fine, judged by the worst likely case."],
    ["Settled call", "A call whose outcome is known. For acceptance, only calls the rulebook would have paid without a check count; for the switch-off rule, only calls it paid on its own."],
    ["Late fix", "Correcting an invoice after it was paid instead of before."],
    ["Gate", "A formal decision point in section 7."],
  ])}
  <h3>B. Where each figure comes from</h3>
  ${list(["The bar and the verdict: decision records 0005, 0010, 0015, 0016.", "Practice mode, promotion and switch-off rules: 0013 and 0017.", "The agreement simulation: 0014 and 0017.", "The follow-up run: 0018.", "Savings, break-even and value at stake: 0019.", "This document: 0020. Money is in US dollars; invoice values are converted from euros at " + f.R.toFixed(3) + ", the ECB's 2018 average."])}
  <h3>C. Benchmarks to collect</h3>
  <p>See the table at the end of section 11.</p>
  <h3>D. Change log</h3>
  ${tbl("Changes", ["Version", "Date", "Change", "Approved by"], [["1.0", esc(d.built), "First issue as a model document", fill("Name, role")]])}`));
  return out;
}

function wire(d) {
  const f = figures(d), b = f.b, min = $("#in-min"), rate = $("#in-rate"), oh = $("#in-oh"), integ = $("#in-int"), late = $("#in-late");
  const badRate = Math.max(1 - f.c.held_out.precision_lower, f.t.wrong / f.t.passed), paidYr = b.paid * (12 / b.months);
  const set = (k, s) => document.querySelectorAll(`[data-out="${k}"]`).forEach((el) => (el.textContent = s));
  const draw = () => {
    const m = Number(min.value), r = Math.min(500, Math.max(1, Number(rate.value) || DEF_RATE)), h = Math.min(80, Math.max(0, Number(oh.value) || 0));
    const i = Math.max(0, Number(integ.value) || 0), c = (m / 60) * r, hrs = (f.perYear * m) / 60;
    const ohCost = h * f.totalWeeks * r, pilot = ohCost + f.cOnce, total = pilot + i, saving = hrs * r;
    set("hours", `${int(hrs)} hours`);
    set("fte", `${(hrs / 1800).toFixed(1)}`);
    set("money", usd(saving));
    set("hours-note", `${int(hrs)} hours a year, about ${(hrs / 1800).toFixed(1)} full-time people`);
    set("pilot", usd(pilot));
    set("pilot-note", `${h} hours a week for ${f.totalWeeks} weeks, plus $${f.cOnce.toFixed(2)} to write the rulebook. Excludes integration.`);
    set("share", saving ? pct(total / saving, 1) : "n/a");
    set("oh-basis", `${h} hours a week × ${f.totalWeeks} weeks × $${int(r)}`);
    set("oh-cost", usd(ohCost));
    set("int-cost", i ? usd(i) : "not entered");
    set("total", usd(total));
    set("breakeven", `about $${int(c * b.checks_per_mistake)}`);
    set("breakeven-low", `about $${int(c * b.checks_per_mistake_lower)}`);
    const M = Math.max(0, Number(late.value) || 0), run = h * 52 * r, wrongFull = paidYr * badRate;
    const margin = saving - wrongFull * M; // net yearly benefit per unit of share, before oversight
    const need = margin > 0 ? (total + run) / margin : Infinity;
    set("wrong-yr", int(wrongFull));
    set("late", `$${int(M)}`);
    set("need-int", i ? "" : ", before integration cost");
    set("be-scen", wrongFull ? `$${int(saving / wrongFull)}` : "n/a");
    set("need", need <= 1 ? pct(need, 1) : "not reachable");
    set("need-note", need <= 1 ? `of the on-paper volume, with a late fix at $${int(M)}. Below this, the first year after the pilot does not repay it.` : `With a late fix at $${int(M)}, even the full on-paper volume does not repay the pilot in a year.`);
    set("roi-warn", i ? "" : "Integration cost not entered: the pilot cost below is oversight only, so return and payback are hidden until you enter your integration cost above.");
    SCEN.forEach((x) => {
      const net = x * margin - run, roi = total ? (net - total) / total : NaN;
      set(`sc-checks-${x}`, int(x * f.perYear));
      set(`sc-wrong-${x}`, int(x * wrongFull));
      set(`sc-net-${x}`, (net < 0 ? "−" : "") + usd(Math.abs(net)));
      set(`sc-roi-${x}`, !i ? "enter integration cost" : Number.isFinite(roi) ? `${roi < 0 ? "−" : ""}${int(Math.abs(roi) * 100)}%` : "n/a");
      set(`sc-pay-${x}`, !i ? "enter integration cost" : net > 0 ? `${(total / (net / 12)).toFixed(1)} months` : "does not pay back");
    });
  };
  [min, rate, oh, integ, late].forEach((el) => el.addEventListener(el === min ? "change" : "input", draw));
  draw();
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
  const names = { s1: "Summary", s2: "Purpose", s3: "Scope", s4: "Evidence", s5: "Assumptions", s6: "Requirements", s7: "Pilot plan", s8: "Governance", s9: "Risks", s10: "Controls", s11: "Cost", s12: "Proposers", s13: "Approvals", ap: "Appendices" };
  $("#toc").innerHTML = Object.entries(names).map(([id, n]) => `<li><a href="#${id}"><i class="lamp"></i><span>${id === "ap" ? "A" : id.slice(1)}</span> ${n}</a></li>`).join("");
  wire(d);
  const links = [...document.querySelectorAll(".cues a, .tabs a[href^='#']")];
  const obs = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    links.forEach((a) => (a.getAttribute("href") === "#" + en.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  }), { rootMargin: "-30% 0px -60% 0px" });
  document.querySelectorAll("main section").forEach((s) => obs.observe(s));
}

$(".theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) { /* storage blocked: theme still switches */ }
});
boot();
