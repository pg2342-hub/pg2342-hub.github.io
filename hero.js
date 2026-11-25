// The hero: a go-live gate. Work drifts in from the left, blurred and unsorted: email threads,
// calls, screenshots, requests. At the gate each item comes into focus and gets a verdict, then
// moves into one of three lanes: went live, handed to a person, or blocked. The lane counts are
// the items you watched cross, counted from when the page opened.
(() => {
  const field = document.querySelector(".hx__field");
  if (!field) return;
  const layers = [...field.querySelectorAll("canvas")];
  const ctxs = layers.map((c) => c.getContext("2d"));
  const over = field.querySelector(".hx__tags");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COL = { pass: "#3f6b55", hand: "#8f8b82", block: "#8f8b82" };
  const LANES = [
    { v: "pass", label: "Went live", y: .26 },
    { v: "hand", label: "To a person", y: .52 },
    { v: "block", label: "Blocked", y: .78 },
  ];
  // what crosses the gate, and what happened to it: the same calls the builds on this site make
  const CASES = {
    pass: [["call", "Inbound call", "Booked, then read back"], ["mail", "Email thread", "Dock slot booked by email"], ["shot", "Screenshot", "3 findings pinned"], ["ticket", "Change request", "Draft saved for approval"], ["mail", "Load tender", "Posted to the TMS"]],
    hand: [["ticket", "Refund request", "Over $200, to a person"], ["call", "Caller in crisis", "Straight to a clinician"], ["mail", "OFAC hit", "To an analyst with a brief"], ["call", "Medication question", "To the care team"]],
    block: [["ticket", "Memo section", "Invented citation"], ["mail", "Outbound email", "Contact opted out"], ["ticket", "Batch load", "Totals do not tie"]],
  };
  const KINDS = ["mail", "call", "shot", "ticket"];

  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pickV = () => { const r = rnd(); return r < .66 ? "pass" : r < .88 ? "hand" : "block"; };

  // glyphs: one small drawing per kind of input
  const glyph = (ctx, kind, u, fill, line) => {
    ctx.fillStyle = fill;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
    if (kind === "mail") { rr(-14 * u, -10 * u, 28 * u, 20 * u, 3 * u); ctx.strokeStyle = line; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(-12 * u, -8 * u); ctx.lineTo(0, 1 * u); ctx.lineTo(12 * u, -8 * u); ctx.stroke(); }
    else if (kind === "call") { rr(-8 * u, -15 * u, 16 * u, 30 * u, 4 * u); ctx.fillStyle = line; rr(-4 * u, 10 * u, 8 * u, 2 * u, 1 * u); }
    else if (kind === "shot") { rr(-16 * u, -11 * u, 32 * u, 22 * u, 3 * u); ctx.fillStyle = line; rr(-12 * u, -6 * u, 11 * u, 12 * u, 1.5 * u); rr(2 * u, -6 * u, 10 * u, 3 * u, 1 * u); rr(2 * u, 0, 7 * u, 3 * u, 1 * u); }
    else { rr(-11 * u, -14 * u, 22 * u, 28 * u, 3 * u); ctx.fillStyle = line; for (let k = 0; k < 3; k++) rr(-7 * u, (-8 + k * 6) * u, (k === 2 ? 8 : 14) * u, 2.4 * u, 1 * u); }
  };

  let W = 0, H = 0, G = 0, U = 1, END = 0;
  const size = () => {
    const r = field.getBoundingClientRect();
    W = r.width; H = r.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    layers.forEach((c) => { c.width = W * dpr; c.height = H * dpr; });
    ctxs.forEach((x) => x.setTransform(dpr, 0, 0, dpr, 0, 0));
    G = W * (W < 700 ? .42 : .5);
    END = W - (W < 700 ? 104 : Math.max(220, W * .16));
    U = Math.max(.7, Math.min(1.05, W / 1350));
    gateEl.style.left = `${G}px`;
    laneEls.forEach((el, i) => { el.style.top = `${LANES[i].y * H}px`; });
  };

  // the gate and the lane labels are HTML, so their text stays crisp
  over.innerHTML = `<div class="gt"><span class="gt__h">Go-live gate</span></div>` +
    LANES.map((l) => `<div class="ln ln--${l.v}"><b>${l.label}</b><span class="mono">0</span></div>`).join("") +
    `<div class="vt" hidden><b></b><span></span></div>`;
  const gateEl = over.querySelector(".gt");
  const laneEls = [...over.querySelectorAll(".ln")];
  const counts = { pass: 0, hand: 0, block: 0 };
  const vt = over.querySelector(".vt");
  let vtUntil = 0, vtItem = null;

  const items = [];
  const spawn = (x) => {
    const z = rnd();
    const v = pickV();
    const c = CASES[v][Math.floor(rnd() * CASES[v].length)];
    items.push({
      x, y: .1 + rnd() * .8, z, layer: z < .4 ? 0 : z < .75 ? 1 : 2,
      kind: rnd() < .55 ? c[0] : KINDS[Math.floor(rnd() * 4)], c, v,
      vx: 34 + z * 46, ph: rnd() * 6.28, crossed: false, ly: 0, a: 1,
    });
  };

  const laneY = (v) => LANES.find((l) => l.v === v).y;
  const step = (dt, t) => {
    for (const it of items) {
      const px = it.x * W;
      if (!it.crossed) {
        it.x += (it.vx * dt) / W;
        it.y += Math.sin(t * .6 + it.ph) * .0004;
        if (it.x * W >= G) {
          it.crossed = true; it.ly = it.y;
          counts[it.v]++;
          laneEls[LANES.findIndex((l) => l.v === it.v)].querySelector("span").textContent = counts[it.v];
          if (t > vtUntil - .5) { vtItem = it; vtUntil = t + 1.8; }
        }
      } else {
        it.x += (62 * dt) / W;
        it.ly += (laneY(it.v) - it.ly) * Math.min(1, dt * 2.2);
        const end = END / W;
        if (it.x > end - .08) it.a = Math.max(0, (end - it.x) / .08);
      }
    }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].a <= 0) items.splice(i, 1);
    const pre = items.filter((i) => !i.crossed).length;
    const want = W < 700 ? 18 : 30;
    if (pre < want && rnd() < .5) spawn(-.04);
  };

  const draw = (t) => {
    ctxs.forEach((x) => x.clearRect(0, 0, W, H));
    const sharp = ctxs[3];
    // lane guides past the gate
    for (const it of items) {
      if (!it.crossed) {
        const ctx = ctxs[it.layer];
        ctx.save(); ctx.translate(it.x * W, it.y * H); ctx.globalAlpha = .14 + it.z * .32;
        glyph(ctx, it.kind, (.6 + it.z * .55) * U, "#6f6c64", "#d8d5cc");
        ctx.restore();
      } else {
        const x = it.x * W, y = it.ly * H, col = COL[it.v];
        sharp.save(); sharp.translate(x, y); sharp.globalAlpha = it.a;
        if (it.v === "block") { sharp.globalAlpha = it.a * .9; glyph(sharp, it.kind, .8 * U, "#dcd9d1", "#ffffff"); sharp.strokeStyle = col; sharp.lineWidth = 1.2; sharp.beginPath(); sharp.roundRect(-15 * U, -15 * U, 30 * U, 30 * U, 4 * U); sharp.stroke(); }
        else glyph(sharp, it.kind, .8 * U, col, "#ffffff");
        sharp.restore();
      }
    }
    // the verdict tag rides with the item that just crossed
    if (false) {
      vt.hidden = false;
      vt.className = `vt vt--${vtItem.v}`;
      vt.querySelector("b").textContent = vtItem.c[1];
      vt.querySelector("span").textContent = vtItem.c[2];
      vt.style.transform = `translate(${Math.round(vtItem.x * W + 22 * U)}px, ${Math.round(vtItem.ly * H - 14)}px)`;
    } else vt.hidden = true;
  };

  size();
  // start with a full field: items on their way in, and some already sorted
  for (let k = 0; k < (W < 700 ? 18 : 30); k++) spawn(-.04 + rnd() * (G / W + .02));
  // the opening frame shows a typical day: most work goes live, some goes to a person, one is blocked
  ["pass", "pass", "hand", "pass", "pass", "hand", "pass", "block", "pass"].forEach((v, k) => {
    spawn(G / W + .02 + ((k + rnd() * .6) / 9) * (END / W - G / W - .1));
    const it = items[items.length - 1];
    it.v = v; it.c = CASES[v][Math.floor(rnd() * CASES[v].length)]; it.crossed = true; it.ly = laneY(v); counts[v]++;
  });
  LANES.forEach((l, i) => { laneEls[i].querySelector("span").textContent = counts[l.v]; });
  addEventListener("resize", () => { size(); if (reduce) draw(0); });
  if (reduce) { draw(0); return; }

  let on = true, last = performance.now();
  new IntersectionObserver((es) => { on = es[0].isIntersecting; if (on) { last = performance.now(); requestAnimationFrame(loop); } }).observe(field);
  function loop(now) {
    if (!on) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    step(dt, now / 1000); draw(now / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
