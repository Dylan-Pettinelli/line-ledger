/* Line Ledger: renders every page from data.js (window.DATA, written by `python nfl.py publish`). */
(function () {
  const D = window.DATA;
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);
  const PROPS = ["passing_yards", "receptions"].filter((k) => D.props[k]);

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const odds = (p) => p == null ? "&ndash;" : (p > 0 ? "+" : "") + p;
  const sgn = (v) => (v > 0 ? "+" : "");
  const pct = (v, sign = true) => v == null ? "&ndash;" : (sign ? sgn(v) : "") + v.toFixed(1) + "%";
  const num = (v, d, sign) => v == null ? "&ndash;" : (sign ? sgn(v) : "") + v.toFixed(d);
  const tone = (v) => v == null || Math.abs(v) < 1e-9 ? "" : v > 0 ? "up" : "down";
  const wl = (r) => r && r.n ? `${r.W}-${r.L}${r.P ? "-" + r.P : ""}` : "0-0";
  const SHARP = { agrees: "Sharp agrees", against: "Sharp against", neutral: "Sharp neutral", "no line": "No sharp line" };
  const SEAL = { W: "Win", L: "Loss", P: "Push", VOID: "Void" };
  const sharpChip = (s, atClose) => s ? `<span class="chip ${s === "no line" ? "noline" : s}"${atClose ? ' title="Pinnacle\'s closing line"' : ' title="Pinnacle\'s latest line"'}>${SHARP[s] || esc(s)}${atClose ? " &middot; close" : ""}</span>` : "";

  /* team colors: badges and ticket bands (colors only - no logos) */
  const TEAMS = D.teams || {};
  const light = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150; };
  const tm = (abbr) => {
    const [c1, c2] = TEAMS[abbr] || ["#5b6880", "#d6dce6"];
    return `<span class="tm" style="--c1:${c1};--c2:${c2};color:${light(c1) ? "#101820" : "#fff"}">${esc(abbr)}</span>`;
  };
  const gameLabel = (p) => p.home ? `${tm(p.opp)}<i class="at">@</i>${tm(p.team)}` : `${tm(p.team)}<i class="at">@</i>${tm(p.opp)}`;
  const band = (p) => { const [c1, c2] = TEAMS[p.team] || ["#5b6880", "#d6dce6"]; return `--c1:${c1};--c2:${c2}`; };

  /* games with open picks, soonest first */
  function gamesOf(list) {
    const out = [], seen = {};
    list.forEach((p) => {
      const id = p.game_id || `${p.week}-${[p.team, p.opp].sort().join("-")}`;
      if (!seen[id]) { seen[id] = { id, kick: p.kick, kick_utc: p.kick_utc, live: p.state !== "open", away: p.home ? p.opp : p.team, home: p.home ? p.team : p.opp, picks: [] }; out.push(seen[id]); }
      seen[id].picks.push(p);
    });
    return out;
  }
  const gameWhen = (g) => g.live ? `<span class="live"><i></i>Live</span>` : `<span class="countdown" data-kick="${g.kick_utc}">${esc(g.kick)}</span>`;
  const gameChip = (g, href) => `<a class="gchip" href="${href}#g-${esc(g.id)}">
      <span class="gteams">${tm(g.away)}<i class="at">@</i>${tm(g.home)}</span>
      <span class="gmeta">${gameWhen(g)}<span>${g.picks.length} open</span></span></a>`;
  const gameStrip = (list, href) => `<div class="gstrip" role="list" aria-label="Games with open picks">${gamesOf(list).map((g) => gameChip(g, href)).join("")}</div>`;

  /* the moving strip: compact mini-tickets gliding past on their own (hover or the button pauses it) */
  function miniTicket(p) {
    const P = D.props[p.prop];
    const now = p.best_price != null ? `<span class="m-now ${p.best_ok ? "ok" : "pass"}">now ${odds(p.best_price)} ${esc(p.best_book)}</span>` : "";
    const when = p.state === "open" && p.kick_utc ? `<span class="countdown" data-kick="${p.kick_utc}" data-short="1">${esc(p.kick)}</span>` : `<span class="live"><i></i>Live</span>`;
    return `<a class="mt" href="${linkTo(p)}" style="${band(p)}" aria-label="${esc(p.player)} ${p.side} ${p.line}">
      <span class="m-top"><span class="gteams">${gameLabel(p)}</span>${when}</span>
      <span class="m-player">${esc(p.player)}</span>
      <span class="m-pick"><b>${p.side} ${p.line}</b> ${odds(p.price)} <small>${esc(p.book)}</small></span>
      <span class="m-foot">${sharpChip(p.sharp)}${P.paper ? `<span class="chip paper">paper</span>` : `<span class="m-stake">${num(p.units, 1)}u</span>`}${now}</span>
    </a>`;
  }
  function marquee(list) {
    const cards = list.map(miniTicket).join("");
    const secs = Math.max(24, list.length * 5);               // ~5 s per ticket on screen, whatever the count
    return `<div class="marquee" id="marquee" style="--dur:${secs}s" aria-label="Open picks, moving">
      <div class="mtrack">${cards}<span class="mgap"></span>${cards.replace(/<a class="mt"/g, '<a tabindex="-1" aria-hidden="true" class="mt"')}<span class="mgap"></span></div>
    </div>`;
  }
  function initMarquee() {
    const m = $("marquee"), b = $("mtoggle");
    if (!m) return;
    b.onclick = () => { const on = m.classList.toggle("paused"); b.textContent = on ? "Play" : "Pause"; b.setAttribute("aria-pressed", String(on)); };
  }

  /* motion: tickets glide in as they scroll into view; scoreboard numbers count up once */
  function reveal() {
    const items = document.querySelectorAll(".ticket:not(.in), .clvcard:not(.in), .chart:not(.in), .way:not(.in)");
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -6% 0px" });
    items.forEach((el, i) => { el.style.setProperty("--i", i % 6); el.classList.add("rv"); io.observe(el); });
  }
  function countUp() {
    document.querySelectorAll(".tote b, .clvgrid b").forEach((el) => {
      const m = el.textContent.match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/);
      if (!m || el.dataset.done || /^-\d/.test(m[3])) return;          // not records like "4-3"
      el.dataset.done = "1";
      const [, sign, n, rest] = m, target = parseFloat(n), dec = (n.split(".")[1] || "").length, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        el.textContent = `${sign}${(target * e).toFixed(dec)}${rest}`; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  const afterDraw = () => { reveal(); countdowns(); };

  document.querySelectorAll(".tabs a").forEach((a) => { if (a.dataset.tab === page) a.setAttribute("aria-current", "page"); });

  /* sticky bar: a shadow once the page scrolls; on phones the tabs fold into a menu button */
  const navbar = $("navbar"), burger = $("burger");
  const onScroll = () => navbar.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const setMenu = (open) => { navbar.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open)); };
  burger.addEventListener("click", (e) => { e.stopPropagation(); setMenu(!navbar.classList.contains("open")); });
  document.addEventListener("click", (e) => { if (!navbar.contains(e.target)) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  $("tabs").addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  $("updated").textContent = `Last updated ${D.updated} ET.`;

  /* light / dark switch (remembered on this device) */
  $("theme").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("ll-theme", root.dataset.theme); } catch (e) {}
  });

  /* kickoff countdowns on open tickets */
  function countdowns() {
    document.querySelectorAll("[data-kick]").forEach((el) => {
      const ms = new Date(el.dataset.kick) - Date.now();
      if (ms <= 0) { el.textContent = "kicked off"; return; }
      const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
      el.textContent = `${el.dataset.short ? "in" : "kicks off in"} ${d ? d + "d " + h + "h" : h ? h + "h " + (m % 60) + "m" : (m % 60) + "m"}`;
    });
  }
  setInterval(countdowns, 30000);

  /* share a ticket: link to its page, season and week, scrolled to it */
  const pageOf = (p) => p.prop === "receptions" ? "receptions.html" : "passing.html";
  const linkTo = (p) => new URL(`${pageOf(p)}?season=${p.season}&week=${p.week}#${p.serial}`, location.href).href;
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button.share");
    if (!b) return;
    const p = allPicksById[b.dataset.serial];
    const url = linkTo(p), text = `${p.player} ${p.side} ${p.line} (${p.price > 0 ? "+" : ""}${p.price}) - Line Ledger`;
    try {
      if (navigator.share) await navigator.share({ title: text, url });
      else { await navigator.clipboard.writeText(url); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Share"), 1600); }
    } catch (err) {}
  });
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (!el) return;
    el.closest("details")?.setAttribute("open", "");
    el.scrollIntoView({ block: "center" });
    el.classList.add("hit");
  }

  /* ------------------------------------------------------------------ season / week picker */
  const allPicks = PROPS.flatMap((k) => D.props[k].picks);
  const allPicksById = Object.fromEntries(allPicks.map((p) => [p.serial, p]));
  // open = not graded yet (before kickoff, or being played / waiting for official stats), soonest kickoff first,
  // the record's prop before the paper desk
  const openPicks = allPicks.filter((p) => !p.result)
    .sort((a, b) => (a.kick_utc || "").localeCompare(b.kick_utc || "") || (a.prop === "passing_yards" ? -1 : 1) - (b.prop === "passing_yards" ? -1 : 1));
  if (openPicks.length) { for (const id of ["open-count", "burger-count"]) { const b = $(id); b.textContent = openPicks.length; b.hidden = false; } }
  const seasons = [...new Set(allPicks.map((p) => p.season))].sort((a, b) => b - a);
  const weeksOf = (season, picks = allPicks) => [...new Set(picks.filter((p) => p.season === season).map((p) => p.week))].sort((a, b) => b - a);
  const qs = new URLSearchParams(location.search);
  const state = {
    season: Number(qs.get("season")) || D.season,
    week: qs.get("week") === "all" ? "all" : Number(qs.get("week")) || null,
  };
  function pickers(picks, allowAll) {
    if (!seasons.length) return "";
    const wks = weeksOf(state.season, picks);
    if (state.week !== "all" && !wks.includes(state.week)) state.week = allowAll ? "all" : wks[0] ?? null;
    return `<div class="pickers">
      <label><span>Season</span><select id="pk-season">${seasons.map((s) => `<option value="${s}"${s === state.season ? " selected" : ""}>${s}</option>`).join("")}</select></label>
      <label><span>Week</span><select id="pk-week">${allowAll ? `<option value="all"${state.week === "all" ? " selected" : ""}>All weeks</option>` : ""}${wks.map((w) => `<option value="${w}"${w === state.week ? " selected" : ""}>Week ${w}</option>`).join("")}</select></label>
    </div>`;
  }
  function wirePickers(redraw) {
    const s = $("pk-season"), w = $("pk-week");
    if (!s) return;
    const sync = () => {
      const u = new URL(location.href);
      u.searchParams.set("season", state.season); u.searchParams.set("week", state.week);
      history.replaceState(null, "", u);
    };
    s.addEventListener("change", () => { state.season = Number(s.value); state.week = null; redraw(); sync(); });
    w.addEventListener("change", () => { state.week = w.value === "all" ? "all" : Number(w.value); redraw(); sync(); });
  }

  /* ------------------------------------------------------------------ a ticket */
  function barcode(serial) {
    let x = 0, h = 7;
    const stops = [];
    for (const ch of serial + serial) {
      h = (h * 31 + ch.charCodeAt(0)) % 997;
      const bar = 1 + (h % 3), gap = 1 + ((h >> 2) % 2);
      stops.push(`var(--ink) ${x}px ${x + bar}px`, `transparent ${x + bar}px ${x + bar + gap}px`);
      x += bar + gap;
    }
    return `<span class="barcode" aria-hidden="true" style="width:${x}px;background:linear-gradient(90deg,${stops.join(",")})"></span>`;
  }

  const kickSpan = (p) => p.state !== "open" ? `<span>close locked &middot; posts after the game</span>`
    : p.kick_utc ? `<span class="countdown" data-kick="${p.kick_utc}">closes at kickoff</span>` : `<span>closes at kickoff</span>`;
  const abbr = (b) => ({ DraftKings: "DK", FanDuel: "FD", Pinnacle: "PIN" }[b] || b || "");
  // for the bettor of this pick, is `price` better (+1), worse (-1) or the same (0) than what the pick got?
  const priceDir = (pick, other) => { const dec = (a) => a > 0 ? 1 + a / 100 : 1 + 100 / -a; const x = dec(other) - dec(pick); return Math.abs(x) < 1e-9 ? 0 : x > 0 ? 1 : -1; };
  // a slim movement bar: fills from the centre tick, green toward the pick, red against (w = 0..50 % of the track)
  const bar = (dir, w) => `<span class="bar" aria-hidden="true">${dir > 0 ? `<i class="up" style="left:50%;width:${w}%"></i>`
    : dir < 0 ? `<i class="down" style="left:${50 - w}%;width:${w}%"></i>` : ""}</span>`;
  const implied = (a) => a > 0 ? 100 / (a + 100) : -a / (-a + 100);           // price -> win chance the book charges for
  function compare(p, unit) {
    // the pick against the close (after kickoff) or the best price available now (before): a LINE bar and a PRICE bar
    let label, line, price, book, note = "";
    if (p.closed && p.now != null) {
      label = "Close"; line = p.now; price = p.close_price; book = p.close_book;
    } else if (p.state === "open" && p.best_price != null) {
      label = "Now"; line = p.best_line; price = p.best_price; book = p.best_book; note = p.best_verdict || "";
    } else if (p.now != null) {
      label = p.closed ? "Close" : "Now"; line = p.now; price = p.close_price; book = p.close_book;
    }
    if (!label) {
      return `<div class="mv"><span></span><small>Pick</small><span></span><small></small>
        <span class="lbl">Line</span><b>${p.line}</b>${bar(0, 0)}<b class="muted">&ndash;</b>
        <span class="lbl">Price</span><b>${odds(p.price)}</b>${bar(0, 0)}<b class="muted">&ndash;</b></div>
        <div class="clv-f"><span>${p.result ? "no closing line" : `no newer line yet &middot; ${esc(abbr(p.book))}`}</span>${p.result ? "" : kickSpan(p)}</div>`;
    }
    const mv = (line - p.line) * (p.side === "OVER" ? 1 : -1);                 // + = the line moved toward the pick
    const lineW = Math.min(50, Math.abs(mv) * (p.prop === "receptions" ? 50 : 4));
    // price: compared at the same line only (another line's price isn't the same bet); + = the bet got pricier after you
    const same = line === p.line && price != null;
    const pts = same ? 100 * (implied(price) - implied(p.price)) : 0;          // win-chance points the market moved
    const priceW = Math.min(50, Math.abs(pts) * 6);
    const pdir = Math.abs(pts) < 0.05 ? 0 : pts > 0 ? 1 : -1;
    const what = mv > 0 ? `line moved ${sgn(mv)}${mv.toFixed(1)} ${unit} your way` : mv < 0 ? `line moved ${Math.abs(mv).toFixed(1)} ${unit} against you`
      : pdir > 0 ? "price moved your way" : pdir < 0 ? "price moved against you" : "no movement";
    const books = `${abbr(p.book)}${abbr(book) && abbr(book) !== abbr(p.book) ? ` &rarr; ${abbr(book)}` : ""}`;
    const verdict = note ? ` &middot; <b class="${p.best_ok ? "up" : "down"}">${p.best_ok ? (note.startsWith("better") ? "better than the pick" : "still playable") : "pass"}</b>` : "";
    const foot = p.closed ? `<span>Beat the close: <b class="${p.beat ? "up" : "down"}">${p.beat ? "yes" : "no"}</b> &middot; ${what}</span><span class="bk">${books}</span>`
      : `<span>${what}${verdict}</span>${kickSpan(p)}`;
    return `<div class="mv"><span></span><small>Pick</small><span></span><small>${label}</small>
        <span class="lbl">Line</span><b>${p.line}</b>${bar(mv > 0 ? 1 : mv < 0 ? -1 : 0, lineW)}<b class="${tone(mv)}">${line}</b>
        <span class="lbl">Price</span><b>${odds(p.price)}</b>${bar(pdir, priceW)}<b class="${same ? (pdir > 0 ? "up" : pdir < 0 ? "down" : "") : "muted"}">${price == null ? "&ndash;" : odds(price)}</b>
      </div>
      <div class="clv-f">${foot}</div>${!p.closed ? `<div class="clv-b">${books}${p.best_at ? ` &middot; checked ${esc(p.best_at)}` : ""}</div>` : ""}`;
  }

  function details(p, P) {
    const rows = [];
    if (p.quotes && p.quotes.length) rows.push(["Lines when stamped", p.quotes.map((q) => `${esc(q.book)} ${q.line} ${odds(q.over)}/${odds(q.under)}`).join("<br>")]);
    if (p.sharp_line != null) rows.push(["Pinnacle when stamped", `${p.sharp_line} ${odds(p.sharp_over)}/${odds(p.sharp_under)}`]);
    if (p.market != null) rows.push(["Market's number", `${num(p.market, P.dec)} <span class="muted">vs model ${num(p.model, P.dec)}</span>`]);
    if (p.playable_to != null) rows.push(["Playable to", `${odds(p.playable_to)} <span class="muted">at ${p.line}: the worst price that still clears the ${D.min_ev ?? 2}% value bar</span>`]);
    rows.push(["Kickoff", `${esc(p.kick)} ET`]);
    if (p.closed && p.clv != null) rows.push(["Closing line", `${p.now} ${p.close_price != null ? odds(p.close_price) : ""} ${esc(p.close_book || "")} <span class="muted">(${sgn(p.clv)}${p.clv.toFixed(1)} ${P.unit})</span>`]);
    if (!p.closed && p.best_at) rows.push(["\"Now\" checked", `${esc(p.best_at)} ET`]);
    return `<details class="drawer"><summary>Ticket details</summary><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></details>`;
  }

  // open picks: has the market moved toward the pick (line first, else price at the same line)?
  function moveWord(p, mv) {
    const nowLine = p.best_price != null ? p.best_line : p.now, nowPrice = p.best_price != null ? p.best_price : p.close_price;
    if (nowLine == null) return `<b class="muted">&ndash;</b>`;
    const m = (nowLine - p.line) * (p.side === "OVER" ? 1 : -1);
    const d = m !== 0 ? m : nowPrice == null ? 0 : -priceDir(p.price, nowPrice);
    return `<b class="${d > 0 ? "up" : d < 0 ? "down" : "muted"}">${d > 0 ? "Your way" : d < 0 ? "Against" : "No change"}</b>`;
  }

  function ticket(p) {
    const P = D.props[p.prop];
    const mv = p.now == null ? null : (p.now - p.line) * (p.side === "OVER" ? 1 : -1);
    const head = p.closed
      ? `<small>Closing line value</small><b class="${tone(p.clv_ev)}">${pct(p.clv_ev)}</b>`
      : p.state !== "open" ? `<small>Closing line value</small><b class="muted">pending</b>`
      : `<small>Since the pick</small>${moveWord(p, mv)}`;
    const won = p.result === "W" ? "up" : p.result === "L" ? "down" : "";
    const final = p.result && p.result !== "VOID" && p.actual != null
      ? `<div class="final ${won}">Final <b>${p.actual} ${P.unit}</b> &middot; ${p.margin ? `${Math.abs(p.margin).toFixed(1)} ${p.margin > 0 ? "over" : "under"} the line` : "right on the line"}</div>`
      : p.result === "VOID" ? `<div class="final">Didn't play &middot; bet refunded</div>` : "";
    return `<article class="ticket${p.result ? " graded" : ""}" id="${esc(p.serial)}" style="${band(p)}">
      <div class="t-top">
        <div class="t-meta"><span class="t-game">${gameLabel(p)}<span>${esc(p.kick)}</span></span>${sharpChip(p.sharp, p.sharp_close)}</div>
        <div class="t-player">${esc(p.player)}</div>
        <div class="t-pick"><span><b>${p.side} ${p.line}</b><small>${odds(p.price)} ${esc(p.book)}</small></span>
          ${p.result ? "" : `<span class="res ${p.state}">${p.state === "open" ? "OPEN" : "IN PLAY"}</span>`}</div>
        ${!p.result && p.state === "open" && p.playable_to != null ? `<div class="final">Playable to <b>${odds(p.playable_to)}</b></div>` : ""}
        ${final}
        ${p.result ? `<div class="seal ${p.result}" aria-label="${SEAL[p.result]}">${SEAL[p.result]}</div>` : ""}
      </div>
      <div class="clv"><div class="clv-h">${head}</div>${compare(p, P.unit)}</div>
      <div class="stats">
        <span>Model<b>${num(p.model, P.dec)}</b></span><span>Win<b>${pct(p.win, false)}</b></span>
        <span>EV<b>${pct(p.ev)}</b></span><span>Stake<b>${num(p.units, 1)}u</b></span>
      </div>
      ${details(p, P)}
      <div class="stub">
        <div><span class="serial">No. ${esc(p.serial)}</span><span class="when">Stamped ${esc(p.stamped)} ET</span></div>
        <div class="stub-r">${p.pre ? `<span class="chip pre">pre-launch</span>` : P.paper ? `<span class="chip paper">paper</span>` : ""}<button type="button" class="share" data-serial="${esc(p.serial)}" aria-label="Share this pick">Share</button>${barcode(p.serial)}</div>
      </div>
    </article>`;
  }
  const tickets = (ps) => ps.length ? `<div class="tickets">${ps.map(ticket).join("")}</div>` : "";

  /* ------------------------------------------------------------------ scoreboards */
  function tote(rec, P, compact) {
    const r = rec[0] || { n: 0 };
    const cells = [
      ["key", `<b class="${tone(r.clv_ev)}">${pct(r.clv_ev)}</b>`, "value vs close"],
      ["", `<b>${r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%"}</b>`, "beat the close"],
      ["", `<b>${wl(r)}</b>`, P.paper ? "paper record" : "record"],
      ["", `<b class="${tone(r.units)}">${r.n ? num(r.units, 2, true) + "u" : "&ndash;"}</b>`, "units"],
    ];
    return `<div class="tote${compact ? " compact" : ""}">${cells.map(([c, b, s]) => `<div class="${c}">${b}<span>${s}</span></div>`).join("")}</div>`;
  }
  const scoreboard = () => `<div class="boards">${PROPS.map((k) => {
    const P = D.props[k];
    return `<a class="sb" href="${k === "passing_yards" ? "passing" : "receptions"}.html"><div class="sb-h"><span>${esc(P.label)}</span>${P.paper ? `<span class="chip paper">paper</span>` : `<span class="chip rec">the record</span>`}</div>${tote(P.record, P, true)}</a>`;
  }).join("")}</div>`;

  function recordTable(rows) {
    if (!rows.length) return `<div class="empty">No graded picks yet.</div>`;
    return `<div class="tablebox"><table>
      <thead><tr><th>Picks</th><th class="num opt">Graded</th><th class="num">W-L-P</th><th class="num opt">Win %</th><th class="num">Units</th><th class="num opt">ROI</th><th class="num key">Value vs close</th><th class="num opt">Beat close</th></tr></thead>
      <tbody>${rows.map((x, i) => `<tr class="${x.sub ? "sub" : i === 0 ? "top" : ""}">
        <td>${esc(x.label)}</td><td class="num opt">${x.n}${x.pending ? ` <span class="note">+${x.pending}</span>` : ""}</td>
        <td class="num">${wl(x)}</td><td class="num opt">${x.n ? pct(x.win, false) : "&ndash;"}</td>
        <td class="num ${tone(x.units)}">${x.n ? num(x.units, 2, true) : "&ndash;"}</td><td class="num opt ${tone(x.roi)}">${pct(x.roi)}</td>
        <td class="num key ${tone(x.clv_ev)}">${pct(x.clv_ev)}</td><td class="num opt">${x.beat == null ? "&ndash;" : x.beat.toFixed(0) + "%"}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  /* units over time: cumulative flat-unit result of graded picks, in the order they were stamped */
  function chart(P) {
    const g = P.picks.filter((p) => p.pl != null).sort((a, b) => a.serial < b.serial ? -1 : 1);
    if (g.length < 3) return "";
    let run = 0;
    const pts = [0, ...g.map((p) => (run += p.pl))];
    const W = 640, H = 170, pad = 8, lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
    const x = (i) => pad + (i / (pts.length - 1)) * (W - 2 * pad), y = (v) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
    const path = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const last = pts[pts.length - 1];
    return `<figure class="chart"><figcaption><span>Units over time <span class="muted">(${g.length} graded, flat 1u)</span></span><b class="${tone(last)}">${num(last, 2, true)}u</b></figcaption>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Cumulative units: ${num(last, 2, true)} after ${g.length} graded picks">
        <line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" class="zero"/>
        <path d="${path}" class="${last >= 0 ? "upl" : "downl"}" vector-effect="non-scaling-stroke"/>
      </svg></figure>`;
  }

  /* a line chart of any series (index -> value) with a dashed zero line */
  function lineChart(vals, caption, last, fmt) {
    if (vals.length < 3) return "";
    const W = 640, H = 170, pad = 8, lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
    const x = (i) => pad + (i / (vals.length - 1)) * (W - 2 * pad), y = (v) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
    const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return `<figure class="chart"><figcaption><span>${caption}</span><b class="${tone(last)}">${fmt(last)}</b></figcaption>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${caption.replace(/<[^>]+>/g, "")}: ${fmt(last)}">
        <line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" class="zero"/>
        <path d="${path}" class="${last >= 0 ? "upl" : "downl"}" vector-effect="non-scaling-stroke"/>
      </svg></figure>`;
  }

  /* open picks: everything not graded yet, one group per game, soonest kickoff first */
  function openBoard(list = openPicks) {
    if (!list.length) return `<div class="empty">No open picks right now. New picks usually go up Wednesday or Thursday, once the books post lines and the model finds value.</div>`;
    return gamesOf(list).map((g) => `<div class="weekgroup gamegroup" id="g-${esc(g.id)}"><div class="weekhead">
        <h3 class="gteams">${tm(g.away)}<i class="at">@</i>${tm(g.home)}</h3>
        <span class="mono">${gameWhen(g)} &middot; ${g.picks.length} open</span></div>${tickets(g.picks)}</div>`).join("");
  }

  function weekHead(P, season, w) {
    const r = P.weeks[`${season}-${w}`];
    const bits = r && r.n ? [`<b>${wl(r)}</b>`, `<b class="${tone(r.units)}">${num(r.units, 2, true)}u</b>`,
      `vs close <b class="${tone(r.clv_ev)}">${pct(r.clv_ev)}</b>`] : [r && r.pending ? `${r.pending} open` : "no picks graded yet"];
    return `<div class="weekhead"><h3>Week ${w} <span class="muted">${season}</span></h3><span class="mono">${bits.join(" &middot; ")}</span></div>`;
  }

  function notify() {
    const feed = `${D.site_url || ""}feed.xml`;
    return `<section class="notify"><div><div class="eyebrow">Never miss a pick</div><h2>Get alerts</h2></div>
      <div class="ways">
        ${D.discord ? `<a class="way" href="${esc(D.discord)}"><b>Discord</b><span>Join the picks channel and turn on notifications: your phone buzzes the moment a pick is posted.</span></a>` : ""}
        <a class="way" href="feed.xml"><b>RSS feed</b><span>Add <span class="mono">${esc(feed)}</span> to any feed reader app (Feedly, Inoreader) and switch on alerts for new items.</span></a>
      </div></section>`;
  }

  /* ------------------------------------------------------------------ pages */
  function hero(eyebrow, title, text, extra = "") {
    $("hero").innerHTML = `<div class="hero"><div class="eyebrow" style="color:#aeb9cc">${eyebrow}</div><h1>${title}</h1><p>${text}</p></div>${extra}`;
  }

  function home() {
    hero(`NFL player props &middot; ${D.season}`, "Every pick stamped. <em>Every result kept.</em>",
      "Player props priced against DraftKings and FanDuel, posted before kickoff and graded against the closing line. Nothing is edited or removed.",
      scoreboard());
    const P = D.props.passing_yards, R = D.props.receptions;
    const order = { agrees: 0, neutral: 1, "no line": 2, against: 3 };
    const draw = () => {
      const nOpen = openPicks.length, firstN = 3;
      $("app").innerHTML = `
        ${nOpen ? `<section class="openstrip"><div class="head"><div><div class="eyebrow">Live &middot; not graded yet</div><h2>Open now <span class="count">${nOpen}</span></h2></div>
          <span class="headbtns">${nOpen >= firstN ? `<button type="button" class="mtoggle" id="mtoggle" aria-pressed="false" aria-label="Pause the moving picks">Pause</button>` : ""}<a class="more" href="open.html">All open picks &rarr;</a></span></div>
          ${gameStrip(openPicks, "open.html")}
          ${nOpen >= firstN ? marquee(openPicks) : `<div class="minis-row">${openPicks.map(miniTicket).join("")}</div>`}</section>` : ""}
        <div class="pickbar">${pickers(allPicks, false)}</div>
        ${board()}
        ${notify()}
        <section><div class="head"><div><div class="eyebrow">Why closing line value</div><h2>Judge us by the close</h2></div></div>
          <p class="lede">Win-loss swings with luck for hundreds of bets. The closing line is the market's sharpest price; consistently getting a better number than it is the clearest sign of a real edge. Every ticket shows where the line went after the pick and what the pick was worth against the close.</p>
          <a class="more" href="method.html">How we grade &rarr;</a></section>`;
      wirePickers(draw);
      initMarquee();
      afterDraw();
    };
    function board() {
      const wk = (X) => X ? X.picks.filter((p) => p.season === state.season && p.week === state.week) : [];
      const wp = wk(P), wr = wk(R);
      const topR = [...wr].sort((a, b) => (order[a.sharp] ?? 4) - (order[b.sharp] ?? 4) || (b.ev ?? 0) - (a.ev ?? 0)).slice(0, 6);
      return `
        <section><div class="head"><div><div class="eyebrow">Week ${state.week ?? "-"}, ${state.season} &middot; the record</div><h2>QB passing yards</h2></div>
          ${P ? weekHead(P, state.season, state.week).replace('class="weekhead"', 'class="weekhead slim"') : ""}</div>
          ${wp.length ? tickets(wp) : `<div class="empty">No passing-yards picks posted for this week yet. Picks go up when the books post lines and the model finds value, usually Wednesday or Thursday.</div>`}
          <a class="more" href="passing.html">Full record and every pick &rarr;</a></section>
        ${R ? `<section><div class="head"><div><div class="eyebrow">Week ${state.week ?? "-"}, ${state.season} &middot; ${R.paper ? "research desk, not part of the record" : "live since week 7"}</div><h2>Receptions</h2></div>
          ${weekHead(R, state.season, state.week).replace('class="weekhead"', 'class="weekhead slim"')}</div>
          ${wr.length ? `<p class="lede">${wr.length} ${R.paper ? "paper " : ""}picks this week. Shown: the six Pinnacle agrees with most.</p>${tickets(topR)}` : `<div class="empty">No receptions picks for this week yet.</div>`}
          <a class="more" href="receptions.html?season=${state.season}&week=${state.week}">All ${wr.length} receptions picks &rarr;</a></section>` : ""}`;
    }
    if (state.week == null || state.week === "all") state.week = D.week;
    draw();
  }

  function propPage(key) {
    const P = D.props[key];
    if (!P) { $("app").innerHTML = `<div class="empty">Nothing here yet.</div>`; return; }
    hero(`${P.paper ? "Research desk &middot; paper picks" : "The record"} &middot; since ${D.since}`, P.label, P.blurb, tote(P.record, P));
    const linked = allPicksById[decodeURIComponent(location.hash.slice(1))];
    if (linked && linked.prop === key) { state.season = linked.season; state.week = linked.week; }
    if (state.week == null) state.week = "all";
    const filters = [
      ["all", "All", () => true], ["open", "Open", (p) => !p.result], ["W", "Won", (p) => p.result === "W"], ["L", "Lost", (p) => p.result === "L"],
      ["agrees", "Sharp agrees", (p) => p.sharp === "agrees"], ["against", "Sharp against", (p) => p.sharp === "against"],
    ];
    let active = "all";
    const inScope = () => P.picks.filter((p) => p.season === state.season && (state.week === "all" || p.week === state.week));
    const draw = () => {
      const scope = inScope();
      const f = filters.find((x) => x[0] === active)[2];
      const shown = scope.filter(f);
      const weeks = [...new Set(shown.map((p) => p.week))].sort((a, b) => b - a);
      $("chips").innerHTML = filters.filter(([k, , g]) => k === "all" || scope.some(g)).map(([k, label, g]) =>
        `<button type="button" data-k="${k}" aria-pressed="${k === active}">${label}<span>${scope.filter(g).length}</span></button>`).join("");
      $("chips").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { active = b.dataset.k; draw(); }));
      $("picks").innerHTML = weeks.length ? weeks.map((w) => `<div class="weekgroup">${weekHead(P, state.season, w)}${tickets(shown.filter((p) => p.week === w))}</div>`).join("")
        : `<div class="empty">No picks match.</div>`;
      afterDraw();
    };
    $("app").innerHTML = `
      <section><div class="head"><div><div class="eyebrow">Graded flat, 1 unit per pick &middot; all seasons</div><h2>Record</h2></div></div>
        ${recordTable(P.record)}
        ${chart(P)}
        ${P.record.some((r) => r.label === "Pre-launch") ? `<p class="note"><span class="chip pre">pre-launch</span> picks (week 6) were made by the same model and time-stamped in our private ledger, but not posted publicly before kickoff. From ${esc(D.launch)} on, every pick is posted before kickoff.</p>` : ""}</section>
      <section><div class="head"><div><div class="eyebrow">Newest first</div><h2>Every pick</h2></div><div id="pk">${pickers(P.picks, true)}</div></div>
        <div class="filters" id="chips" role="group" aria-label="Filter picks"></div>
        <div id="picks" class="weekgroups"></div></section>`;
    function repick() { $("pk").innerHTML = pickers(P.picks, true); wirePickers(repick); active = "all"; draw(); }
    wirePickers(repick);
    draw();
    revealHash();
  }

  function method() {
    hero("How it works", "Stamped, posted, <em>graded at the close.</em>", "What every number on this site means, and why the closing line is the scoreboard.");
    $("app").innerHTML = `
      <section><div class="steps">
        <div><h3>Stamp</h3><p>The model prices every player the books post. When it finds value, the pick, line and price are stamped and frozen, with a serial number. Later runs never change them, and nothing is ever removed.</p></div>
        <div><h3>Post</h3><p>Picks go up before kickoff. Every update to this site is a public commit, so anyone can check when a pick was posted in the site's history on GitHub.</p></div>
        <div><h3>Grade</h3><p>After the game the result comes from official stats, and the pick's line and price are compared with the closing market, win or lose.</p></div>
      </div></section>
      <section><div><div class="eyebrow">The scoreboard</div><h2>Closing line value</h2></div>
        <dl class="defs">
          <dt>Value vs close</dt><dd>What the pick was worth against the closing market, with the bookmaker's cut removed. A pick at exactly the closing line at -110 scores about -4.5%; above 0% means beating the close by more than the cut. Over a few hundred picks, this is the most reliable sign of a real edge, far more than win rate.</dd>
          <dt>Beat the close</dt><dd>The pick got a better line than the close, or the same line at a better price. A pick can beat the close on the line and still score below 0% on value, if its price was worse than the closing price.</dd>
          <dt>Line moved</dt><dd>How far the line moved from the pick to the close (or to now, before kickoff). Green means toward the pick: the market came to us.</dd>
          <dt>Now</dt><dd>When the price has changed since a pick was stamped, open tickets show the price available at our last check, on the pick's own line, and whether it is better than the pick, still playable (at or above "playable to"), or no longer worth betting. The pick is still graded at its stamped price.</dd>
          <dt>Playable to</dt><dd>The worst price at the stamped line where the pick still clears our value bar (expected value of at least ${D.min_ev ?? 2}%). If your book offers the same line at that price or better, the pick still holds; worse than that, pass.</dd>
          <dt>Units</dt><dd>The record is graded flat, 1 unit per pick at the price stamped, so one big bet can't flatter the numbers. The stake on each ticket is a suggestion in units, where 1u = 1% of a bankroll (quarter-Kelly, capped at 2u).</dd>
          <dt>Ticket details</dt><dd>Tap a ticket's details to see every book's line when the pick was stamped, Pinnacle's line at the same moment, and the market's own number next to the model's.</dd>
        </dl></section>
      <section><div><div class="eyebrow">Model + sharp money</div><h2>The Sharp label</h2></div>
        <p class="lede">Pinnacle is the sharpest sportsbook: it takes large bets from professionals and moves fast. For every pick we read Pinnacle's line for the same player and ask which side its prices favour at our line. The label stays current until kickoff, then locks on Pinnacle's closing line (marked "close"): did the sharp money finish on our side?</p>
        <dl class="defs">
          <dt>Sharp agrees</dt><dd>Pinnacle priced our side as the likelier winner. The model and sharp money lean the same way.</dd>
          <dt>Sharp neutral</dt><dd>Pinnacle had it a coin flip at our line.</dd>
          <dt>Sharp against</dt><dd>Pinnacle priced the other side as the likelier winner.</dd>
          <dt>No sharp line</dt><dd>Pinnacle didn't list the player.</dd>
        </dl>
        <p class="callout">Whether "sharp agrees" picks really do better is an open question. The record pages split every result by this label so it can be answered in the open.</p></section>
      ${notify()}
      <section><div><div class="eyebrow">Honesty notes</div><h2>What's on the record</h2></div>
        <dl class="defs">
          <dt>QB passing yards</dt><dd>The record. Every pick the model recommends, from ${esc(D.since)} on.</dd>
          <dt>Receptions</dt><dd>${esc(D.props.receptions ? D.props.receptions.blurb : "")}</dd>
          <dt>Pre-launch</dt><dd>Week 6 picks were made before this site went public (${esc(D.launch)}). They are shown and counted, tagged pre-launch, because their time stamps come from our private ledger and can't be checked here.</dd>
        </dl></section>`;
  }

  function openPage() {
    const nP = openPicks.filter((p) => p.prop === "passing_yards").length, nR = openPicks.length - nP;
    hero("Live &middot; not graded yet", `Open now <em>${openPicks.length}</em>`,
      openPicks.length ? `${nP} QB passing-yards pick${nP === 1 ? "" : "s"}${nR ? ` and ${nR} receptions paper pick${nR === 1 ? "" : "s"}` : ""} still to be settled, soonest kickoff first. Before kickoff each ticket shows where the line has gone since the pick; once the game starts, the closing line is locked in.`
        : "Nothing open right now.");
    const kinds = [["all", "All", () => true], ["passing_yards", "QB passing yards", (p) => p.prop === "passing_yards"],
      ["receptions", "Receptions (paper)", (p) => p.prop === "receptions"], ["pre", "Before kickoff", (p) => p.state === "open"],
      ["live", "In play", (p) => p.state !== "open"]].filter(([k, , f]) => k === "all" || openPicks.some(f));
    let active = "all";
    const draw = () => {
      const f = kinds.find((k) => k[0] === active)[2];
      $("chips").innerHTML = kinds.map(([k, label, g]) => `<button type="button" data-k="${k}" aria-pressed="${k === active}">${label}<span>${openPicks.filter(g).length}</span></button>`).join("");
      $("chips").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { active = b.dataset.k; draw(); }));
      $("list").innerHTML = openBoard(openPicks.filter(f));
      afterDraw();
    };
    $("app").innerHTML = `<section>${openPicks.length ? `${gameStrip(openPicks, "")}<div class="filters" id="chips" role="group" aria-label="Filter open picks"></div>` : ""}<div id="list" class="weekgroups">${openBoard()}</div></section>`;
    if (openPicks.length) draw();
    countdowns();
    revealHash();
  }

  function clvPage() {
    hero("The scoreboard", "Closing line <em>value</em>",
      "Did we get a better number than the market's final price? Over hundreds of picks, that is the clearest sign of a real edge, far more than win-loss. Here it is for every graded pick, nothing left out.");
    const cards = PROPS.map((k) => {
      const P = D.props[k], r = P.record[0] || {};
      const cells = [
        ["Value vs close", pct(r.clv_ev), tone(r.clv_ev), "what each pick was worth against the closing price, vig removed"],
        ["Beat the close", r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%", "", "better line, or same line at a better price"],
        ["Avg line move", r.clv == null ? "&ndash;" : `${sgn(r.clv)}${r.clv.toFixed(1)} ${P.unit}`, tone(r.clv), "from the pick to the close"],
        ["Moved our way", r.toward == null ? "&ndash;" : r.toward.toFixed(0) + "%", "", `of the ${r.n_moved || 0} lines that moved`],
      ];
      return `<article class="clvcard"><div class="sb-h2"><span>${esc(P.label)}</span>${P.paper ? `<span class="chip paper">paper</span>` : `<span class="chip pre">the record</span>`}</div>
        <div class="clvgrid">${cells.map(([h, v, c, s]) => `<div><small>${h}</small><b class="${c}">${v}</b><span>${s}</span></div>`).join("")}</div>
        <p class="note">${r.n_clv || 0} picks with a closing line${r.pending ? ` &middot; ${r.pending} still open` : ""}</p></article>`;
    }).join("");
    const charts = PROPS.map((k) => {
      const P = D.props[k];
      const g = P.picks.filter((p) => p.clv_ev != null).sort((a, b) => (a.serial < b.serial ? -1 : 1));
      let s = 0;
      const run = g.map((p, i) => (s += p.clv_ev) / (i + 1));
      return lineChart(run, `${esc(P.label)} <span class="muted">running value vs close, ${g.length} picks</span>`, run[run.length - 1], (v) => pct(v));
    }).join("");
    const byWeek = PROPS.flatMap((k) => Object.entries(D.props[k].weeks).map(([key, r]) => ({ k, key, r })))
      .sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }) || (a.k < b.k ? -1 : 1));
    const bySharp = PROPS.flatMap((k) => D.props[k].record.filter((r) => /^Sharp|^No sharp/.test(r.label)).map((r) => ({ k, r })));
    const row = (label, r, P) => `<tr><td>${label}</td><td class="num opt">${r.n_clv || 0}</td><td class="num key ${tone(r.clv_ev)}">${pct(r.clv_ev)}</td>
      <td class="num">${r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%"}</td><td class="num opt ${tone(r.clv)}">${r.clv == null ? "&ndash;" : sgn(r.clv) + r.clv.toFixed(1) + " " + P.unit}</td></tr>`;
    const table = (rows) => `<div class="tablebox"><table><thead><tr><th>Picks</th><th class="num opt">Closes</th><th class="num key">Value vs close</th><th class="num">Beat close</th><th class="num opt">Avg move</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const graded = allPicks.filter((p) => p.clv_ev != null).sort((a, b) => b.clv_ev - a.clv_ev);
    const mini = (p) => `<a class="mini" href="${pageOf(p)}?season=${p.season}&week=${p.week}#${p.serial}">
      <span><b>${esc(p.player)}</b> ${p.side} ${p.line} <span class="muted">${odds(p.price)} &middot; ${p.prop === "receptions" ? "rec" : "pass yds"} &middot; wk ${p.week}</span></span>
      <span class="mono ${tone(p.clv_ev)}">${pct(p.clv_ev)}</span></a>`;
    $("app").innerHTML = `
      <section><div class="clvcards">${cards}</div></section>
      ${charts ? `<section><div><div class="eyebrow">Is the edge holding?</div><h2>Over time</h2></div>
        <p class="lede">The running average of value vs close, pick by pick. Early on it swings; what matters is where it settles.</p><div class="charts">${charts}</div></section>` : ""}
      <section><div><div class="eyebrow">Week by week</div><h2>By week</h2></div>
        ${table(byWeek.map(({ k, key, r }) => row(`Week ${key.split("-")[1]} <span class="muted">${key.split("-")[0]} &middot; ${D.props[k].paper ? "receptions" : "pass yds"}</span>`, r, D.props[k])).join(""))}</section>
      ${bySharp.length ? `<section><div><div class="eyebrow">Model + sharp money</div><h2>By Sharp label</h2></div>
        <p class="lede">Do picks that Pinnacle agreed with get better closing value? This is where that question gets answered.</p>
        ${table(bySharp.map(({ k, r }) => row(`${esc(r.label)} <span class="muted">${D.props[k].paper ? "receptions" : "pass yds"}</span>`, r, D.props[k])).join(""))}</section>` : ""}
      ${graded.length ? `<section><div><div class="eyebrow">Tap one to see its ticket</div><h2>Best and worst closes</h2></div>
        <div class="minis"><div><h3>Best</h3>${graded.slice(0, 5).map(mini).join("")}</div><div><h3>Worst</h3>${graded.slice(-5).reverse().map(mini).join("")}</div></div></section>` : ""}
      <section><a class="more" href="method.html">How value vs close is worked out &rarr;</a></section>`;
  }

  setTimeout(() => { reveal(); countUp(); }, 0);
  if (page === "open") openPage();
  else if (page === "clv") clvPage();
  else if (page === "home") home();
  else if (page === "passing") propPage("passing_yards");
  else if (page === "receptions") propPage("receptions");
  else method();
})();
