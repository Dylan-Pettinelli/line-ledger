/* Line Ledger: renders every page from data.js (window.DATA, written by `python nfl.py publish`).
   Sport- and market-agnostic: tabs, pages and labels come from DATA.sports and DATA.markets, so another sport or
   market is a data change, not a code change. */
(function () {
  const D = window.DATA;
  const page = document.body.dataset.page;
  const pageMarket = document.body.dataset.market;
  const $ = (id) => document.getElementById(id);
  const SPORTS = D.sports && D.sports.length ? D.sports
    : [{ key: "nfl", name: "NFL", period: "Week", event: "kickoff", markets: Object.keys(D.props), files: { home: "index.html", open: "open.html", results: "results.html" } }];
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  // this page's sport; the shared pages (CLV, How it works) keep the sport you came from (?sport=, else the last one seen)
  const pageSport = document.body.dataset.sport;
  const SPORT = SPORTS.find((s) => s.key === (pageSport || new URLSearchParams(location.search).get("sport") || store.get("ll-sport"))) || SPORTS[0];
  if (pageSport) store.set("ll-sport", pageSport);
  const PERIOD = SPORT.period || "Week";
  const MK = (D.markets || Object.keys(D.props)).filter((k) => D.props[k] && (SPORT.markets || []).includes(k));
  const href = (file) => file === "index.html" ? "./" : file;
  const MKT = (k) => D.props[k];

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const odds = (p) => p == null ? "&ndash;" : (p > 0 ? "+" : "") + p;
  const sgn = (v) => (v > 0 ? "+" : "");
  const pct = (v, sign = true) => v == null ? "&ndash;" : (sign ? sgn(v) : "") + v.toFixed(1) + "%";
  const num = (v, d, sign) => v == null ? "&ndash;" : (sign ? sgn(v) : "") + v.toFixed(d);
  const tone = (v) => v == null || Math.abs(v) < 1e-9 ? "" : v > 0 ? "up" : "down";
  const wl = (r) => r && r.n ? `${r.W}-${r.L}${r.P ? "-" + r.P : ""}` : "0-0";
  const SHARP = { agrees: "Sharp agrees", against: "Sharp against", neutral: "Sharp neutral", "no line": "No sharp line" };
  const SEAL = { W: "Win", L: "Loss", P: "Push", VOID: "Void" };
  const sharpChip = (s, atClose) => s ? `<span class="chip ${s === "no line" ? "noline" : s}" title="Pinnacle's ${atClose ? "closing" : "latest"} line">${SHARP[s] || esc(s)}${atClose ? " &middot; close" : ""}</span>` : "";
  const abbr = (b) => ({ DraftKings: "DK", FanDuel: "FD", Pinnacle: "PIN" }[b] || b || "");

  /* team colors: badges and ticket bands (colors only - no logos) */
  const TEAMS = D.teams || {};
  const light = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150; };
  const tm = (code) => { const [c1, c2] = TEAMS[code] || ["#5b6880", "#d6dce6"];
    return `<span class="tm" style="--c1:${c1};--c2:${c2};color:${light(c1) ? "#101820" : "#fff"}">${esc(code)}</span>`; };
  const gameLabel = (p) => p.home ? `${tm(p.opp)}<i class="at">@</i>${tm(p.team)}` : `${tm(p.team)}<i class="at">@</i>${tm(p.opp)}`;
  const band = (p) => { const [c1, c2] = TEAMS[p.team] || ["#5b6880", "#d6dce6"]; return `--c1:${c1};--c2:${c2}`; };

  /* ------------------------------------------------------------------ all picks, and where each one lives */
  const allPicks = MK.flatMap((k) => MKT(k).picks);
  // the page was built at the last publish: a pick still "open" whose game has kicked off since is live now
  function syncPhases() {
    let moved = false;
    for (const p of allPicks) {
      if (p.phase === "open" && p.kick_utc && new Date(p.kick_utc) <= Date.now()) { p.phase = "live"; p.game_state = "In progress"; moved = true; }
    }
    return moved;
  }
  syncPhases();
  const byId = Object.fromEntries(allPicks.map((p) => [p.serial, p]));
  const pageOf = (p) => `${MKT(p.prop).slug}.html`;
  const linkTo = (p) => new URL(`${pageOf(p)}?season=${p.season}&week=${p.week}#${p.serial}`, location.href).href;
  const byKick = (a, b) => (a.kick_utc || "").localeCompare(b.kick_utc || "") || MK.indexOf(a.prop) - MK.indexOf(b.prop);
  const openNow = allPicks.filter((p) => p.phase !== "final").sort(byKick);
  const seasons = [...new Set(allPicks.map((p) => p.season))].sort((a, b) => b - a);
  const periodsOf = (season, picks = allPicks) => [...new Set(picks.filter((p) => p.season === season).map((p) => p.week))].sort((a, b) => b - a);

  /* ------------------------------------------------------------------ navigation (built from the markets) */
  // sport switcher first, then that sport's own tabs, then the pages every sport shares
  const F = SPORT.files || {};
  const sportTabs = (SPORT.markets || []).length
    ? [["home", href(F.home), `This ${PERIOD.toLowerCase()}`], ["open", F.open, "Open"], ["results", F.results, "Results"],
       ...MK.map((k) => [`m:${k}`, `${MKT(k).slug}.html`, MKT(k).short || MKT(k).label])]
    : [["soon", href(F.home), "Overview"]];
  const keep = SPORT === SPORTS[0] ? "" : `?sport=${SPORT.key}`;
  const tabs = [...sportTabs, ["clv", `clv.html${keep}`, "CLV"], ["method", `method.html${keep}`, "How it works"]];
  const here = page === "market" ? `m:${pageMarket}` : page;
  const sportSwitch = SPORTS.length < 2 ? "" : `<div class="sports" role="group" aria-label="Sport">${SPORTS.map((s) =>
    `<a href="${href(s.files.home)}"${s.key === SPORT.key ? ' aria-current="true"' : ""}>${esc(s.name)}${(s.markets || []).length ? "" : "<small>soon</small>"}</a>`).join("")}</div>`;
  $("tabs").innerHTML = sportSwitch + tabs.map(([id, link, label]) => `<a href="${link}"${id === here ? ' aria-current="page"' : ""}>${esc(label)}${id === "open" ? `<span class="badge" id="open-count" hidden></span>` : ""}</a>`).join("");
  if (openNow.length) for (const id of ["open-count", "burger-count"]) { const b = $(id); if (b) { b.textContent = openNow.length; b.hidden = false; } }
  const navbar = $("navbar"), burger = $("burger");
  const onScroll = () => navbar.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const setMenu = (open) => { navbar.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open)); };
  burger.addEventListener("click", (e) => { e.stopPropagation(); setMenu(!navbar.classList.contains("open")); });
  document.addEventListener("click", (e) => { if (!navbar.contains(e.target)) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  $("tabs").addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  $("updated").textContent = `Last updated ${D.updated} ET.`;
  $("theme").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark"; store.set("ll-theme", root.dataset.theme);
  });

  /* ------------------------------------------------------------------ install like an app */
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href))
    navigator.serviceWorker.register("sw.js").catch(() => {});
  let installEvt = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || (typeof navigator !== "undefined" && navigator.standalone);
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; const w = $("install"); if (w) w.querySelector("span").textContent = "Tap here to install Line Ledger on this device."; });
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("#install")) return;
    e.preventDefault();
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (err) {} installEvt = null; }
  });

  /* ------------------------------------------------------------------ shared state: period, view, search, market */
  const qs = new URLSearchParams(location.search);
  const state = { season: Number(qs.get("season")) || D.season, week: qs.get("week") === "all" ? "all" : Number(qs.get("week")) || null,
                  view: store.get("ll-view") || "compact", q: "", market: "all" };
  let redraw = () => {};
  const VIEWS = [["tickets", "Tickets"], ["compact", "Compact"], ["list", "List"]];
  const viewBar = () => `<div class="seg" role="group" aria-label="View">${VIEWS.map(([v, l]) => `<button type="button" data-view="${v}" aria-pressed="${state.view === v}">${l}</button>`).join("")}</div>`;
  const searchBox = () => `<label class="search"><span class="sr">Search</span><input type="search" id="q" placeholder="Search" value="${esc(state.q)}" autocomplete="off"></label>`;
  const marketSeg = () => MK.length < 2 ? "" : `<div class="seg" role="group" aria-label="Market">${[["all", "All"], ...MK.map((k) => [k, MKT(k).short || MKT(k).label])]
    .map(([k, l]) => `<button type="button" data-market="${k}" aria-pressed="${state.market === k}">${esc(l)}</button>`).join("")}</div>`;
  // filter chips (This week, Open): any chip on narrows the list; chips in the same group widen it again (Overs + Unders)
  const FILTERS = [["over", "Overs", "side", (p) => p.side === "OVER"], ["under", "Unders", "side", (p) => p.side === "UNDER"],
    ["dk", "DraftKings", "book", (p) => p.book === "DraftKings"], ["fd", "FanDuel", "book", (p) => p.book === "FanDuel"],
    ["agrees", "Sharp agrees", "sharp", (p) => p.sharp === "agrees"]];
  state.f = new Set();
  const filterChips = () => `<div class="filters fchips" role="group" aria-label="Filter">${FILTERS.map(([k, l]) =>
    `<button type="button" data-f="${k}" aria-pressed="${state.f.has(k)}">${l}</button>`).join("")}${state.f.size ? `<button type="button" data-f="clear" class="fclear">Clear</button>` : ""}</div>`;
  const passesChips = (p) => [...new Set(FILTERS.filter(([k]) => state.f.has(k)).map(([, , g]) => g))]
    .every((g) => FILTERS.some(([k, , gg, f]) => gg === g && state.f.has(k) && f(p)));
  const matches = (p) => {
    if (!passesChips(p)) return false;
    if (state.market !== "all" && p.prop !== state.market) return false;
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    return [p.player, p.team, p.opp, p.serial].some((x) => String(x || "").toLowerCase().includes(q));
  };
  function pickers(picks, allowAll) {
    if (!seasons.length) return "";
    const ps = periodsOf(state.season, picks);
    if (state.week !== "all" && !ps.includes(state.week)) state.week = allowAll ? "all" : ps[0] ?? null;
    return `<div class="pickers">
      <label><span>Season</span><select id="pk-season">${seasons.map((s) => `<option value="${s}"${s === state.season ? " selected" : ""}>${s}</option>`).join("")}</select></label>
      <label><span>${PERIOD}</span><select id="pk-week">${allowAll ? `<option value="all"${state.week === "all" ? " selected" : ""}>All</option>` : ""}${ps.map((w) => `<option value="${w}"${w === state.week ? " selected" : ""}>${PERIOD} ${w}</option>`).join("")}</select></label>
    </div>`;
  }
  const syncUrl = () => { const u = new URL(location.href); u.searchParams.set("season", state.season); u.searchParams.set("week", state.week); history.replaceState(null, "", u); };
  document.addEventListener("change", (e) => {
    if (e.target.id === "pk-season") { state.season = Number(e.target.value); state.week = null; syncUrl(); redraw(true); }
    if (e.target.id === "pk-week") { state.week = e.target.value === "all" ? "all" : Number(e.target.value); syncUrl(); redraw(true); }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "q") { state.q = e.target.value.trim(); redraw(false); } });
  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-view]");
    if (v) { state.view = v.dataset.view; store.set("ll-view", state.view); document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view))); redraw(false); return; }
    const fb = e.target.closest("button[data-f]");
    if (fb) { const k = fb.dataset.f; if (k === "clear") state.f.clear(); else state.f.has(k) ? state.f.delete(k) : state.f.add(k);
      document.querySelectorAll(".fchips").forEach((el) => { el.outerHTML = filterChips(); }); redraw(false); return; }
    const m = e.target.closest("button[data-market]");
    if (m) { state.market = m.dataset.market; document.querySelectorAll("button[data-market]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.market === state.market))); redraw(false); return; }
    const j = e.target.closest(".jump a");
    if (j) { const t = document.querySelector(j.getAttribute("href")); if (t) t.open = true; }
    const row = e.target.closest(".cs-row, .lrow");
    if (row && !e.target.closest("a, button.share")) toggleOpen(row.closest("[data-serial]"));
  });
  // expand a compact stub or a list row into the full ticket (and fold it back)
  function toggleOpen(holder) {
    if (!holder) return;
    const p = byId[holder.dataset.serial], open = !holder.classList.contains("open");
    holder.classList.toggle("open", open);
    const slot = holder.classList.contains("lrow") ? holder.nextElementSibling : holder.querySelector(".cs-full");
    if (open && !slot.dataset.filled) { (slot.querySelector("td") || slot).innerHTML = ticket(p); slot.dataset.filled = "1"; }
    slot.hidden = !open;
    const b = holder.querySelector(".cs-row") || holder; b.setAttribute("aria-expanded", String(open));
    afterDraw();
  }

  /* ------------------------------------------------------------------ motion + live bits */
  function reveal() {
    const items = document.querySelectorAll(".ticket:not(.in), .cstub:not(.in), .clvcard:not(.in), .chart:not(.in), .way:not(.in), .wkcard:not(.in)");
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -6% 0px" });
    items.forEach((el, i) => { el.style.setProperty("--i", i % 6); el.classList.add("rv"); io.observe(el); });
  }
  function countUp() {
    document.querySelectorAll(".tote b, .clvgrid b").forEach((el) => {
      const m = el.textContent.match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/);
      if (!m || el.dataset.done || /^-\d/.test(m[3])) return;
      el.dataset.done = "1";
      const [, sign, n, rest] = m, target = parseFloat(n), dec = (n.split(".")[1] || "").length, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 900), q = 1 - Math.pow(1 - k, 3); el.textContent = `${sign}${(target * q).toFixed(dec)}${rest}`; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  function countdowns() {
    document.querySelectorAll("[data-kick]").forEach((el) => {
      const ms = new Date(el.dataset.kick) - Date.now();
      if (ms <= 0) { el.textContent = "started"; return; }
      const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
      el.textContent = `${el.dataset.short ? "in" : `${SPORT.event || "starts"} in`} ${d ? d + "d " + h + "h" : h ? h + "h " + (m % 60) + "m" : (m % 60) + "m"}`;
    });
  }
  setInterval(() => { if (syncPhases()) redraw(true); else countdowns(); }, 30000);    // kickoff while the page is open
  const afterDraw = () => { reveal(); countdowns(); filterCount(); };
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button.share");
    if (!b) return;
    const p = byId[b.dataset.serial], url = new URL(`p/${p.serial}.html`, location.href).href, text = `${p.player} ${p.side} ${p.line} (${odds(p.price)}) - Line Ledger`;
    try { if (navigator.share) await navigator.share({ title: text, url }); else { await navigator.clipboard.writeText(url); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Share"), 1600); } } catch (err) {}
  });
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    let el = id && document.getElementById(id);
    if (!el) return;
    if (el.dataset.serial && !el.classList.contains("ticket") && !el.classList.contains("open")) toggleOpen(el);
    el.scrollIntoView({ block: "center" }); el.classList.add("hit");
  }

  /* ------------------------------------------------------------------ times in the visitor's own timezone */
  let TZF = null;
  try { TZF = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }); } catch (e) {}
  function when(utc, etText) {         // "Sun 10/25 1:00 PM EDT"; falls back to the ET text the site was built with
    const t = utc ? new Date(utc) : null;
    if (!TZF || !t || isNaN(t)) return etText ? `${esc(etText)} ET` : "";
    const v = Object.fromEntries(TZF.formatToParts(t).map((x) => [x.type, x.value]));
    return `${v.weekday} ${v.month}/${v.day} ${v.hour}:${v.minute}${v.dayPeriod ? " " + v.dayPeriod : ""} ${v.timeZoneName || ""}`.trim();
  }

  // every pick on one player: player.html?id=<player id>
  const playerHref = (pid) => `${(SPORT.files || {}).player || "player.html"}?id=${encodeURIComponent(pid)}`;
  const playerLink = (p) => p.pid ? `<a class="plink" href="${playerHref(p.pid)}" title="Every pick on ${esc(p.player)}">${esc(p.player)}</a>` : esc(p.player);

  /* ------------------------------------------------------------------ status of a pick: open / live / grading / final */
  function status(p, short) {
    if (p.phase === "final") return `<span class="pill res-${p.result}">${SEAL[p.result] || p.result}</span>`;
    if (p.phase === "live") return p.game_state === "Awaiting stats" ? `<span class="pill grading">Final &middot; grading</span>` : `<span class="pill live"><i></i>Live</span>`;
    return p.kick_utc ? `<span class="pill open"><span class="countdown" data-kick="${p.kick_utc}"${short ? ' data-short="1"' : ""}>${esc(p.kick)}</span></span>` : `<span class="pill open">Open</span>`;
  }

  /* ------------------------------------------------------------------ the full ticket (the design stays as it is) */
  function barcode(serial) {
    let x = 0, h = 7; const stops = [];
    for (const ch of serial + serial) { h = (h * 31 + ch.charCodeAt(0)) % 997; const b = 1 + (h % 3), g = 1 + ((h >> 2) % 2);
      stops.push(`var(--ink) ${x}px ${x + b}px`, `transparent ${x + b}px ${x + b + g}px`); x += b + g; }
    return `<span class="barcode" aria-hidden="true" style="width:${x}px;background:linear-gradient(90deg,${stops.join(",")})"></span>`;
  }
  const kickSpan = (p) => p.phase !== "open" ? `<span>close locked &middot; posts after the game</span>`
    : p.kick_utc ? `<span class="countdown" data-kick="${p.kick_utc}">closes at ${SPORT.event || "the start"}</span>` : "";
  const priceDir = (pick, other) => { const dec = (a) => a > 0 ? 1 + a / 100 : 1 + 100 / -a; const x = dec(other) - dec(pick); return Math.abs(x) < 1e-9 ? 0 : x > 0 ? 1 : -1; };
  const bar = (dir, w) => `<span class="bar" aria-hidden="true">${dir > 0 ? `<i class="up" style="left:50%;width:${w}%"></i>` : dir < 0 ? `<i class="down" style="left:${50 - w}%;width:${w}%"></i>` : ""}</span>`;
  const implied = (a) => a > 0 ? 100 / (a + 100) : -a / (-a + 100);
  // the newest check of each market: a pick whose own book wasn't quoted then has its line taken down ("not posted since")
  const lastCheck = {};
  allPicks.forEach((p) => { if (p.phase === "open" && p.now_utc && (!lastCheck[p.prop] || p.now_utc > lastCheck[p.prop])) lastCheck[p.prop] = p.now_utc; });
  const dec = (a) => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  function vsLine(p) {           // what the pick is compared with: the close after the start, else the SAME book's price now
    if (p.closed && p.now != null) return { label: "Close", line: p.now, price: p.close_price, book: p.close_book };
    if (p.phase === "open") {
      if (p.now == null || !p.now_same || p.close_price == null) return null;
      const stale = !!lastCheck[p.prop] && new Date(lastCheck[p.prop]) - new Date(p.now_utc) > 30 * 60000;
      const better = p.now === p.line && dec(p.close_price) > dec(p.price) + 1e-9;
      const ok = p.now !== p.line || p.playable_to == null ? null : dec(p.close_price) >= dec(p.playable_to) - 1e-9;
      return { label: "Now", line: p.now, price: p.close_price, book: p.close_book, stale, at: p.now_at, ok, better };
    }
    if (p.now != null) return { label: "Close", line: p.now, price: p.close_price, book: p.close_book };
    return null;
  }
  function moves(p, v) {
    const mv = (v.line - p.line) * (p.side === "OVER" ? 1 : -1);
    const same = v.line === p.line && v.price != null;
    const pts = same ? 100 * (implied(v.price) - implied(p.price)) : 0;
    return { mv, same, pts, pdir: Math.abs(pts) < 0.05 ? 0 : pts > 0 ? 1 : -1 };
  }
  function compare(p, P) {
    const v = vsLine(p);
    if (!v) return `<div class="mv"><span></span><small>Pick</small><span></span><small></small>
        <span class="lbl">Line</span><b>${p.line}</b>${bar(0, 0)}<b class="muted">&ndash;</b>
        <span class="lbl">Price</span><b>${odds(p.price)}</b>${bar(0, 0)}<b class="muted">&ndash;</b></div>
        <div class="clv-f"><span>${p.result ? "no closing line" : `no newer ${esc(p.book)} line yet`}</span>${p.result ? "" : kickSpan(p)}</div>`;
    const { mv, same, pdir, pts } = moves(p, v);
    const lineW = Math.min(50, Math.abs(mv) * (P.unit === "yds" ? 4 : 50)), priceW = Math.min(50, Math.abs(pts) * 6);
    const what = mv > 0 ? `line moved ${sgn(mv)}${mv.toFixed(1)} ${P.unit} your way` : mv < 0 ? `line moved ${Math.abs(mv).toFixed(1)} ${P.unit} against you`
      : pdir > 0 ? "price moved your way" : pdir < 0 ? "price moved against you" : "no movement";
    const books = `${abbr(p.book)}${abbr(v.book) && abbr(v.book) !== abbr(p.book) ? ` &rarr; ${abbr(v.book)}` : ""}`;
    const verdict = v.stale || v.ok == null ? "" : ` &middot; <b class="${v.ok ? "up" : "down"}">${v.better ? "better than the pick" : v.ok ? "still playable" : "past playable"}</b>`;
    const foot = p.closed ? `<span>Beat the close: <b class="${p.beat ? "up" : "down"}">${p.beat ? "yes" : "no"}</b> &middot; ${what}</span><span class="bk">${books}</span>`
      : `<span>${what}${verdict}</span>${kickSpan(p)}`;
    return `<div class="mv"><span></span><small>Pick</small><span></span><small>${v.label}</small>
        <span class="lbl">Line</span><b>${p.line}</b>${bar(mv > 0 ? 1 : mv < 0 ? -1 : 0, lineW)}<b class="${tone(mv)}">${v.line}</b>
        <span class="lbl">Price</span><b>${odds(p.price)}</b>${bar(pdir, priceW)}<b class="${same ? (pdir > 0 ? "up" : pdir < 0 ? "down" : "") : "muted"}">${v.price == null ? "&ndash;" : odds(v.price)}</b></div>
      <div class="clv-f">${foot}</div>${!p.closed ? `<div class="clv-b">${esc(p.book)} &middot; ${v.stale ? `<span class="stale">not posted since ${esc(v.at)}</span>` : `checked ${esc(v.at || "")}`}</div>` : ""}`;
  }
  function details(p, P) {
    const rows = [];
    if (p.quotes && p.quotes.length) rows.push(["Lines when stamped", p.quotes.map((q) => `${esc(q.book)} ${q.line} ${odds(q.over)}/${odds(q.under)}`).join("<br>")]);
    if (p.sharp_line != null) rows.push([`Pinnacle${p.sharp_close ? " at close" : ""}`, `${p.sharp_line} ${odds(p.sharp_over)}/${odds(p.sharp_under)}`]);
    if (p.market != null) rows.push(["Market's number", `${num(p.market, P.dec)} <span class="muted">vs model ${num(p.model, P.dec)}</span>`]);
    if (p.playable_to != null) rows.push(["Playable to", `${odds(p.playable_to)} <span class="muted">at ${p.line}: the worst price that still clears the ${D.min_ev ?? 2}% value bar</span>`]);
    rows.push(["Start", when(p.kick_utc, p.kick)]);
    if (p.verify) rows.push(["Posted publicly", `${when(p.posted_utc, p.posted_at)} <span class="muted">(${p.posted_before ? "before the start" : "after the start &middot; pre-launch"})</span><br><a href="${esc(p.verify)}" target="_blank" rel="noopener noreferrer">see the public record of this post &nearr;</a>`]);
    if (p.closed && p.clv != null) rows.push(["Closing line", `${p.now} ${p.close_price != null ? odds(p.close_price) : ""} ${esc(p.close_book || "")} <span class="muted">(${sgn(p.clv)}${p.clv.toFixed(1)} ${P.unit})</span>`]);
    return `<details class="drawer"><summary>Ticket details</summary><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></details>`;
  }
  function moveWord(p) {
    const v = vsLine(p);
    if (!v) return `<b class="muted">&ndash;</b>`;
    const { mv, pdir } = moves(p, v), d = mv !== 0 ? mv : pdir;
    return `<b class="${d > 0 ? "up" : d < 0 ? "down" : "muted"}">${d > 0 ? "Your way" : d < 0 ? "Against" : "No change"}</b>`;
  }
  // "Bet on <Book>": the pick's own book, open picks only (nothing is placed - the book opens and you confirm)
  // a dot in the book's color (not the books' logos: those are trademarks, used only under their own terms)
  const BOOKS_OK = { DraftKings: "dk", FanDuel: "fd" };
  // "featured" = the header card's text link; otherwise a tag styled like the ticket's Share button
  function betButton(p, featured) {
    if (p.phase !== "open" || !p.bet_link || !BOOKS_OK[p.book]) return "";
    const what = p.bet_kind === "slip" ? "opens the bet" : p.bet_kind === "event" ? "opens the game" : "opens the book";
    const tip = `${p.book} ${what}: ${p.player} ${MKT(p.prop).short || MKT(p.prop).label} ${p.side} ${p.line}. Nothing is placed for you.`;
    return `<a class="${featured ? "fc-bet" : "share betlink"}" href="${esc(p.bet_link)}" target="_blank" rel="noopener noreferrer" title="${esc(tip)}"
      aria-label="Bet on ${esc(p.book)}: ${esc(tip)}"><i class="bkdot ${BOOKS_OK[p.book]}" aria-hidden="true"></i>${featured ? `Bet at ${esc(p.book)}` : `Bet ${BOOKS_OK[p.book].toUpperCase()}`} &nearr;</a>`;
  }
  function ticket(p) {
    const P = MKT(p.prop);
    const head = p.closed ? `<small>Closing line value</small><b class="${tone(p.clv_ev)}">${pct(p.clv_ev)}</b>`
      : p.phase !== "open" ? `<small>Closing line value</small><b class="muted">pending</b>` : `<small>Since the pick</small>${moveWord(p)}`;
    const won = p.result === "W" ? "up" : p.result === "L" ? "down" : "";
    const final = p.result && p.result !== "VOID" && p.actual != null
      ? `<div class="final ${won}">Final <b>${p.actual} ${P.unit}</b> &middot; ${p.margin ? `${Math.abs(p.margin).toFixed(1)} ${p.margin > 0 ? "over" : "under"} the line` : "right on the line"}</div>`
      : p.result === "VOID" ? `<div class="final">Didn't play &middot; bet refunded</div>` : "";
    return `<article class="ticket${p.result ? " graded" : ""}" id="${esc(p.serial)}" style="${band(p)}">
      <div class="t-top">
        <div class="t-meta"><span class="t-game">${gameLabel(p)}<span>${when(p.kick_utc, p.kick)}</span></span>${sharpChip(p.sharp, p.sharp_close)}</div>
        <div class="t-player">${playerLink(p)}</div>
        <div class="t-pick"><span><b>${p.side} ${p.line}</b><small>${odds(p.price)} ${esc(p.book)}</small></span>${p.result ? "" : status(p)}</div>
        ${p.phase === "open" && p.playable_to != null ? `<div class="final">Playable to <b>${odds(p.playable_to)}</b> &middot; <span class="muted">${esc(P.short || P.label)}</span></div>` : ""}        ${final}
        ${p.result ? `<div class="seal ${p.result}" aria-label="${SEAL[p.result]}">${SEAL[p.result]}</div>` : ""}
      </div>
      <div class="clv"><div class="clv-h">${head}</div>${compare(p, P)}</div>
      <div class="stats"><span>Model<b>${num(p.model, P.dec)}</b></span><span>Win<b>${pct(p.win, false)}</b></span><span>EV<b>${pct(p.ev)}</b></span><span>Size<b>${num(p.units, 1)}u${p.pl_u != null ? ` <i class="${tone(p.pl_u)}">&rarr; ${num(p.pl_u, 2, true)}u</i>` : ""}</b></span></div>
      ${details(p, P)}
      <div class="stub">
        <div><span class="serial">No. ${esc(p.serial)}</span><span class="when">Stamped ${when(p.stamped_utc, p.stamped)}${p.verify ? ` &middot; <a class="verify" href="${esc(p.verify)}" target="_blank" rel="noopener noreferrer" title="The public commit that first posted this pick: ${when(p.posted_utc, p.posted_at)}${p.posted_before ? ", before the start" : ""}">verify &nearr;</a>` : ""}</span></div>
        <div class="stub-r">${p.pre ? `<span class="chip pre">pre-launch</span>` : p.paper ? `<span class="chip paper">paper</span>` : ""}${betButton(p)}<button type="button" class="share" data-serial="${esc(p.serial)}" aria-label="Share this pick">Share</button>${barcode(p.serial)}</div>
      </div>
    </article>`;
  }

  /* ------------------------------------------------------------------ compact stub + list row (both open into the ticket) */
  function clvMini(p) {
    if (p.closed && p.clv_ev != null) return `<span class="cs-clv ${tone(p.clv_ev)}">CLV ${pct(p.clv_ev)}</span>`;
    if (p.phase === "open") { const w = moveWord(p).replace(/<\/?b[^>]*>/g, ""); return `<span class="cs-clv ${w === "Your way" ? "up" : w === "Against" ? "down" : "muted"}">${w === "&ndash;" ? "no move yet" : w.toLowerCase()}</span>`; }
    return `<span class="cs-clv muted">close pending</span>`;
  }
  function stubTicket(p) {
    const P = MKT(p.prop);
    return `<article class="cstub${p.result ? " graded r-" + p.result : ""}" id="${esc(p.serial)}" data-serial="${esc(p.serial)}" style="${band(p)}">
      <button type="button" class="cs-row" aria-expanded="false" aria-label="${esc(p.player)} ${p.side} ${p.line}: show the full ticket">
        <span class="cs-l">
          <span class="cs-meta">${gameLabel(p)}<span class="cs-mk">${esc(P.short || P.label)}</span></span>
          <span class="cs-player">${esc(p.player)}</span>
          <span class="cs-pick"><b>${p.side} ${p.line}</b> ${odds(p.price)} <small>${esc(abbr(p.book))}</small></span>
        </span>
        <span class="cs-r">${status(p, true)}${clvMini(p)}${p.sharp ? `<span class="cs-sharp ${p.sharp === "no line" ? "noline" : p.sharp}" title="${SHARP[p.sharp] || ""}">${p.sharp === "no line" ? "&ndash;" : p.sharp === "agrees" ? "sharp &#10003;" : p.sharp === "against" ? "sharp &#10007;" : "sharp ~"}</span>` : ""}</span>
        <span class="cs-chev" aria-hidden="true"></span>
      </button>
      <div class="cs-full" hidden></div>
    </article>`;
  }
  function listView(list) {
    const rows = list.map((p) => { const P = MKT(p.prop), v = vsLine(p);
      return `<tr class="lrow${p.result ? " r-" + p.result : ""}" id="${esc(p.serial)}" data-serial="${esc(p.serial)}" tabindex="0" style="${band(p)}">
        <td class="l-game m-hide"><span class="gteams">${gameLabel(p)}</span></td>
        <td class="l-player">${playerLink(p)}<span class="m-only l-sub gteams">${gameLabel(p)}</span></td><td class="opt">${esc(P.short || P.label)}</td>
        <td class="mono l-pick">${p.side} ${p.line} <span class="l-px">${odds(p.price)} <span class="muted">${esc(abbr(p.book))}</span></span></td>
        <td class="num opt mono">${v ? `${v.line} ${odds(v.price)}` : "&ndash;"}</td><td class="num m-hide">${clvMini(p)}</td>
        <td class="opt">${p.sharp ? (SHARP[p.sharp] || "").replace("Sharp ", "") : ""}</td><td class="l-st">${status(p, true)}<span class="m-only">${clvMini(p)}</span></td></tr>
        <tr class="lexp" hidden><td colspan="8"></td></tr>`; }).join("");
    return `<div class="tablebox"><table class="ltable"><thead><tr><th class="m-hide">Game</th><th>Player</th><th class="opt">Market</th><th>Pick</th><th class="num opt">Now / close</th><th class="num m-hide">CLV</th><th class="opt">Sharp</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function gamesOf(list) {
    const out = [], seen = {};
    list.forEach((p) => { const id = p.game_id || `${p.week}-${[p.team, p.opp].sort().join("-")}`;
      if (!seen[id]) { seen[id] = { id, kick: p.kick, kick_utc: p.kick_utc, phase: p.phase, game_state: p.game_state, away: p.home ? p.opp : p.team, home: p.home ? p.team : p.opp, picks: [] }; out.push(seen[id]); }
      seen[id].picks.push(p); });
    return out;
  }
  // a list of picks, in the chosen view; grouped by game unless it's the list view
  function picksBlock(list, grouped = true) {
    if (!list.length) return "";
    if (state.view === "list") return listView(list);
    const one = state.view === "tickets" ? ticket : stubTicket;
    const wrap = (ps) => state.view === "tickets" ? `<div class="tickets">${ps.map(one).join("")}</div>` : `<div class="stubs">${ps.map(one).join("")}</div>`;
    if (!grouped) return wrap(list);
    return gamesOf(list).map((g) => `<div class="gamegroup" id="g-${esc(g.id)}"><div class="ghead"><span class="gteams">${tm(g.away)}<i class="at">@</i>${tm(g.home)}</span>
        <span class="mono muted">${when(g.kick_utc, g.kick)} &middot; ${g.picks.length} pick${g.picks.length === 1 ? "" : "s"}</span></div>${wrap(g.picks)}</div>`).join("");
  }

  /* ------------------------------------------------------------------ records, scoreboards, charts */
  function tote(rec, P, compact) {
    const r = rec[0] || { n: 0 };
    const n = r.n_clv || 0;
    const cells = [["key", `<b class="${tone(r.clv_ev)}">${pct(r.clv_ev)}</b>`, `value vs close <em class="n">n=${n}${n < 50 ? ", early" : ""}</em>`],
      ["", `<b>${r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%"}</b>`, "beat the close"],
      ["", `<b>${wl(r)}</b>`, P.paper ? "paper record" : "record"],
      ["", `<b class="${tone(r.sized)}">${r.sized != null ? num(r.sized, 2, true) + "u" : "&ndash;"}</b>`,
        `units${r.sized_roi != null ? ` &middot; ROI ${pct(r.sized_roi)}` : ""} <em class="n">1u each: ${r.n ? num(r.units, 2, true) + "u" : "&ndash;"}</em>`]];
    return `<div class="tote${compact ? " compact" : ""}">${cells.map(([c, b, s]) => `<div class="${c}">${b}<span>${s}</span></div>`).join("")}</div>`;
  }
  const scoreboard = () => `<div class="boards">${MK.map((k) => { const P = MKT(k);
    return `<a class="sb" href="${P.slug}.html"><div class="sb-h"><span>${esc(P.label)}</span>${P.paper ? `<span class="chip paper">paper</span>` : `<span class="chip rec">the record</span>`}</div>${tote(P.record, P, true)}</a>`; }).join("")}</div>`;
  // under this many picks a number mostly reflects luck: say so next to it
  const EARLY = 50;
  const earlyNote = (n) => n && n < EARLY ? ` <span class="note" title="Fewer than ${EARLY} picks: too early to judge">n=${n}</span>` : "";
  const earlyLine = (n) => n < EARLY ? `<p class="note early">Fewer than ${EARLY} picks: too early to judge. Small samples swing a lot either way; these numbers settle as picks add up.</p>` : "";
  function recordTable(rows) {
    if (!rows.length) return `<div class="empty">No graded picks yet.</div>`;
    return recordTableBody(rows) + earlyLine(rows[0].n_clv || 0);
  }
  function recordTableBody(rows) {
    return `<div class="tablebox"><table><thead><tr><th>Picks</th><th class="num opt">Graded</th><th class="num">W-L-P</th><th class="num opt">Win %</th><th class="num" title="Each pick at the size on its ticket">Units</th><th class="num opt">ROI</th><th class="num opt" title="Every pick 1 unit">1u each</th><th class="num key">Value vs close</th><th class="num opt">Beat close</th></tr></thead>
      <tbody>${rows.map((x, i) => `<tr class="${x.sub ? "sub" : i === 0 ? "top" : ""}"><td>${esc(x.label)}</td><td class="num opt">${x.n}${x.pending ? ` <span class="note">+${x.pending}</span>` : ""}</td>
        <td class="num">${wl(x)}</td><td class="num opt">${x.n ? pct(x.win, false) : "&ndash;"}</td><td class="num ${tone(x.sized)}">${x.sized != null ? num(x.sized, 2, true) : "&ndash;"}</td>
        <td class="num opt ${tone(x.sized_roi)}">${pct(x.sized_roi)}</td><td class="num opt ${tone(x.units)}">${x.n ? num(x.units, 2, true) : "&ndash;"}</td><td class="num key ${tone(x.clv_ev)}">${pct(x.clv_ev)}${earlyNote(x.n_clv)}</td><td class="num opt">${x.beat == null ? "&ndash;" : x.beat.toFixed(0) + "%"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function lineChart(vals, caption, last, fmt) {
    if (vals.length < 3) return "";
    const W = 640, H = 170, pad = 8, lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
    const x = (i) => pad + (i / (vals.length - 1)) * (W - 2 * pad), y = (v) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
    const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return `<figure class="chart"><figcaption><span>${caption}</span><b class="${tone(last)}">${fmt(last)}</b></figcaption>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${caption.replace(/<[^>]+>/g, "")}: ${fmt(last)}">
        <line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" class="zero"/><path d="${path}" class="${last >= 0 ? "upl" : "downl"}" vector-effect="non-scaling-stroke"/></svg></figure>`;
  }
  // the charts follow the headline record: live picks only once a market has any (paper picks have their own row)
  const recordPicks = (P) => P.picks.some((p) => !p.paper) ? P.picks.filter((p) => !p.paper) : P.picks;
  function unitsChart(P) {
    const g = recordPicks(P).filter((p) => p.pl_u != null).sort((a, b) => a.serial < b.serial ? -1 : 1);
    let run = 0; const pts = [0, ...g.map((p) => (run += p.pl_u))];
    return lineChart(pts, `${esc(P.label)} <span class="muted">units over time, ${g.length} graded</span>`, pts[pts.length - 1], (v) => `${num(v, 2, true)}u`);
  }
  const periodRec = (P, season, w) => P.weeks[`${season}-${w}`];
  const recLine = (r) => (r && r.n ? `<b>${wl(r)}</b> <b class="${tone(r.sized)}">${num(r.sized || 0, 2, true)}u</b> <span class="muted">vs close</span> <b class="${tone(r.clv_ev)}">${pct(r.clv_ev)}</b>` : r && r.pending ? `<span class="muted">${r.pending} not graded yet</span>` : `<span class="muted">no picks</span>`)
    + (r && r.paper ? ` <span class="chip paper" title="tracked, not bet">paper</span>` : "");

  function notify() {
    const feed = `${D.site_url || ""}feed.xml`;
    return `<section class="notify"><div><div class="eyebrow">Never miss a pick</div><h2>Get alerts</h2></div><div class="ways">
      ${D.discord ? `<a class="way" href="${esc(D.discord)}"><b>Discord</b><span>Join the picks channel and turn on notifications: your phone buzzes the moment a pick is posted.</span></a>` : ""}
      <a class="way" href="feed.xml"><b>RSS feed</b><span>Add <span class="mono">${esc(feed)}</span> to any feed reader app and switch on alerts for new items.</span></a>
      ${standalone() ? "" : `<a class="way" href="#" id="install"><b>Add to home screen</b><span>iPhone: tap Share, then Add to Home Screen. Android: tap the menu, then Install app. It opens full screen, like an app.</span></a>`}</div></section>`;
  }
  function hero(eyebrow, title, text, extra = "", side = "") {
    const h = `<div class="hero"><div class="eyebrow" style="color:#aeb9cc">${eyebrow}</div><h1>${title}</h1><p>${text}</p></div>`;
    $("hero").innerHTML = side ? `<div class="hero-grid">${h}<div class="hg-side">${side}</div><div class="hg-extra">${extra}</div></div>` : h + extra;
  }
  // every way to narrow the list sits behind one Filter button (its count = filters switched on)
  state.fopen = false;
  const FUNNEL = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>`;
  const toolbar = (pick, withMarket = true, panel = "") => `<div class="toolbar">${pick}<span class="tb-r">${searchBox()}
      <button type="button" class="fbtn" id="fbtn" aria-expanded="${state.fopen}" aria-controls="fpanel">${FUNNEL}Filter<b class="fcount" id="fcount" hidden></b></button>${viewBar()}</span></div>
    <div class="fpanel" id="fpanel"${state.fopen ? "" : " hidden"}>${withMarket ? `${marketSeg()}${filterChips()}` : ""}${panel}</div>`;
  function filterCount() {
    const b = $("fcount"), panel = $("fpanel");
    if (!b || !panel || !panel.querySelectorAll) return;
    const n = [...panel.querySelectorAll('button[aria-pressed="true"]')].filter((x) => x.dataset.market !== "all" && x.dataset.k !== "all").length;
    b.textContent = n || ""; b.hidden = !n;
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("#fbtn");
    if (!t) return;
    state.fopen = !state.fopen; t.setAttribute("aria-expanded", String(state.fopen));
    const panel = $("fpanel"); if (panel) panel.hidden = !state.fopen;
  });

  /* the moving strip of open picks (home) */
  function miniTicket(p) {
    const P = MKT(p.prop);
    return `<a class="mt" href="${linkTo(p)}" style="${band(p)}" aria-label="${esc(p.player)} ${p.side} ${p.line}">
      <span class="m-top"><span class="gteams">${gameLabel(p)}</span>${status(p, true)}</span><span class="m-player">${esc(p.player)}</span>
      <span class="m-pick"><b>${p.side} ${p.line}</b> ${odds(p.price)} <small>${esc(abbr(p.book))} &middot; ${esc(P.short || P.label)}</small></span>
      <span class="m-foot">${sharpChip(p.sharp)}${(() => { const v = vsLine(p); return v && !v.stale ? `<span class="m-now ${v.ok === false ? "pass" : "ok"}">now ${odds(v.price)}</span>` : ""; })()}</span></a>`;
  }
  function marquee(list) {
    const cards = list.map(miniTicket).join(""), secs = Math.max(24, list.length * 5);
    return `<div class="marquee" id="marquee" style="--dur:${secs}s" aria-label="Open picks, moving"><div class="mtrack">${cards}<span class="mgap"></span>${cards.replace(/<a class="mt"/g, '<a tabindex="-1" aria-hidden="true" class="mt"')}<span class="mgap"></span></div></div>`;
  }

  /* ------------------------------------------------------------------ featured pick: chosen automatically */
  // the biggest edge (EV at the stamp) among picks not started yet, preferring ones Pinnacle agrees with, and
  // skipping any whose own book is now past the playable price or has taken the line down
  function featuredPick() {
    const ok = openNow.filter((p) => p.phase === "open" && p.ev != null && !MKT(p.prop).paper && (() => { const v = vsLine(p); return !v || (!v.stale && v.ok !== false); })());
    const agrees = ok.filter((p) => p.sharp === "agrees"), pool = agrees.length ? agrees : ok;
    return pool.length ? pool.reduce((a, b) => (b.ev > a.ev ? b : a)) : null;
  }
  // a small ticket-style card that sits in the header beside the headline; "Full ticket" opens the real one
  function featured() {
    const p = featuredPick();
    if (!p) return "";
    const P = MKT(p.prop);
    const why = `Chosen automatically: the biggest edge on the board (EV ${pct(p.ev).replace("&ndash;", "-")})${p.sharp === "agrees" ? ", and Pinnacle agrees" : ""}.`;
    return `<aside class="feat-card" style="${band(p)}" aria-label="Featured pick" title="${esc(why)}">
      <div class="fc-h"><span>Featured &middot; top edge</span>${status(p, true)}</div>
      <div class="fc-g">${gameLabel(p)}<span>${when(p.kick_utc, p.kick)}</span></div>
      <div class="fc-player">${esc(p.player)}</div>
      <div class="fc-pick"><b>${p.side} ${p.line}</b> ${odds(p.price)} <small>${esc(p.book)} &middot; ${esc(P.short || P.label)}</small></div>
      <div class="fc-stats"><span>EV <b>${pct(p.ev)}</b></span><span>Win <b>${pct(p.win, false)}</b></span>${p.sharp === "agrees" ? `<span class="fc-sharp">Sharp &#10003;</span>` : ""}</div>
      <div class="fc-f">${betButton(p, true) || "<span>Picked by the numbers, not by hand</span>"}<a href="${linkTo(p).replace(/^.*\//, "")}">Full ticket &rarr;</a></div></aside>`;
  }

  /* ------------------------------------------------------------------ weekly recap: once every pick of a period is graded */
  const periodKeys = () => [...new Set(allPicks.map((p) => `${p.season}-${p.week}`))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const picksOf = (key) => allPicks.filter((p) => `${p.season}-${p.week}` === key);
  function latestRecap() {
    const key = periodKeys().find((k) => picksOf(k).every((p) => p.phase === "final"));
    if (!key) return null;
    const every = picksOf(key), [season, w] = key.split("-").map(Number);
    const ps = every.some((p) => !p.paper) ? every.filter((p) => !p.paper) : every;     // totals: live picks only
    const count = (r) => ps.filter((p) => p.result === r).length;
    const beats = ps.filter((p) => p.beat != null);
    // best hit: the win that paid the most units, then the one that cleared its line by the most (same as the image)
    const paid = (p) => Math.round((p.pl || 0) * 1000), clear = (p) => (p.side === "OVER" ? p.actual - p.line : p.line - p.actual) / Math.sqrt(Math.abs(p.line));
    const better = (a, b) => paid(b) > paid(a) || (paid(b) === paid(a) && clear(b) > clear(a));
    const wins = ps.filter((p) => p.result === "W" && p.actual != null && p.line);
    return { key, season, w, n: ps.length, W: count("W"), L: count("L"), P: count("P"),
      units: ps.reduce((s, p) => s + (p.pl || 0), 0), sized: ps.reduce((s, p) => s + (p.pl_u || 0), 0),
      risked: ps.reduce((s, p) => s + (p.pl_u != null ? p.units || 0 : 0), 0),
      beat: beats.length ? (100 * beats.filter((p) => p.beat).length) / beats.length : null,
      dots: [...ps].filter((p) => ["W", "L", "P"].includes(p.result)).sort((a, b) => (a.kick_utc || "").localeCompare(b.kick_utc || "")),
      best: wins.length ? wins.reduce((a, b) => (better(a, b) ? b : a)) : null };
  }
  function recapCard(r) {
    const rec = `${r.W}-${r.L}${r.P ? "-" + r.P : ""}`;
    const beatTone = r.beat == null || r.beat === 50 ? "" : r.beat > 50 ? "up" : "down";
    const beat = r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%";
    const text = `Line Ledger, ${PERIOD} ${r.w}: ${rec}, ${num(r.sized, 2, true)}u${r.beat != null ? `, beat the close ${r.beat.toFixed(0)}%` : ""}`;
    const dot = (p) => `<i class="${p.result === "W" ? "up" : p.result === "L" ? "down" : ""}" title="${esc(p.player)} ${p.side} ${p.line}: ${p.result}"></i>`;
    return `<article class="recap" id="recap-${r.key}"><div class="rc-h"><div class="eyebrow">${PERIOD} ${r.w} in review &middot; ${r.season}</div>
        <span class="pill grading">All ${r.n} graded</span></div>
      <div class="rc-big"><div><b>${rec}</b><small>Record</small></div><div><b class="${tone(r.sized)}">${num(r.sized, 2, true)}u</b><small>Units${r.risked ? ` &middot; ROI ${pct(100 * r.sized / r.risked)}` : ""} &middot; 1u each ${num(r.units, 2, true)}u</small></div>
        <div><b class="${beatTone}">${beat}</b><small>Beat the close</small></div></div>
      <div class="rc-dots" aria-label="${r.W} wins, ${r.L} losses">${r.dots.map(dot).join("")}</div>
      <div class="rc-m">${MK.map((k) => `<span><em>${esc(MKT(k).short || MKT(k).label)}</em> ${recLine(MKT(k).weeks[r.key])}</span>`).join("")}</div>
      <div class="rc-f">${r.best ? `<a href="${linkTo(r.best).replace(/^.*\//, "")}">Best hit: <b>${esc(r.best.player)}</b> ${r.best.side} ${r.best.line} (${r.best.price > 0 ? "+" : ""}${r.best.price}) &middot; had <b class="up">${r.best.actual}</b></a>` : "<span></span>"}
        <span class="rc-btns"><a class="more" href="./?season=${r.season}&week=${r.w}">See every pick &rarr;</a><a class="more" href="recap/${r.key}.png" download="line-ledger-${r.key}.png">Image</a><button type="button" class="rshare" data-key="${r.key}" data-text="${esc(text)}">Share</button></span></div></article>`;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button.rshare");
    if (!b) return;
    // the recap's own link (its preview is the recap image); on phones that can, the image itself is shared too
    const url = new URL(`recap/${b.dataset.key}.html`, location.href).href, text = b.dataset.text;
    try {
      if (navigator.canShare) {
        const blob = await (await fetch(`recap/${b.dataset.key}.png`)).blob();
        const file = new File([blob], `line-ledger-${b.dataset.key}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}` }); return; }
      }
      if (navigator.share) await navigator.share({ title: text, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Share"), 1600); }
    } catch (err) {}
  });
  // the home page shows the recap until the next period's first game starts
  function homeRecap() {
    const r = latestRecap();
    if (!r) return "";
    const later = allPicks.filter((p) => p.season > r.season || (p.season === r.season && p.week > r.w));
    return later.some((p) => p.phase !== "open") ? "" : `<section>${recapCard(r)}</section>`;
  }

  /* ------------------------------------------------------------------ pages */
  const PHASES = [["open", "Open", "Not started &middot; the line can still move"], ["live", "Live", "In progress, or finished and waiting for official stats"], ["final", "Final", "Graded"]];
  const jumpBar = (list, phases = PHASES) => `<nav class="jump" aria-label="Jump to">${phases.map(([ph, title]) => {
    const n = list.filter((p) => p.phase === ph).length;
    return `<a href="#ph-${ph}" class="jp-${ph}"${n ? "" : ' aria-disabled="true"'}>${title}<span>${n}</span></a>`; }).join("")}</nav>`;
  function phaseSections(list, season, week) {
    return jumpBar(list) + PHASES.map(([ph, title, sub]) => {
      const ps = list.filter((p) => p.phase === ph).sort(byKick);
      const rec = ph === "final" ? `<div class="phase-rec">${MK.map((k) => `<span><em>${esc(MKT(k).short || MKT(k).label)}</em> ${recLine(periodRec(MKT(k), season, week))}</span>`).join("")}</div>` : "";
      return `<details class="phase ph-${ph}" id="ph-${ph}"${ps.length ? " open" : ""}><summary><span class="ph-t">${title}<span class="count">${ps.length}</span></span><span class="ph-s">${sub}</span></summary>
        ${rec}${ps.length ? picksBlock(ps) : `<div class="empty">Nothing ${title.toLowerCase()} ${ph === "final" ? "yet this " + PERIOD.toLowerCase() : "right now"}.</div>`}</details>`;
    }).join("");
  }

  function home() {
    hero(`${esc(SPORT.name)} player props &middot; ${D.season}`, "Every pick stamped. <em>Every result kept.</em>",
      "Player props priced against DraftKings and FanDuel, posted before the start and graded against the closing line. Nothing is edited or removed.", scoreboard(), featured());
    if (state.week == null || state.week === "all") state.week = D.week;
    const strip = openNow.filter((p) => p.phase === "open");
    $("app").innerHTML = `
      ${homeRecap()}
      ${strip.length >= 3 ? `<section class="openstrip"><div class="head"><div><div class="eyebrow">Up next</div><h2>Open now <span class="count">${strip.length}</span></h2></div>
        <span class="headbtns"><button type="button" class="mtoggle" id="mtoggle" aria-pressed="false">Pause</button><a class="more" href="${F.open}">All open &rarr;</a></span></div>${marquee(strip)}</section>` : ""}
      <section><div class="head"><div><div class="eyebrow">${PERIOD} at a glance</div><h2 id="wk-title"></h2></div></div>
        <div id="tb"></div><div id="phases" class="phases"></div></section>
      ${notify()}`;
    const m = $("marquee"), b = $("mtoggle");
    if (m && b) b.onclick = () => { const on = m.classList.toggle("paused"); b.textContent = on ? "Play" : "Pause"; };
    redraw = (full) => {
      if (full !== false || !$("pk-season")) $("tb").innerHTML = toolbar(pickers(allPicks, false));
      $("wk-title").textContent = `${PERIOD} ${state.week ?? "-"}, ${state.season}`;
      const list = allPicks.filter((p) => p.season === state.season && p.week === state.week && matches(p));
      $("phases").innerHTML = phaseSections(list, state.season, state.week);
      afterDraw();
    };
    redraw(true);
  }

  function openPage() {
    hero("Not graded yet", `Open <em>${openNow.length}</em>`, openNow.length
      ? "Every pick still to be settled, soonest first. Before the start, each ticket shows where the line and price have gone since the pick; once it starts, the close is locked in."
      : "Nothing open right now. New picks go up once the books post lines and the model finds value.");
    $("app").innerHTML = `<section><div id="tb"></div><div id="phases" class="phases"></div></section>`;
    redraw = (full) => {
      if (full !== false || !$("q")) $("tb").innerHTML = toolbar("");
      const list = openNow.filter(matches);
      $("phases").innerHTML = jumpBar(list, PHASES.slice(0, 2)) + PHASES.slice(0, 2).map(([ph, title, sub]) => { const ps = list.filter((p) => p.phase === ph);
        return `<details class="phase ph-${ph}" id="ph-${ph}"${ps.length ? " open" : ""}><summary><span class="ph-t">${title}<span class="count">${ps.length}</span></span><span class="ph-s">${sub}</span></summary>${ps.length ? picksBlock(ps) : `<div class="empty">Nothing ${title.toLowerCase()} right now.</div>`}</details>`; }).join("");
      afterDraw();
    };
    redraw(true); revealHash();
  }

  function resultsPage() {
    hero("Results", `${PERIOD} by <em>${PERIOD.toLowerCase()}</em>`, "Every graded pick, every market, at the size on its ticket and the stamped price. Tap a row to open that " + PERIOD.toLowerCase() + ".");
    const keys = [...new Set(MK.flatMap((k) => Object.keys(MKT(k).weeks)))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const cards = keys.map((key) => { const [season, w] = key.split("-");
      return `<a class="wkcard" href="${href(F.home)}?season=${season}&week=${w}"><div class="wk-h"><b>${PERIOD} ${w}</b><span class="muted">${season}</span></div>
        <div class="wk-m">${MK.map((k) => `<div><em>${esc(MKT(k).short || MKT(k).label)}</em><span>${recLine(MKT(k).weeks[key])}</span></div>`).join("")}</div><span class="wk-go">Open &rarr;</span></a>`; }).join("");
    const r = latestRecap();
    $("app").innerHTML = `${r ? `<section>${recapCard(r)}</section>` : ""}
      <section><div><div class="eyebrow">Season to date</div><h2>Totals</h2></div><div class="boards light">${MK.map((k) => { const P = MKT(k);
        return `<a class="sb" href="${P.slug}.html"><div class="sb-h"><span>${esc(P.label)}</span>${P.paper ? `<span class="chip paper">paper</span>` : `<span class="chip rec">the record</span>`}</div>${tote(P.record, P, true)}</a>`; }).join("")}</div>
        <div class="charts">${MK.map((k) => unitsChart(MKT(k))).join("")}</div></section>
      <section><div><div class="eyebrow">Newest first</div><h2>Every ${PERIOD.toLowerCase()}</h2></div><div class="wkcards">${cards || `<div class="empty">No graded ${PERIOD.toLowerCase()}s yet.</div>`}</div></section>`;
  }

  function marketPage(key) {
    const P = MKT(key);
    if (!P) { $("app").innerHTML = `<div class="empty">Nothing here yet.</div>`; return; }
    hero(`${P.paper ? "Research desk &middot; paper picks" : "The record"} &middot; since ${D.since}`, esc(P.label), esc(P.blurb), tote(P.record, P));
    const linked = byId[decodeURIComponent(location.hash.slice(1))];
    if (linked && linked.prop === key) { state.season = linked.season; state.week = linked.week; }
    if (state.week == null) state.week = "all";
    state.market = key;
    const filters = [["all", "All", () => true], ["open", "Open", (p) => p.phase === "open"], ["live", "Live", (p) => p.phase === "live"], ["W", "Won", (p) => p.result === "W"], ["L", "Lost", (p) => p.result === "L"],
      ["agrees", "Sharp agrees", (p) => p.sharp === "agrees"], ["against", "Sharp against", (p) => p.sharp === "against"]];
    let active = "all";
    $("app").innerHTML = `
      <section><div class="head"><div><div class="eyebrow">Each pick at its ticket size &middot; 1u each alongside</div><h2>Record</h2></div></div>${recordTable(P.record)}${unitsChart(P)}
        ${P.record.some((r) => r.label === "Pre-launch") ? `<p class="note"><span class="chip pre">pre-launch</span> picks were made by the same model and time-stamped in our private ledger, but not posted publicly before the start. From ${esc(D.launch)} on, every pick is posted before the start.</p>` : ""}</section>
      <section><div class="head"><div><div class="eyebrow">Newest first</div><h2>Every pick</h2></div></div><div id="tb"></div><div id="picks" class="weekgroups"></div></section>`;
    document.addEventListener("click", (e) => { const b = e.target.closest("#chips button[data-k]"); if (b) { active = b.dataset.k; redraw(false); } });
    redraw = (full) => {
      if (full !== false || !$("pk-season")) $("tb").innerHTML = toolbar(pickers(P.picks, true), false, `<div class="filters" id="chips" role="group" aria-label="Show"></div>`);
      const scope = P.picks.filter((p) => p.season === state.season && (state.week === "all" || p.week === state.week) && matches(p));
      const f = filters.find((x) => x[0] === active)[2], shown = scope.filter(f);
      $("chips").innerHTML = filters.filter(([k, , g]) => k === "all" || scope.some(g)).map(([k, l, g]) => `<button type="button" data-k="${k}" aria-pressed="${k === active}">${l}<span>${scope.filter(g).length}</span></button>`).join("");
      const ws = [...new Set(shown.map((p) => p.week))].sort((a, b) => b - a);
      $("picks").innerHTML = ws.length ? ws.map((w) => `<div class="weekgroup"><div class="weekhead"><h3>${PERIOD} ${w} <span class="muted">${state.season}</span></h3><span class="mono">${recLine(periodRec(P, state.season, w))}</span></div>${picksBlock(shown.filter((p) => p.week === w).sort(byKick), false)}</div>`).join("")
        : `<div class="empty">No picks match.</div>`;
      afterDraw();
    };
    redraw(true); revealHash();
  }

  function clvPage() {
    hero("The scoreboard", "Closing line <em>value</em>", "Did we get a better number than the market's final price? Over hundreds of picks, that is the clearest sign of a real edge, far more than win-loss.");
    if (!MK.length) { $("app").innerHTML = `<div class="empty">No ${esc(SPORT.name)} picks have closed yet. Closing line value shows up here once they do.</div>`; return; }
    const cards = MK.map((k) => { const P = MKT(k), r = P.record[0] || {};
      const cells = [["Value vs close", pct(r.clv_ev), tone(r.clv_ev), `what each pick was worth against the closing price, vig removed (n=${r.n_clv || 0}${(r.n_clv || 0) < 50 ? ", too early to judge" : ""})`],
        ["Beat the close", r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%", "", "better line, or same line at a better price"],
        ["Avg line move", r.clv == null ? "&ndash;" : `${sgn(r.clv)}${r.clv.toFixed(1)} ${P.unit}`, tone(r.clv), "from the pick to the close"],
        ["Moved our way", r.toward == null ? "&ndash;" : r.toward.toFixed(0) + "%", "", `of the ${r.n_moved || 0} lines that moved`]];
      return `<article class="clvcard"><div class="sb-h2"><span>${esc(P.label)}</span>${P.paper ? `<span class="chip paper">paper</span>` : `<span class="chip pre">the record</span>`}</div>
        <div class="clvgrid">${cells.map(([h, v, c, s]) => `<div><small>${h}</small><b class="${c}">${v}</b><span>${s}</span></div>`).join("")}</div></article>`; }).join("");
    const charts = MK.map((k) => { const P = MKT(k), g = recordPicks(P).filter((p) => p.clv_ev != null).sort((a, b) => (a.serial < b.serial ? -1 : 1));
      let s = 0; const run = g.map((p, i) => (s += p.clv_ev) / (i + 1));
      return lineChart(run, `${esc(P.label)} <span class="muted">running value vs close, ${g.length} picks</span>`, run[run.length - 1], (v) => pct(v)); }).join("");
    const short = (k) => esc(MKT(k).short || MKT(k).label);
    const byWeek = MK.flatMap((k) => Object.entries(MKT(k).weeks).map(([key, r]) => ({ k, key, r }))).sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }) || MK.indexOf(a.k) - MK.indexOf(b.k));
    const bySharp = MK.flatMap((k) => MKT(k).record.filter((r) => /^Sharp|^No sharp/.test(r.label)).map((r) => ({ k, r })));
    const row = (label, r, P) => `<tr><td>${label}</td><td class="num opt">${r.n_clv || 0}</td><td class="num key ${tone(r.clv_ev)}">${pct(r.clv_ev)}</td><td class="num">${r.beat == null ? "&ndash;" : r.beat.toFixed(0) + "%"}</td><td class="num opt ${tone(r.clv)}">${r.clv == null ? "&ndash;" : sgn(r.clv) + r.clv.toFixed(1) + " " + P.unit}</td></tr>`;
    const table = (rows) => `<div class="tablebox"><table><thead><tr><th>Picks</th><th class="num opt">Closes</th><th class="num key">Value vs close</th><th class="num">Beat close</th><th class="num opt">Avg move</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const graded = allPicks.filter((p) => p.clv_ev != null).sort((a, b) => b.clv_ev - a.clv_ev);
    const mini = (p) => `<a class="mini" href="${pageOf(p)}?season=${p.season}&week=${p.week}#${p.serial}"><span><b>${esc(p.player)}</b> ${p.side} ${p.line} <span class="muted">${odds(p.price)} &middot; ${short(p.prop)} &middot; ${PERIOD.toLowerCase()} ${p.week}</span></span><span class="mono ${tone(p.clv_ev)}">${pct(p.clv_ev)}</span></a>`;
    $("app").innerHTML = `<section><div class="clvcards">${cards}</div></section>
      ${charts ? `<section><div><div class="eyebrow">Is the edge holding?</div><h2>Over time</h2></div><p class="lede">The running average of value vs close, pick by pick. Early on it swings; what matters is where it settles.</p><div class="charts">${charts}</div></section>` : ""}
      <section><div><div class="eyebrow">${PERIOD} by ${PERIOD.toLowerCase()}</div><h2>By ${PERIOD.toLowerCase()}</h2></div>${table(byWeek.map(({ k, key, r }) => row(`${PERIOD} ${key.split("-")[1]} <span class="muted">${key.split("-")[0]} &middot; ${short(k)}</span>`, r, MKT(k))).join(""))}</section>
      ${bySharp.length ? `<section><div><div class="eyebrow">Model + sharp money</div><h2>By Sharp label</h2></div><p class="lede">Did the picks the sharp money finished on do better at the close?</p>${table(bySharp.map(({ k, r }) => row(`${esc(r.label)} <span class="muted">${short(k)}</span>`, r, MKT(k))).join(""))}</section>` : ""}
      ${graded.length ? `<section><div><div class="eyebrow">Tap one to see its ticket</div><h2>Best and worst closes</h2></div><div class="minis"><div><h3>Best</h3>${graded.slice(0, 5).map(mini).join("")}</div><div><h3>Worst</h3>${graded.slice(-5).reverse().map(mini).join("")}</div></div></section>` : ""}`;
  }

  function playerPage() {
    const id = new URLSearchParams(location.search).get("id");
    const ps = allPicks.filter((p) => p.pid === id).sort((a, b) => (b.kick_utc || "").localeCompare(a.kick_utc || ""));
    if (!ps.length) {
      hero("Player", "Not found", "No picks on this player yet.");
      $("app").innerHTML = `<div class="empty">Nothing here. <a href="${href(F.home)}">Back to this ${PERIOD.toLowerCase()}</a></div>`;
      return;
    }
    const p0 = ps[0], graded = ps.filter((p) => p.result && p.result !== "VOID"), clvs = ps.filter((p) => p.clv_ev != null);
    const count = (r) => graded.filter((p) => p.result === r).length;
    const units = graded.reduce((s, p) => s + (p.pl_u || 0), 0);           // at each ticket's size, like the record
    const clv = clvs.length ? clvs.reduce((s, p) => s + p.clv_ev, 0) / clvs.length : null;
    const markets = [...new Set(ps.map((p) => MKT(p.prop).short || MKT(p.prop).label))].join(" &middot; ");
    const cells = [["Record", graded.length ? `${count("W")}-${count("L")}${count("P") ? "-" + count("P") : ""}` : "&ndash;", ""],
      ["Units", graded.length ? `${num(units, 2, true)}u` : "&ndash;", tone(units)], [`Value vs close${earlyNote(clvs.length)}`, pct(clv), tone(clv)],
      ["Picks", String(ps.length), ""]];
    hero(`${esc(p0.team)} &middot; ${markets}`, esc(p0.player),
      `Every pick the model made on ${esc(p0.player)}, newest first, graded at the size on its ticket and the stamped price.${ps.some((p) => p.paper) ? " Paper picks (tracked, not bet) are marked." : ""}`,
      `<div class="rc-grid hero-stats">${cells.map(([h, v, c]) => `<div><small>${h}</small><b class="${c}">${v}</b></div>`).join("")}</div>`);
    $("app").innerHTML = `<section><div class="toolbar"><span class="tb-r">${viewBar()}</span></div><div id="picks" class="weekgroups"></div></section>`;
    redraw = () => {
      $("picks").innerHTML = [...new Set(ps.map((p) => `${p.season}-${p.week}`))].map((k) => {
        const [s, w] = k.split("-"), g = ps.filter((p) => `${p.season}-${p.week}` === k);
        return `<div class="weekgroup"><div class="weekhead"><h3>${PERIOD} ${w} <span class="muted">${s}</span></h3></div>${picksBlock(g, false)}</div>`; }).join("");
      afterDraw();
    };
    redraw(); revealHash();
  }

  function soonPage() {
    hero(`${esc(SPORT.name)} &middot; coming soon`, `${esc(SPORT.name)} <em>props</em>`,
      `The ${esc(SPORT.name)} model is in the works. When it's ready, its picks get the same treatment as every other sport here: stamped when made, posted before ${esc(SPORT.event || "the start")}, graded against the closing line, and never edited.`);
    $("app").innerHTML = `
      <section><div class="head"><div><div class="eyebrow">${PERIOD} at a glance</div><h2>Today's board</h2></div></div>
        <div class="phases">${phaseSections([], null, null)}</div></section>
      <section><div><div class="eyebrow">What to expect</div><h2>Same ledger, new sport</h2></div><div class="steps">
        <div><h3>One slate a ${PERIOD.toLowerCase()}</h3><p>Picks are grouped by ${PERIOD.toLowerCase()}, with the same Open, Live and Final sections, views and search.</p></div>
        <div><h3>Its own record</h3><p>Each market gets its own page and record, graded at the stamped price and size, kept apart from the other sports.</p></div>
        <div><h3>Same scoreboard</h3><p>Closing line value, the Sharp label and the weekly recap all work the same way.</p></div></div></section>
      ${notify()}`;
  }

  function method() {
    hero("How it works", "Stamped, posted, <em>graded at the close.</em>", "What every number on this site means, and why the closing line is the scoreboard.");
    $("app").innerHTML = `
      <section><div class="steps">
        <div><h3>Stamp</h3><p>The model prices every player the books post. When it finds value, the pick, line and price are stamped and frozen, with a serial number. Later runs never change them, and nothing is ever removed.</p></div>
        <div><h3>Post</h3><p>Picks go up before the start. Every update to this site is a public commit, so anyone can check when a pick was posted in the site's history.</p></div>
        <div><h3>Grade</h3><p>After the game the result comes from official stats, and the pick's line and price are compared with the closing market, win or lose.</p></div></div></section>
      <section><div><div class="eyebrow">Reading a ticket</div><h2>The views</h2></div><dl class="defs">
        <dt>Tickets</dt><dd>The full ticket: the line and price bars (pick on the left, close or now on the right), model numbers, and the details drawer.</dd>
        <dt>Compact</dt><dd>One slim stub per pick: status, CLV and the sharp lean at a glance. Tap it to open the full ticket.</dd>
        <dt>List</dt><dd>A dense table. Tap a row to open its ticket.</dd>
        <dt>Open / Live / Final</dt><dd>Open: not started yet. Live: in progress, or finished and waiting for official stats ("Final &middot; grading"). Final: graded.</dd></dl></section>
      <section><div><div class="eyebrow">The scoreboard</div><h2>Closing line value</h2></div><dl class="defs">
        <dt>Value vs close</dt><dd>What the pick was worth against the closing market, with the bookmaker's cut removed. A pick at exactly the closing line at -110 scores about -4.5%; above 0% means beating the close by more than the cut. "n" is how many picks it's based on: under 50 is too early to judge.</dd>
        <dt>Beat the close</dt><dd>The pick got a better line than the close, or the same line at a better price.</dd>
        <dt>Line and price bars</dt><dd>How far the line, and the price at the same line, moved from the pick to the close (or to now). Green means toward the pick: the market came to us.</dd>
        <dt>Playable to</dt><dd>The worst price at the stamped line where the pick still clears our value bar (expected value of at least ${D.min_ev ?? 2}%).</dd>
        <dt>Units</dt><dd>Every ticket shows the model's size for that pick, in units: a quarter of the Kelly stake at the stamped price, at most 2u, so a bigger edge gets a bigger size. The rule is the same every week and the size never changes after the pick is posted. The record grades each pick at that size (Units, ROI on the units risked), and also flat at 1 unit per pick (1u each), so you can judge the picks alone. What a unit is worth is up to you: the model posts dozens of picks a week, so most people use a small slice of their bankroll per unit.</dd></dl></section>
      <section><div><div class="eyebrow">Model + sharp money</div><h2>The Sharp label</h2></div>
        <p class="lede">Pinnacle is the sharpest sportsbook. For every pick we read Pinnacle's line for the same player and ask which side its prices favour at our line. The label stays current until the start, then locks on Pinnacle's closing line (marked "close").</p>
        <dl class="defs"><dt>Sharp agrees</dt><dd>Pinnacle priced our side as the likelier winner.</dd><dt>Sharp neutral</dt><dd>A coin flip at our line.</dd><dt>Sharp against</dt><dd>Pinnacle priced the other side as the likelier winner.</dd><dt>No sharp line</dt><dd>Pinnacle didn't list the player.</dd></dl></section>
      ${notify()}
      <section><div><div class="eyebrow">Honesty notes</div><h2>What's on the record</h2></div><dl class="defs">
        ${MK.map((k) => `<dt>${esc(MKT(k).label)}</dt><dd>${esc(MKT(k).blurb)}</dd>`).join("")}
        <dt>Pre-launch</dt><dd>Picks made before this site went public (${esc(D.launch)}) are shown and counted, tagged pre-launch, because their time stamps come from our private ledger.</dd></dl></section>`;
  }

  setTimeout(() => { reveal(); countUp(); }, 0);
  const PAGES = { home, open: openPage, results: resultsPage, clv: clvPage, method, soon: soonPage, player: playerPage, market: () => marketPage(pageMarket) };
  (PAGES[page] || home)();
})();
