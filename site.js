// Shared behaviour for the homepage, About and Tools: the receipts switch, the hero gate,
// the build index, and the listening card. Live data comes from one small Worker; when it
// cannot be reached, each piece falls back to what is written in the page.
(() => {
  const LIVE = "https://pranavgudise-live.pg2342.workers.dev";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* receipts: show the measured result of every build */
  const sw = document.getElementById("rcpt");
  const setReceipts = (on) => {
    document.documentElement.classList.toggle("receipts", on);
    if (sw) sw.setAttribute("aria-checked", String(on));
  };
  setReceipts(store.get("site.receipts") === "1");
  sw && sw.addEventListener("click", () => {
    const on = sw.getAttribute("aria-checked") !== "true";
    setReceipts(on);
    store.set("site.receipts", on ? "1" : "0");
  });

  /* hero: the freight agent's last model gate, square by square, then its rollout */
  const gate = document.getElementById("gate");
  if (gate) {
    const sq = gate.querySelector(".gate__sq");
    const n = Number(gate.dataset.n || 25);
    sq.innerHTML = "<i></i>".repeat(n);
    const cells = [...sq.children];
    const score = gate.querySelector(".gate__score b");
    const steps = [...gate.querySelectorAll(".roll span")];
    const play = () => {
      gate.classList.remove("done");
      cells.forEach((c) => c.classList.remove("on"));
      steps.forEach((s) => s.classList.remove("on"));
      if (reduce) {
        cells.forEach((c) => c.classList.add("on"));
        steps.forEach((s) => s.classList.add("on"));
        score.textContent = n;
        gate.classList.add("done");
        return;
      }
      score.textContent = "0";
      cells.forEach((c, i) => setTimeout(() => { c.classList.add("on"); score.textContent = i + 1; }, 300 + i * 70));
      const end = 300 + n * 70;
      setTimeout(() => gate.classList.add("done"), end + 150);
      steps.forEach((s, i) => setTimeout(() => s.classList.add("on"), end + 450 + i * 420));
    };
    play();
    let replay = 0;
    gate.addEventListener("mouseenter", () => { if (Date.now() - replay > 4000) { replay = Date.now(); play(); } });
    fetch(`${LIVE}/freight`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!d || !d.current) return;
      gate.querySelector("[data-v]").textContent = `${d.current} serving`;
    }).catch(() => {});
  }

  /* counts: any element marked data-count shows the live number from the build list */
  if (window.BUILDS) {
    const all = window.BUILDS.builds;
    document.querySelectorAll("[data-count]").forEach((el) => {
      const k = el.dataset.count;
      el.textContent = k === "total" ? all.length : all.filter((b) => b.cat === k).length;
    });
  }

  /* the build index */
  const idx = document.querySelector(".idx");
  if (idx && window.BUILDS) {
    const { builds, selected } = window.BUILDS;
    const by = Object.fromEntries(builds.map((b) => [b.repo, b]));
    const KINDS = { evals: "Eval", "go-live-gates": "Go-live gate", "rollout-readiness": "Rollout check", agents: "Agent or tool" };
    const PAGES = { evals: ["evals", "builds/evals/"], "go-live-gates": ["go-live gates", "builds/go-live-gates/"], "rollout-readiness": ["rollout checks", "builds/rollout-readiness/"], agents: ["agents and tools", "builds/agents/"] };
    const list = idx.querySelector(".idx__names");
    const more = idx.querySelector(".idx__more");
    const card = idx.querySelector(".card");
    const shot = card.querySelector(".card__shot");
    const base = idx.dataset.base || "";
    const hoverOnly = idx.dataset.reveal === "hover";
    let view = idx.dataset.view || "selected";
    const PER_KIND = 6;
    const kindAll = (v) => builds.filter((b) => b.cat === v);
    const items = (v) => {
      if (v === "selected") return selected.map((r) => by[r]);
      const picked = (window.BUILDS.picks || {})[v];
      if (picked && picked.length) return picked.map((r) => by[r]).filter(Boolean);
      const all = kindAll(v);
      return [...all.filter((b) => b.featured), ...all.filter((b) => !b.featured && !b.code)].slice(0, PER_KIND);
    };
    const show = (b) => {
      if (!b) return;
      card.classList.add("on");
      if (card.dataset.repo === b.repo) return;
      card.dataset.repo = b.repo;
      card.classList.add("flip");
      setTimeout(() => {
        shot.classList.toggle("code", !b.thumb);
        if (b.thumb) {
          let img = shot.querySelector("img");
          if (!img) { img = document.createElement("img"); img.width = 800; img.height = 500; shot.append(img); }
          img.src = base + b.thumb; img.alt = `${b.name}: the first screen of its demo page`;
        }
        card.querySelector(".card__row b").textContent = b.name;
        card.querySelector(".card__kind").textContent = KINDS[b.cat];
        card.querySelector(".card__res").textContent = b.result;
        card.querySelector(".card__desc").textContent = b.desc;
        card.href = b.href;
        card.classList.remove("flip");
      }, reduce ? 0 : 120);
    };
    const render = () => {
      const bs = items(view);
      list.innerHTML = bs.map((b) => `<li><a href="${esc(b.href)}" data-repo="${esc(b.repo)}"><span class="n">${esc(b.name)}</span><span class="r">${esc(b.result)}</span>${b.thumb ? `<span class="t"><img src="${esc(base + b.thumb)}" alt="" loading="lazy" width="800" height="500"></span>` : `<span class="t"></span>`}</a></li>`).join("");
      const total = builds.length;
      if (view === "selected") {
        more.innerHTML = `${bs.length} of ${total} builds. <a href="${esc(idx.dataset.all || "builds/")}">See all ${total}, sorted by kind</a>.`;
      } else {
        const [label, href] = PAGES[view];
        const d = idx.querySelector(`.seg button[data-v="${view}"]`);
        const n = kindAll(view).length;
        const shown = n > bs.length ? `${bs.length} of ${n} ${label} here. <a href="${base}${href}">See all ${n} on the ${label} page</a>, with a line on each.` : `<a href="${base}${href}">Open the ${label} page</a> for a line on each.`;
        more.innerHTML = `${d && d.dataset.about ? esc(d.dataset.about) + " " : ""}${shown}`;
      }
      if (!hoverOnly) show(bs[0]); else { card.classList.remove("on"); delete card.dataset.repo; }
    };
    list.addEventListener("pointerover", (e) => { const a = e.target.closest("a[data-repo]"); a && show(by[a.dataset.repo]); });
    if (hoverOnly) {
      list.addEventListener("pointerleave", () => card.classList.remove("on"));
      list.addEventListener("focusout", (e) => { if (!list.contains(e.relatedTarget)) card.classList.remove("on"); });
    }
    list.addEventListener("focusin", (e) => { const a = e.target.closest("a[data-repo]"); a && show(by[a.dataset.repo]); });
    // warm the next thumbnails so a hover never waits
    const warm = () => items(view).forEach((b) => { if (b.thumb) { const i = new Image(); i.src = base + b.thumb; } });
    const seg = idx.querySelectorAll(".seg button");
    const pick = (v) => {
      if (v === view) return;
      view = v;
      seg.forEach((x) => x.setAttribute("aria-checked", String(x.dataset.v === v)));
      if (reduce) { render(); warm(); return; }
      list.classList.add("swap");
      setTimeout(() => { render(); list.classList.remove("swap"); warm(); }, 280);
    };
    seg.forEach((x) => x.addEventListener("click", () => pick(x.dataset.v)));
    more.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); b && pick(b.dataset.go); });
    render();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es, o) => { if (es.some((x) => x.isIntersecting)) { warm(); o.disconnect(); } }, { rootMargin: "400px" }).observe(idx);
    }
  }

  /* listening: the last song played, through Last.fm */
  const fm = document.getElementById("fm");
  if (fm) {
    const ago = (t) => {
      const s = Math.max(0, Date.now() / 1000 - t);
      if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
      if (s < 86400) return `${Math.round(s / 3600)} h ago`;
      const d = Math.round(s / 86400);
      return d === 1 ? "yesterday" : `${d} days ago`;
    };
    const paint = (t) => {
      fm.href = t.url;
      fm.querySelector("b").textContent = t.name;
      fm.querySelector(".fm__txt span").textContent = t.playing ? `${t.artist} · listening now` : `${t.artist} · ${ago(t.played_at)}`;
      fm.classList.toggle("playing", !!t.playing);
      if (t.art) {
        let art = fm.querySelector(".fm__art img");
        if (!art) { art = document.createElement("img"); art.alt = ""; fm.querySelector(".fm__art").prepend(art); }
        art.src = t.art;
      }
      fm.hidden = false;
    };
    fetch(`${LIVE}/now-playing`).then((r) => r.ok ? r.json() : null).then((t) => {
      if (t && t.name) paint(t);
    }).catch(() => {});
  }
})();

