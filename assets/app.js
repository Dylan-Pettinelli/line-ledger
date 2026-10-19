/* Line Ledger: renders every page from data.js (window.DATA, written by `python nfl.py publish`). */
(function () {
  const D = window.DATA;
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const odds = (p) => (p > 0 ? "+" : "") + p;
  const sgn = (v) => (v > 0 ? "+" : "");
  const pct = (v, sign = true) => v == null ? "&ndash;" : (sign ? sgn(v) : "") + v.toFixed(1) + "%";
  const num = (v, d, sign) => v == null ? "&ndash;" : (sign ? sgn(v) : "") + v.toFixed(d);
  const tone = (v) => v == null || Math.abs(v) < 1e-9 ? "" : v > 0 ? "up" : "down";
  const SHARP = { agrees: "Sharp agrees", against: "Sharp against", neutral: "Sharp neutral", "no line": "No sharp line" };
  const sharpChip = (s) => s ? `<span class="chip ${s === "no line" ? "noline" : s}">${SHARP[s] || esc(s)}</span>` : "";

  document.querySelectorAll(".tabs a").forEach((a) => { if (a.dataset.tab === page) a.setAttribute("aria-current", "page"); });
  $("updated").textContent = `Last updated ${D.updated} ET.`;

  /* ------------------------------------------------------------------ a ticket */
  function lane(p, unit) {
    const now = p.now;
    if (now == null) return `<div class="clv-f"><span>Stamped at <b>${p.line}</b></span><span>no newer line yet</span></div>`;
    const mv = (now - p.line) * (p.side === "OVER" ? 1 : -1);
    const scale = p.prop === "receptions" ? 50 : 4;                  // % of half-bar per catch / per yard
    const w = Math.min(50, Math.abs(mv) * scale);
    const fill = mv > 0 ? `<i class="up" style="left:50%;width:${w}%"></i>` : mv < 0 ? `<i class="down" style="left:${50 - w}%;width:${w}%"></i>` : "";
    return `<div class="lane"><span>${p.line}</span><span class="bar" aria-hidden="true">${fill}</span><span>${now}</span></div>
      <div class="clv-f"><span>${mv ? "Moved" : "Line didn't move"} ${mv ? `<b class="${tone(mv)}">${sgn(mv)}${mv.toFixed(1)} ${unit}</b> ${mv > 0 ? "our way" : "against"}` : ""}</span>
      ${p.closed ? `<span>Beat close <b class="${p.beat ? "up" : "down"}">${p.beat ? "yes" : "no"}</b></span>` : `<span>closes at kickoff</span>`}</div>`;
  }

  function ticket(p) {
    const P = D.props[p.prop];
    const res = p.result ? `<span class="res ${p.result}">${p.result === "VOID" ? "VOID" : p.result}${p.actual != null && p.result !== "VOID" ? " &middot; " + p.actual : ""}</span>`
      : `<span class="res ${p.state}">${p.state === "open" ? "OPEN" : "IN PLAY"}</span>`;
    const mv = p.now == null ? null : (p.now - p.line) * (p.side === "OVER" ? 1 : -1);
    const head = p.closed
      ? `<small>Closing line value</small><b class="${tone(p.clv_ev)}">${pct(p.clv_ev)}</b>`
      : `<small>Line since the pick</small><b class="${tone(mv)}">${mv == null ? "&ndash;" : `${sgn(mv)}${mv.toFixed(1)} ${P.unit}`}</b>`;
    return `<article class="ticket">
      <div class="t-top">
        <div class="t-meta"><span>${esc(p.game)} &middot; ${esc(p.kick)}</span>${sharpChip(p.sharp)}</div>
        <div class="t-player">${esc(p.player)}</div>
        <div class="t-pick"><span><b>${p.side} ${p.line}</b><small>${odds(p.price)} ${esc(p.book)}</small></span>${res}</div>
      </div>
      <div class="clv"><div class="clv-h">${head}</div>${lane(p, P.unit)}</div>
      <div class="stats">
        <span>Model<b>${num(p.model, P.dec)}</b></span><span>Win<b>${pct(p.win, false)}</b></span>
        <span>EV<b>${pct(p.ev)}</b></span><span>Stake<b>${num(p.units, 1)}u</b></span>
      </div>
      <div class="t-foot"><span>Stamped ${esc(p.stamped)} ET</span>${p.pre ? `<span class="chip pre">pre-launch</span>` : P.paper ? `<span class="chip paper">paper pick</span>` : ""}</div>
    </article>`;
  }
  const tickets = (ps) => ps.length ? `<div class="tickets">${ps.map(ticket).join("")}</div>` : "";

  /* ------------------------------------------------------------------ records */
  function tote(rec, P) {
    const r = rec[0] || { n: 0 };
    const cells = [
      ["key", r.clv_ev != null ? `<b class="${tone(r.clv_ev)}">${pct(r.clv_ev)}</b>` : "<b>&ndash;</b>", "value vs close"],
      ["", `<b>${r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%"}</b>`, "beat the close"],
      ["", `<b>${r.n ? `${r.W}-${r.L}${r.P ? "-" + r.P : ""}` : "0-0"}</b>`, P.paper ? "paper record" : "record"],
      ["", `<b class="${tone(r.units)}">${r.n ? num(r.units, 2, true) + "u" : "&ndash;"}</b>`, "units, flat 1u"],
    ];
    return `<div class="tote">${cells.map(([c, b, s]) => `<div class="${c}">${b}<span>${s}</span></div>`).join("")}</div>`;
  }

  function recordTable(rows) {
    if (!rows.length) return `<div class="empty">No graded picks yet.</div>`;
    return `<div class="tablebox"><table>
      <thead><tr><th>Picks</th><th class="num opt">Graded</th><th class="num">W-L-P</th><th class="num opt">Win %</th><th class="num">Units</th><th class="num opt">ROI</th><th class="num key">Value vs close</th><th class="num opt">Beat close</th></tr></thead>
      <tbody>${rows.map((x, i) => `<tr class="${x.sub ? "sub" : i === 0 ? "top" : ""}">
        <td>${esc(x.label)}</td><td class="num opt">${x.n}${x.pending ? ` <span class="note">+${x.pending}</span>` : ""}</td>
        <td class="num">${x.W}-${x.L}${x.P ? "-" + x.P : ""}</td><td class="num opt">${x.n ? pct(x.win, false) : "&ndash;"}</td>
        <td class="num ${tone(x.units)}">${x.n ? num(x.units, 2, true) : "&ndash;"}</td><td class="num opt ${tone(x.roi)}">${pct(x.roi)}</td>
        <td class="num key ${tone(x.clv_ev)}">${pct(x.clv_ev)}</td><td class="num opt">${x.beat == null ? "&ndash;" : x.beat.toFixed(0) + "%"}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  function weekHead(P, w) {
    const r = P.weeks[w];
    const bits = r && r.n ? [`<b>${r.W}-${r.L}${r.P ? "-" + r.P : ""}</b>`, `<b class="${tone(r.units)}">${num(r.units, 2, true)}u</b>`,
      `value vs close <b class="${tone(r.clv_ev)}">${pct(r.clv_ev)}</b>`] : [r && r.pending ? `${r.pending} open` : "no picks graded yet"];
    return `<div class="weekhead"><h3>Week ${w}</h3><span class="mono">${bits.join(" &middot; ")}</span></div>`;
  }

  /* ------------------------------------------------------------------ pages */
  function hero(eyebrow, title, text, extra = "") {
    $("hero").innerHTML = `<div class="hero"><div class="eyebrow" style="color:#aeb9cc">${eyebrow}</div><h1>${title}</h1><p>${text}</p></div>${extra}`;
  }

  function home() {
    const P = D.props.passing_yards, R = D.props.receptions;
    hero(`NFL player props &middot; ${D.season} &middot; week ${D.week ?? "-"}`, "Every pick stamped. <em>Every result kept.</em>",
      "QB passing-yard props, priced against DraftKings and FanDuel, posted before kickoff and graded against the closing line. Nothing is edited or removed.",
      P ? tote(P.record, P) : "");
    const wp = P ? P.picks.filter((p) => p.week === D.week) : [];
    const wr = R ? R.picks.filter((p) => p.week === D.week) : [];
    const order = { agrees: 0, neutral: 1, "no line": 2, against: 3 };
    const topR = [...wr].sort((a, b) => (order[a.sharp] ?? 4) - (order[b.sharp] ?? 4) || (b.ev ?? 0) - (a.ev ?? 0)).slice(0, 6);
    $("app").innerHTML = `
      <section><div class="head"><div><div class="eyebrow">Week ${D.week ?? "-"} &middot; the record</div><h2>QB passing yards</h2></div></div>
        ${wp.length ? tickets(wp) : `<div class="empty">No passing-yards picks posted yet for week ${D.week}. Picks go up when the books post lines and the model finds value, usually Wednesday or Thursday.</div>`}
        <a class="more" href="passing.html">Full record and every pick &rarr;</a></section>
      ${R ? `<section><div class="head"><div><div class="eyebrow">Week ${D.week ?? "-"} &middot; research desk, not part of the record</div><h2>Receptions</h2></div></div>
        <p class="lede">${wr.length} paper picks this week. Shown first: the ones Pinnacle agrees with.</p>
        ${tickets(topR)}
        <a class="more" href="receptions.html">All ${wr.length} receptions picks &rarr;</a></section>` : ""}
      <section><div class="head"><div><div class="eyebrow">Why closing line value</div><h2>Judge us by the close</h2></div></div>
        <p class="lede">Win-loss swings with luck for hundreds of bets. The closing line is the market's sharpest price; consistently getting a better number than it is the clearest sign of a real edge. Every ticket shows where the line went after the pick and what the pick was worth against the close.</p>
        <a class="more" href="method.html">How we grade &rarr;</a></section>`;
  }

  function propPage(key) {
    const P = D.props[key];
    if (!P) { $("app").innerHTML = `<div class="empty">Nothing here yet.</div>`; return; }
    hero(`${P.paper ? "Research desk &middot; paper picks" : "The record"} &middot; since ${D.since}`, P.label, P.blurb, tote(P.record, P));
    const filters = [
      ["all", "All", () => true], ["open", "Open", (p) => !p.result], ["W", "Won", (p) => p.result === "W"], ["L", "Lost", (p) => p.result === "L"],
      ["agrees", "Sharp agrees", (p) => p.sharp === "agrees"], ["against", "Sharp against", (p) => p.sharp === "against"],
    ].filter(([k, , f]) => k === "all" || P.picks.some(f));
    let active = "all";
    const draw = () => {
      const f = filters.find((x) => x[0] === active)[2];
      const shown = P.picks.filter(f);
      const weeks = [...new Set(shown.map((p) => p.week))].sort((a, b) => b - a);
      $("picks").innerHTML = weeks.length ? weeks.map((w) => `<div style="display:grid;gap:14px">${weekHead(P, w)}${tickets(shown.filter((p) => p.week === w))}</div>`).join("")
        : `<div class="empty">No picks match.</div>`;
      document.querySelectorAll(".filters button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === active)));
    };
    $("app").innerHTML = `
      <section><div class="head"><div><div class="eyebrow">Graded flat, 1 unit per pick</div><h2>Record</h2></div></div>
        ${recordTable(P.record)}
        ${P.record.some((r) => /Pre-launch/.test(r.label)) ? `<p class="note"><span class="chip pre">pre-launch</span> picks (week 6) were made by the same model and time-stamped in our private ledger, but not posted publicly before kickoff. From ${esc(D.launch)} on, every pick is posted before kickoff.</p>` : ""}</section>
      <section><div class="head"><div><div class="eyebrow">Newest first</div><h2>Every pick</h2></div></div>
        <div class="filters" role="group" aria-label="Filter picks">${filters.map(([k, label, f]) =>
          `<button type="button" data-k="${k}" aria-pressed="false">${label}<span>${P.picks.filter(f).length}</span></button>`).join("")}</div>
        <div id="picks" style="display:grid;gap:34px"></div></section>`;
    document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => { active = b.dataset.k; draw(); }));
    draw();
  }

  function method() {
    hero("How it works", "Stamped, posted, <em>graded at the close.</em>", "What every number on this site means, and why the closing line is the scoreboard.");
    $("app").innerHTML = `
      <section><div class="steps">
        <div><h3>Stamp</h3><p>The model prices every player the books post. When it finds value, the pick, line and price are stamped and frozen. Later runs never change them, and nothing is ever removed.</p></div>
        <div><h3>Post</h3><p>Picks go up before kickoff. Every update to this site is a public commit, so anyone can check when a pick was posted in the site's history on GitHub.</p></div>
        <div><h3>Grade</h3><p>After the game the result comes from official stats, and the pick's line and price are compared with the closing market, win or lose.</p></div>
      </div></section>
      <section><div><div class="eyebrow">The scoreboard</div><h2>Closing line value</h2></div>
        <dl class="defs">
          <dt>Value vs close</dt><dd>What the pick was worth against the closing market, with the bookmaker's cut removed. A pick at exactly the closing line at -110 scores about -4.5%; above 0% means beating the close by more than the cut. Over a few hundred picks, this is the most reliable sign of a real edge, far more than win rate.</dd>
          <dt>Beat the close</dt><dd>The pick got a better line than the close, or the same line at a better price.</dd>
          <dt>Line moved</dt><dd>How far the line moved from the pick to the close (or to now, before kickoff). Green means toward the pick: the market came to us.</dd>
          <dt>Units</dt><dd>The record is graded flat, 1 unit per pick at the price stamped, so one big bet can't flatter the numbers. The stake on each ticket is a suggestion in units, where 1u = 1% of a bankroll (quarter-Kelly, capped at 2u).</dd>
        </dl></section>
      <section><div><div class="eyebrow">Model + sharp money</div><h2>The Sharp label</h2></div>
        <p class="lede">Pinnacle is the sharpest sportsbook: it takes large bets from professionals and moves fast. When a pick is stamped, we record Pinnacle's line for the same player and ask which side its prices favour at our line.</p>
        <dl class="defs">
          <dt>Sharp agrees</dt><dd>Pinnacle priced our side as the likelier winner. The model and sharp money lean the same way.</dd>
          <dt>Sharp neutral</dt><dd>Pinnacle had it a coin flip at our line.</dd>
          <dt>Sharp against</dt><dd>Pinnacle priced the other side as the likelier winner.</dd>
          <dt>No sharp line</dt><dd>Pinnacle didn't list the player.</dd>
        </dl>
        <p class="callout">Whether "sharp agrees" picks really do better is an open question. The record pages split every result by this label so it can be answered in the open.</p></section>
      <section><div><div class="eyebrow">Honesty notes</div><h2>What's on the record</h2></div>
        <dl class="defs">
          <dt>QB passing yards</dt><dd>The record. Every pick the model recommends, from ${esc(D.since)} on.</dd>
          <dt>Receptions</dt><dd>${esc(D.props.receptions ? D.props.receptions.blurb : "")}</dd>
          <dt>Pre-launch</dt><dd>Week 6 picks were made before this site went public (${esc(D.launch)}). They are shown and counted, tagged pre-launch, because their time stamps come from our private ledger and can't be checked here.</dd>
        </dl></section>`;
  }

  if (page === "home") home();
  else if (page === "passing") propPage("passing_yards");
  else if (page === "receptions") propPage("receptions");
  else method();
})();
