"use strict";
/* The money calculator, shared by the main report's Q9 and the pilot request's section 11 (ADR 0021).
   One set of inputs, one set of results, one readout beside the inputs. Every study figure comes from
   data.json; the defaults below are my assumptions and are labelled as such on the page. */
const Calc = (() => {
  const PH = { p0: 4, p2: 12, p3: 2 }; // weeks of phases 0, 2 and 3 (phase 1 is the replay's wait for the first kind)
  const DEF = { min: 5, rate: 40, fix: 100, lost: 0, oh: 8, kinds: 1 };
  const WINDOWS_YR = 12; // blind-check windows a year at the cost default: monthly, M9's shortest window (ADR 0025)
  const int = (n) => Math.round(n).toLocaleString("en-US");
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const usd = (x) => (x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e4 ? `$${int(Math.round(x / 1000))}k` : `$${int(x)}`);
  const signed = (x) => (x < 0 ? "−" : "") + usd(Math.abs(x));

  /* Blank or unreadable gives the default; out of range is held to the field's limits. */
  function readNum(el, lo, hi, dflt) {
    const v = el.value.trim(), n = Number(v);
    if (v === "" || !Number.isFinite(n)) return dflt;
    return Math.min(hi, Math.max(lo, n));
  }

  function basis(d) {
    const b = d.business, R = b.eur_usd, firstWk = d.replay.weeks.indexOf(d.replay.first) + 1;
    return { b, L: b.lines_per_mistake, g: b.gated, linesYr: b.paid * (12 / b.months), firstWk,
      totalWeeks: PH.p0 + firstWk + PH.p2 + PH.p3, dryWeeks: PH.p0 + firstWk, stopWk: firstWk * 2,
      maxWeeks: PH.p0 + firstWk * 2 + PH.p2 + PH.p3, // the stop rule ends practice mode at twice the replay's first promotion
      p2Windows: (PH.p2 * 12) / 52,
      qWin: d.controls.defaults.blind_quarter_windows, // M9's longest window: a calendar quarter
      meanWrong: b.anchors.mean_wrong * R, meanBelow: b.anchors.mean_wrong_below_top10 * R, cOnce: d.cost.c.usd / d.cost.c.calls };
  }

  const FIELDS = (p) => [
    ["share", `Share of these lines a person reviews today (%)`, `type="number" min="0" max="100" step="0.1" value="" placeholder="not measured" inputmode="decimal"`],
    ["min", "Minutes per review", null],
    ["rate", "Cost of an hour of their time (US$)", `type="number" min="1" max="500" step="1" value="${DEF.rate}" inputmode="numeric"`],
    ["fix", "Work to fix one line after payment (US$)", `type="number" min="0" max="100000" step="10" value="${DEF.fix}" inputmode="numeric"`],
    ["lost", "Share of a wrongly paid line's value never recovered (%)", `type="number" min="0" max="100" step="0.5" value="${DEF.lost}" inputmode="decimal"`],
    ["oh", "Oversight hours a week during the pilot", `type="number" min="0" max="80" step="1" value="${DEF.oh}" inputmode="numeric"`],
    ["kinds", "Kinds of invoice paid on their own (for blind checks)", `type="number" min="0" max="50" step="1" value="${DEF.kinds}" inputmode="numeric"`],
    ["int", "Your one-off integration cost (US$)", `type="number" min="0" step="1000" value="" placeholder="not entered" inputmode="numeric"`],
  ].map(([k, lab, attrs]) => k === "min"
    ? `<label>${lab} <select id="${p}-min">${[2, 5, 10].map((m) => `<option value="${m}"${m === DEF.min ? " selected" : ""}>${m}</option>`).join("")}</select></label>`
    : `<label>${lab} <input id="${p}-${k}" ${attrs}><span class="clamp small" data-clamp="${p}-${k}"></span></label>`).join("");

  const ROWS = [
    ["gross", "Gross saving a year"],
    ["net", "Net a year, everything earned"],
    ["down", "Net a year, at the replay's earned share"],
    ["be", "Break-even cost of one late fix"],
    ["need", "Share reviewed today it needs to pay its way"],
    ["pilot", "Pilot cost, blind checks included"],
    ["roi", "First-year return and payback"],
  ];

  /* The inputs and, beside them, every key result. Detail tables stay below for anyone who wants depth. */
  function html(p, note) {
    return `<div class="calc">
  <div class="biz-inputs calc-in" role="group" aria-label="Your inputs">${FIELDS(p)}</div>
  <div class="calc-out" aria-live="polite"><p class="calc-head">At your inputs</p>
  <dl>${ROWS.map(([k, lab]) => `<div><dt>${lab}</dt><dd><b data-out="${p}-r-${k}"></b><span class="calc-state" data-out="${p}-s-${k}"></span><span class="small" data-out="${p}-n-${k}"></span></dd></div>`).join("")}</dl></div>
  ${note ? `<p class="small calc-note">${note}</p>` : ""}
</div>`;
  }

  /* Field limits, shared by read() and the notes that say when an entry was held at a limit. */
  const LIMITS = { share: [0, 100], rate: [1, 500], fix: [0, 100000], lost: [0, 100], oh: [0, 80], kinds: [0, 50], int: [0, Infinity] };
  function clampNote(el, k, used) {
    const raw = el.value.trim(), n = Number(raw), [lo, hi] = LIMITS[k];
    if (raw === "" || !Number.isFinite(n)) return "";
    if (n < lo) return `Held at ${lo}, the lowest allowed.`;
    if (n > hi) return `Held at ${hi.toLocaleString("en-US")}, the highest allowed.`;
    if (k === "kinds" && n !== used) return `Rounded to ${used}.`;
    return "";
  }

  function read(p) {
    const el = (k) => document.getElementById(`${p}-${k}`);
    const raw = (k) => el(k).value.trim();
    const s = readNum(el("share"), ...LIMITS.share, null);
    const v = { s, sh: s === null ? null : s / 100, m: Number(el("min").value), r: readNum(el("rate"), ...LIMITS.rate, DEF.rate),
      fix: readNum(el("fix"), ...LIMITS.fix, DEF.fix), lost: readNum(el("lost"), ...LIMITS.lost, DEF.lost) / 100,
      h: readNum(el("oh"), ...LIMITS.oh, DEF.oh), k: Math.round(readNum(el("kinds"), ...LIMITS.kinds, DEF.kinds)),
      hasInt: raw("int") !== "" && Number.isFinite(Number(raw("int"))) };
    v.i = v.hasInt ? Math.max(0, Number(raw("int"))) : 0;
    const changed = (k, d) => raw(k) !== "" && Number(raw(k)) !== d;
    v.costDefault = !changed("min", DEF.min) && !changed("rate", DEF.rate);
    v.fixDefault = !changed("fix", DEF.fix) && !changed("lost", DEF.lost);
    v.runDefault = !changed("oh", DEF.oh) && !changed("kinds", DEF.kinds);
    // Say when an entry was held at a field's limit, so no input is changed silently.
    const used = { share: v.s, rate: v.r, fix: v.fix, lost: v.lost * 100, oh: v.h, kinds: v.k, int: v.i };
    v.notes = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, clampNote(el(k), k, used[k])]));
    return v;
  }

  function compute(B, v) {
    const { L } = B, c = (v.m / 60) * v.r, M = v.fix + v.lost * B.meanWrong, sUse = v.sh === null ? 1 : v.sh, bad = 1 / L.gated_cautious;
    const hrs = (B.linesYr * sUse * v.m) / 60, saving = hrs * v.r, wrongFull = B.linesYr * bad;
    const blindH = (B.b.blind.n * v.m) / 60, blindWin = blindH * v.r, blindPilot = v.k * B.p2Windows * blindWin, blindYr = v.k * WINDOWS_YR * blindWin;
    const p0 = v.h * PH.p0 * v.r, ohRest = v.h * (B.totalWeeks - PH.p0) * v.r, oversight = p0 + ohRest + B.cOnce;
    const ohMax = v.h * (B.maxWeeks - PH.p0) * v.r; // oversight, phases 1 to 3, if Phase 1 runs to the stop rule
    const total = oversight + blindPilot + v.i, ohYr = v.h * 52 * v.r, run = ohYr + blindYr;
    const margin = saving - wrongFull * M; // per unit of share earned, before running costs
    // Blind checks a year: one window's lines per kind per window, but never more lines than are paid on their own.
    const blindAt = (x, windows = WINDOWS_YR) => (Math.min(x * B.linesYr, v.k * windows * B.b.blind.n) * v.m / 60) * v.r;
    const row = (x) => {
      const gross = x * saving, fixes = x * wrongFull * M, blind = blindAt(x), net = gross - fixes - ohYr - blind;
      return { lines: x * B.linesYr, wrong: x * wrongFull, gross, fixes, blind, netBefore: gross - fixes, net,
        // ROI on a pilot costing under $1,000 is not a meaningful percentage.
        roi: v.hasInt && total >= 1000 ? (net - total) / total : null, pay: v.hasInt && net > 0 ? total / (net / 12) : null };
    };
    const need = (lpm) => M / (lpm * c);
    // The decision figure: the share reviewed today at which the yearly net, with everything earned, reaches zero after
    // late fixes (cautious end), oversight and blind checks. need() above is the per-line test, before running costs.
    const needNet = (wrongFull * M + ohYr + blindAt(1)) / (B.linesYr * c);
    const needNetQ = (wrongFull * M + ohYr + blindAt(1, B.qWin)) / (B.linesYr * c); // the same, with quarterly windows
    return { ohMax, c, M, sUse, hrs, saving, wrongFull, bad, blindH, blindWin, blindPilot, blindYr, p0, ohRest, oversight, total, ohYr, run, margin, needNet, needNetQ,
      ask: margin > 0 ? (total + run) / margin : Infinity, row, need, be: (lpm) => lpm * sUse * c };
  }

  const needTxt = (n) => (n > 1 ? "more than every line" : n <= 0 ? "any share" : pct(n, 1));

  function fill(p, B, v, x) {
    const set = (k, t) => document.querySelectorAll(`[data-out="${p}-${k}"]`).forEach((e) => (e.textContent = t));
    const dflt = (parts) => (parts.length ? ` · default ${parts.join(", ")}` : "");
    const costD = v.costDefault ? ["time and rate"] : [], fixD = v.fixDefault ? ["late fix"] : [], runD = v.runDefault ? ["oversight and blind checks"] : [];
    const shareState = v.sh === null ? "Upper limit" : "Your share";
    const full = x.row(1), down = x.row(B.g.earned_share);
    set("r-gross", v.sh === null ? `up to ${usd(x.saving)}` : usd(x.saving));
    set("s-gross", shareState + dflt(costD));
    set("n-gross", v.sh === null ? "if a person reviewed every line today; enter your share" : `${int(x.hrs)} hours of review at ${pct(v.sh, 1)}`);
    set("r-net", signed(full.net));
    set("s-net", (v.sh === null ? "Upper limit" : "Ceiling") + dflt([...costD, ...fixD, ...runD]));
    set("n-net", `100% earned, after late fixes, oversight and blind checks; before the pilot's one-off cost`);
    set("r-down", signed(down.net));
    set("s-down", "Observed earned share" + (v.sh === null ? " · upper-limit share" : "") + dflt([...costD, ...fixD, ...runD]));
    set("n-down", `${pct(B.g.earned_share, 1)} earned, as in the replay (window too short)`);
    set("r-be", `$${int(x.be(B.L.gated_cautious))} · $${int(x.be(B.L.paper))}`);
    set("s-be", shareState + dflt(costD));
    set("n-be", `cautious end · on paper; a late fix costs you about $${int(x.M)}`);
    set("r-need", x.needNet > 1 ? "Doesn't pay at these inputs" : needTxt(x.needNet));
    set("s-need", dflt([...costD, ...fixD, ...runD]).replace(/^ · d/, "D") || "Your inputs");
    set("n-need", `${x.needNet > 1 ? "Even with every line reviewed today and everything earned, late fixes, oversight and blind checks cost more than the time saved." : "With everything earned, after late fixes (cautious end), oversight and blind checks; before the pilot's one-off cost."} With quarterly blind-check windows instead of monthly: ${x.needNetQ > 1 ? "still doesn't pay" : `needs ${pct(x.needNetQ, 1)}`}. Late fixes alone, before running costs: ${needTxt(x.need(B.L.gated_cautious))} (cautious end), ${needTxt(x.need(B.L.paper))} on paper.`);
    set("r-pilot", usd(x.total));
    set("s-pilot", (v.hasInt ? "Integration entered" : "No integration") + dflt([...(v.costDefault ? ["time and rate"] : []), ...runD]));
    set("n-pilot", `${v.runDefault ? "default" : "your"} oversight and blind checks (${v.k} kind${v.k === 1 ? "" : "s"}, monthly)${v.hasInt ? "" : "; add integration for ROI"}; other required lines are still blank${v.k === 0 ? ". With no kinds entered there are no blind checks, which M9 requires for every kind paid on its own" : ""}`);
    set("r-roi", !v.hasInt ? "Enter integration" : full.roi === null ? "n/a (pilot under $1k)" : `${full.roi < 0 ? "−" : ""}${int(Math.abs(full.roi) * 100)}% · ${full.pay ? `${full.pay.toFixed(1)} months` : "no payback"}`);
    set("s-roi", !v.hasInt ? "Not entered" : (v.sh === null ? "Upper limit" : "Ceiling") + dflt([...costD, ...fixD, ...runD]));
    set("n-roi", `at 100% earned; it needs ${x.ask <= 1 ? pct(x.ask, 1) : "more than 100%"} of the on-paper volume to repay in its first year after the pilot`);
  }

  /* Wires the inputs: every change recomputes and refills the readout, then the page's own detail. */
  function wire(p, d, after) {
    const B = basis(d), ids = ["share", "min", "rate", "fix", "lost", "oh", "kinds", "int"];
    if (!ids.every((k) => document.getElementById(`${p}-${k}`))) return;
    const draw = () => {
      const v = read(p), x = compute(B, v);
      Object.entries(v.notes).forEach(([k, t]) => document.querySelectorAll(`[data-clamp="${p}-${k}"]`).forEach((e) => (e.textContent = t)));
      fill(p, B, v, x); if (after) after(B, v, x);
    };
    ids.forEach((k) => document.getElementById(`${p}-${k}`).addEventListener(k === "min" ? "change" : "input", draw));
    draw();
  }

  return { PH, DEF, WINDOWS_YR, basis, html, wire, needTxt, usd, signed };
})();