// contact: hover opens it on desktop; a tap or Enter toggles it, Escape and outside clicks close it
(() => {
  const w = document.getElementById("contact-menu-wrap");
  if (!w) return;
  const b = w.querySelector(".contact__btn");
  const set = (on) => { w.classList.toggle("open", on); b.setAttribute("aria-expanded", String(on)); };
  b.addEventListener("click", () => set(!w.classList.contains("open")));
  document.addEventListener("click", (e) => { if (!w.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { set(false); } });
})();

// the "New" line: a few recent updates that take turns, each sliding up and blurring out as the next arrives
(() => {
  const box = document.getElementById("news");
  if (!box) return;
  const NEWS = [
    ["Clinic voice agent: talk to it from the page", "https://pg2342-hub.github.io/clinic-voice-agent/"],
    ["Freight agent: v12 serving, 25 of 25 at its gate", "https://freight-appointment-agent.pg2342.workers.dev/"],
    ["Sourced memo gate: why Claude gets a NO-GO", "https://pranavgudise.dev/sourced-memo-gate/"],
  ];
  // the freight line comes from the agent's own release record when it can be reached
  fetch("https://pranavgudise-live.pg2342.workers.dev/freight").then((r) => r.ok ? r.json() : null).then((d) => {
    if (d && d.current && d.gate) NEWS[1][0] = `Freight agent: ${d.current} serving, ${d.gate.passed} of ${d.gate.of} at its gate`;
  }).catch(() => {});
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = box.querySelector(".sw");
  let i = 0, paused = false;
  box.addEventListener("pointerenter", () => { paused = true; });
  box.addEventListener("pointerleave", () => { paused = false; });
  box.addEventListener("focusin", () => { paused = true; });
  box.addEventListener("focusout", () => { paused = false; });
  setInterval(() => {
    if (paused || document.hidden) return;
    i = (i + 1) % NEWS.length;
    a.classList.add("is-exit");
    setTimeout(() => {
      a.textContent = NEWS[i][0]; a.href = NEWS[i][1];
      a.classList.remove("is-exit"); a.classList.add("is-enter");
      void a.offsetWidth;
      a.classList.remove("is-enter");
    }, 320);
  }, 3800);
})();

// homepage: one scroll gesture moves a whole screen, hero to work and back, and then settles
(() => {
  const root = document.documentElement;
  if (!root.classList.contains("home")) return;
  const hero = document.querySelector(".hx"), panel = document.querySelector(".panel");
  if (!hero || !panel) return;
  const on = () => matchMedia("(min-width: 1001px) and (min-height: 620px)").matches;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lock = 0;
  const go = (el) => {
    lock = Date.now() + (reduce ? 200 : 900);
    window.scrollTo({ top: el.offsetTop, behavior: reduce ? "auto" : "smooth" });
  };
  const atHero = () => scrollY < panel.offsetTop - 4;
  const atPanelTop = () => Math.abs(scrollY - panel.offsetTop) < 4;
  addEventListener("wheel", (e) => {
    if (!on() || e.ctrlKey) return;
    if (Date.now() < lock) { e.preventDefault(); return; }
    if (e.deltaY > 4 && atHero()) { e.preventDefault(); go(panel); }
    else if (e.deltaY < -4 && (atPanelTop() || (scrollY < panel.offsetTop + 4 && !atHero()))) { e.preventDefault(); go(hero); }
  }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!on() || e.target.closest("input, textarea, select")) return;
    const down = ["PageDown", "ArrowDown", " "].includes(e.key) && !e.shiftKey;
    const up = ["PageUp", "ArrowUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (down && atHero()) { e.preventDefault(); go(panel); }
    else if (up && atPanelTop()) { e.preventDefault(); go(hero); }
  });
  // links to #work land on the panel the same way
  document.querySelectorAll('a[href="#work"]').forEach((a) => a.addEventListener("click", (e) => { if (on()) { e.preventDefault(); go(panel); } }));
})();

