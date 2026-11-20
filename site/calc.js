"use strict";
/* The money calculator, shared by the main report's Q9 and the pilot request's section 11 (ADR 0021).
   One set of inputs, one set of results, one readout beside the inputs. Every study figure comes from
   data.json; the defaults below are my assumptions and are labelled as such on the page. */
const Calc = (() => {
  const PH = { p0: 4, p2: 12, p3: 2 }; // weeks of phases 0, 2 and 3 (phase 1 is the replay's wait for the first kind)
  const DEF = { min: 5, rate: 40, fix: 100, lost: 0, oh: 8, kinds: 1 };
  const WINDOWS_YR = 12; // blind-check windows a year: monthly
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
      totalWeeks: PH.p0 + firstWk + PH.p2 + PH.p3, dryWeeks: PH.p0 + firstWk, p2Windows: (PH.p2 * 12) / 52,
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
    : `<label>${lab} <input id="${p}-${k}" ${attrs}></label>`).join("");

  const ROWS = [
    ["gross", "Gross saving a year"],
    ["net", "Net a year, everything earned"],
    ["down", "Net a year, at the replay's earned share"],
    ["be", "Break-even cost of one late fix"],
    ["need", "Share reviewed today it needs"],
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

  function read(p) {
    const el = (k) => document.getElementById(`${p}-${k}`);
    const raw = (k) => el(k).value.trim();
    const s = readNum(el("share"), 0, 100, null);
    const v = { s, sh: s === null ? null : s / 100, m: Number(el("min").value), r: readNum(el("rate"), 1, 500, DEF.rate),
      fix: readNum(el("fix"), 0, 100000, DEF.fix), lost: readNum(el("lost"), 0, 100, DEF.lost) / 100,
      h: readNum(el("oh"), 0, 80, DEF.oh), k: Math.round(readNum(el("kinds"), 0, 50, DEF.kinds)),
      hasInt: raw("int") !== "" && Number.isFinite(Number(raw("int"))) };
    v.i = v.hasInt ? Math.max(0, Number(raw("int"))) : 0;
    const changed = (k, d) => raw(k) !== "" && Number(raw(k)) !== d;
    v.costDefault = !changed("min", DEF.min) && !changed("rate", DEF.rate);
    v.fixDefault = !changed("fix", DEF.fix) && !changed("lost", DEF.lost);
    v.runDefault = !changed("oh", DEF.oh) && !changed("kinds", DEF.kinds);
    return v;
  }

  function compute(B, v) {
    const { L } = B, c = (v.m / 60) * v.r, M = v.fix + v.lost * B.meanWrong, sUse = v.sh === null ? 1 : v.sh, bad = 1 / L.gated_cautious;
    const hrs = (B.linesYr * sUse * v.m) / 60, saving = hrs * v.r, wrongFull = B.linesYr * bad;
    const blindH = (B.b.blind.n * v.m) / 60, blindWin = blindH * v.r, blindPilot = v.k * B.p2Windows * blindWin, blindYr = v.k * WINDOWS_YR * blindWin;
    const p0 = v.h * PH.p0 * v.r, ohRest = v.h * (B.totalWeeks - PH.p0) * v.r, oversight = p0 + ohRest + B.cOnce;
    const total = oversight + blindPilot + v.i, ohYr = v.h * 52 * v.r, run = ohYr + blindYr;
    const margin = saving - wrongFull * M; // per unit of share earned, before running costs
    const row = (x) => {
      const gross = x * saving, fixes = x * wrongFull * M, net = gross - fixes - ohYr - (x > 0 ? blindYr : 0);
      return { lines: x * B.linesYr, wrong: x * wrongFull, gross, fixes, netBefore: gross - fixes, net,
        roi: v.hasInt && total ? (net - total) / total : null, pay: v.hasInt && net > 0 ? total / (net / 12) : null };
    };
    const need = (lpm) => M / (lpm * c);
    return { c, M, sUse, hrs, saving, wrongFull, bad, blindH, blindWin, blindPilot, blindYr, p0, ohRest, oversight, total, ohYr, run, margin,
      ask: margin > 0 ? (total + run) / margin : Infinity, row, need, be: (lpm) => lpm * sUse * c };
  }

  const needTxt = (n) => (n > 1 ? "more than every line" : n <= 0 ? "any share" : pct(n, 1));

  function fill(p, B, v, x) {
    const set = (k, t) => document.querySelectorAll(`[data-out="${p}-${k}"]`).forEach((e) => (e.textContent = t));
    const shareState = v.sh === null ? "Upper limit" : "Your share";
    const full = x.row(1), down = x.row(B.g.earned_share);
    set("r-gross", v.sh === null ? `up to ${usd(x.saving)}` : usd(x.saving));
    set("s-gross", shareState);
    set("n-gross", v.sh === null ? "if a person reviewed every line today; enter your share" : `${int(x.hrs)} hours of review at ${pct(v.sh, 1)}`);
    set("r-net", signed(full.net));
    set("s-net", v.sh === null ? "Upper limit" : "Ceiling");
    set("n-net", `100% earned, after late fixes, oversight and blind checks; before the pilot's one-off cost`);
    set("r-down", signed(down.net));
    set("s-down", "Observed");
    set("n-down", `${pct(B.g.earned_share, 1)} earned, as in the replay (window too short)`);
    set("r-be", `$${int(x.be(B.L.gated_cautious))} · $${int(x.be(B.L.paper))}`);
    set("s-be", shareState);
    set("n-be", `cautious end · on paper; a late fix costs you about $${int(x.M)}`);
    set("r-need", needTxt(x.need(B.L.gated_cautious)));
    set("s-need", v.fixDefault ? "Default late fix" : "Your late fix");
    set("n-need", `cautious end; ${needTxt(x.need(B.L.paper))} on paper. The records can't show today's share`);
    set("r-pilot", usd(x.total));
    set("s-pilot", v.hasInt ? "Integration entered" : "No integration");
    set("n-pilot", `${v.runDefault ? "default" : "your"} oversight and blind checks (${v.k} kind${v.k === 1 ? "" : "s"}, monthly)${v.hasInt ? "" : "; add integration for ROI"}; other required lines are still blank`);
    set("r-roi", !v.hasInt ? "Enter integration" : full.roi === null ? "n/a" : `${full.roi < 0 ? "−" : ""}${int(Math.abs(full.roi) * 100)}% · ${full.pay ? `${full.pay.toFixed(1)} months` : "no payback"}`);
    set("s-roi", !v.hasInt ? "Not entered" : v.sh === null ? "Upper limit" : "Ceiling");
    set("n-roi", `at 100% earned; it needs ${x.ask <= 1 ? pct(x.ask, 1) : "more than 100%"} of the on-paper volume to repay in its first year after the pilot`);
  }

  /* Wires the inputs: every change recomputes and refills the readout, then the page's own detail. */
  function wire(p, d, after) {
    const B = basis(d), ids = ["share", "min", "rate", "fix", "lost", "oh", "kinds", "int"];
    if (!ids.every((k) => document.getElementById(`${p}-${k}`))) return;
    const draw = () => { const v = read(p), x = compute(B, v); fill(p, B, v, x); if (after) after(B, v, x); };
    ids.forEach((k) => document.getElementById(`${p}-${k}`).addEventListener(k === "min" ? "change" : "input", draw));
    draw();
  }

  return { PH, DEF, WINDOWS_YR, basis, html, wire, needTxt, usd, signed };
})();