// page change: the band sweeps in over this page, the next page opens under it, and the band sweeps off
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clear = () => root.classList.remove("sw-cover", "sw-arrive", "sw-go");
  if (root.classList.contains("sw-arrive")) {
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("sw-go")));
    setTimeout(clear, 760);
  }
  addEventListener("pageshow", (e) => { if (e.persisted) clear(); });
  if (reduce) return;
  // only the site's own pages: the header links, the logo, and the links into the full build list
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".top .nav a, .top .brand, .idx__more a, .hx__commits");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    e.preventDefault();
    try { sessionStorage.setItem("sw", "1"); } catch (err) {}
    root.classList.add("sw-cover");
    setTimeout(() => { location.href = url.href; }, 470);
  });
})();

// commits: the About wall and the homepage grid redraw from live counts when the Worker has them
(() => {
  const wall = document.querySelector(".ab2__wall .wall");
  const mini = document.querySelector(".wall--mini");
  if (!wall && !mini) return;
  const ORDER = ["agents", "evals", "go-live-gates", "rollout-readiness", "other"];
  const kindOf = {};
  (window.BUILDS ? window.BUILDS.builds : []).forEach((b) => { kindOf[b.repo] = b.cat; });
  const names = {};
  (window.BUILDS ? window.BUILDS.builds : []).forEach((b) => { names[b.repo] = b.name; });
  fetch("https://pranavgudise-live.pg2342.workers.dev/commits").then((r) => r.ok ? r.json() : null).then((d) => {
    if (!d || !d.repos || !d.total) return;
    const by = Object.fromEntries(ORDER.map((k) => [k, []]));
    d.repos.forEach((r) => by[kindOf[r.name] || "other"].push(r));
    const sums = Object.fromEntries(ORDER.map((k) => [k, by[k].reduce((s, r) => s + r.commits, 0)]));
    document.querySelectorAll('[data-commits="total"]').forEach((el) => { el.textContent = d.total; });
    document.querySelectorAll('[data-commits="repos"]').forEach((el) => { el.textContent = d.repos.length; });
    document.querySelectorAll("[data-commits-kind]").forEach((el) => { el.textContent = sums[el.dataset.commitsKind]; });
    if (wall) {
      wall.innerHTML = ORDER.map((k) => by[k].sort((a, b) => b.commits - a.commits).map((r) =>
        `<i data-k="${k}" title="${(names[r.name] || r.name).replace(/"/g, "&quot;")}"></i>`.repeat(r.commits)).join("")).join("");
      wall.setAttribute("aria-label", `${d.total} commits: ` + ORDER.map((k) => `${k} ${sums[k]}`).join(", ") + ".");
    }
    if (mini) {
      // 108 squares, each about total/108 commits, in proportion to the kinds
      const cells = 108, seq = [];
      ORDER.forEach((k) => { for (let i = 0; i < Math.round((sums[k] / d.total) * cells); i++) seq.push(k); });
      while (seq.length < cells) seq.push("other");
      mini.innerHTML = seq.slice(0, cells).map((k) => `<i data-k="${k}"></i>`).join("");
    }
  }).catch(() => {});
})();
