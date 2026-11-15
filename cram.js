/* Cram mode: short quiz rounds with XP, levels, streaks and badges.
   All questions are generated from the guide's own data (papers, glossary, concepts, threads, wiki limits).
   Progress is stored in this browser only (localStorage, key qual1.cram). */
(function () {
  "use strict";
  window.CramModule = function (X) {
    var G = X.G, WK = X.WK, esc = X.esc, store = X.store, papers = X.papers, byId = X.byId, topics = X.topics,
      concepts = X.concepts, conceptBy = X.conceptBy;

    var KEY = "qual1.cram";
    var LEVELS = [["Fresh reader", 0], ["Highlighter", 150], ["Margin scribbler", 400], ["Methyl marker", 800],
      ["Clock watcher", 1300], ["Plasticity pro", 2000], ["Committee ready", 3000], ["Qualified", 4500]];
    var GOAL = 120;
    var COMBO_CAP = 5;

    /* ---------- saved state ---------- */
    function fresh() {
      return { xp: 0, days: [], goalDays: [], badges: {}, m: {}, skim: [], daily: { d: "", xp: 0 },
        st: { answered: 0, correct: 0, bestCombo: 0, runs: 0, perfect: 0, boss: 0, term: 0, time: 0, holes: 0 } };
    }
    var S = store.get(KEY, null);
    if (!S || !S.st || !S.m) S = fresh();
    function save() { store.set(KEY, S); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function today() { return fmt(new Date()); }
    function dailyXp() { return S.daily.d === today() ? S.daily.xp : 0; }
    function streak() {
      var set = {}, d = new Date(), n = 0;
      S.days.forEach(function (x) { set[x] = 1; });
      if (!set[fmt(d)]) d.setDate(d.getDate() - 1);
      while (set[fmt(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    }
    function levelInfo(xp) {
      var i = 0, k;
      for (k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k][1]) i = k;
      var next = LEVELS[i + 1];
      return { i: i, name: LEVELS[i][0], next: next ? next[0] : null,
        left: next ? next[1] - xp : 0, pct: next ? Math.round(100 * (xp - LEVELS[i][1]) / (next[1] - LEVELS[i][1])) : 100 };
    }
    function addXp(n) {
      if (S.daily.d !== today()) S.daily = { d: today(), xp: 0 };
      S.daily.xp += n; S.xp += n;
      if (S.daily.xp >= GOAL && S.goalDays.indexOf(today()) < 0) S.goalDays.push(today());
    }
    function touchDay() {
      var t = today();
      if (S.days.indexOf(t) < 0) { S.days.push(t); if (S.days.length > 120) S.days.shift(); }
    }

    /* ---------- mastery (Leitner-style boxes 0..4) ---------- */
    function record(key, ok) {
      if (!key) return;
      var m = S.m[key] || { b: 0, c: 0, w: 0 };
      if (ok) { m.b = Math.min(4, m.b + 1); m.c++; } else { m.b = 0; m.w++; }
      S.m[key] = m;
    }
    function state(key) {
      var m = S.m[key];
      if (!m) return "new";
      if (m.b >= 3) return "mastered";
      if (m.b === 0) return "weak";
      return "learning";
    }
    var STATE_LABEL = { "new": "Not tried yet", weak: "Needs work", learning: "Learning", mastered: "Mastered" };
    function weight(key) {
      var m = S.m[key];
      if (!m) return 4;
      return [6, 3, 2, 1, 0.5][m.b];
    }

    /* ---------- helpers ---------- */
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function sample(a, n) { return shuffle(a).slice(0, n); }
    function wpick(items, keyFn, n) {
      var pool = items.slice(), out = [];
      while (out.length < n && pool.length) {
        var tot = 0, i;
        var ws = pool.map(function (x) { var w = weight(keyFn(x)); tot += w; return w; });
        var r = Math.random() * tot;
        for (i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) break; }
        if (i >= pool.length) i = pool.length - 1;
        out.push(pool.splice(i, 1)[0]);
      }
      return out;
    }
    function surname(p) { return p.cite.split(/[ ,]/)[0]; }
    function shareTheme(a, b) { return a.themes.some(function (t) { return b.themes.indexOf(t) > -1; }); }
    function distractorPapers(p, n) {
      var pool = shuffle(papers.filter(function (q) { return q.id !== p.id && surname(q) !== surname(p); }));
      var tiers = [
        pool.filter(function (q) { return q.topic === p.topic && shareTheme(p, q); }),
        pool.filter(function (q) { return q.topic === p.topic && !shareTheme(p, q); }),
        pool.filter(function (q) { return q.topic !== p.topic; })], out = [], seen = {};
      seen[p.cite] = 1;
      tiers.forEach(function (arr) { arr.forEach(function (q) { if (out.length < n && !seen[q.cite]) { seen[q.cite] = 1; out.push(q); } }); });
      return out;
    }
    function opts(right, wrong) {
      var seen = {}, list = [{ t: right, ok: true }];
      seen[right] = 1;
      wrong.forEach(function (w) { if (!seen[w]) { seen[w] = 1; list.push({ t: w, ok: false }); } });
      return list.length < 3 ? null : shuffle(list);
    }
    function wikiLink(id) { return '<a href="#/wiki/p/' + id + '">Open the wiki page</a>'; }
    function whyPaper(p) {
      return '<p class="why-h"><strong>' + esc(p.cite) + '</strong> &middot; ' + esc(p.title) + '</p><ul>' +
        p.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul><p class="small">' + wikiLink(p.id) + '</p>';
    }

    /* ---------- question builders (each returns a question or null) ---------- */
    function qFinding(p) {
      var o = opts(p.cite, distractorPapers(p, 3).map(function (q) { return q.cite; }));
      if (!o) return null;
      return { cat: "paper", key: "p:" + p.id, kicker: "Name that paper", prompt: p.summary, sub: "Which paper is this?", opts: o, why: whyPaper(p) };
    }
    function qPoint(p) {
      var ds = distractorPapers(p, 3);
      var wrong = ds.map(function (q) { return q.points[Math.floor(Math.random() * q.points.length)]; });
      var right = p.points[Math.floor(Math.random() * p.points.length)];
      var o = opts(right, wrong);
      if (!o) return null;
      return { cat: "paper", key: "p:" + p.id, kicker: "Key point", prompt: "Which of these is a key point from " + p.cite + "?", sub: "", opts: o, why: whyPaper(p) };
    }
    function qHole(p) {
      var w = WK.p[p.id];
      if (!w || !w.lm || !w.lm.length) return null;
      var ds = distractorPapers(p, 3).filter(function (q) { return WK.p[q.id] && WK.p[q.id].lm.length; });
      var wrong = ds.map(function (q) { var l = WK.p[q.id].lm; return l[Math.floor(Math.random() * l.length)]; });
      var right = w.lm[Math.floor(Math.random() * w.lm.length)];
      var o = opts(right, wrong);
      if (!o) return null;
      return { cat: "holes", key: "p:" + p.id, kicker: "Poke holes", prompt: "A committee member presses on " + p.cite + ". Which weakness fits this paper?", sub: "Limits as noted on the wiki page.",
        opts: o, why: '<p class="why-h"><strong>' + esc(p.cite) + '</strong>: limits to be ready for</p><ul>' + w.lm.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul><p class="small">' + wikiLink(p.id) + '</p>' };
    }
    function qTerm(g) {
      var wrong = sample(G.glossary.filter(function (x) { return x.term !== g.term; }), 3).map(function (x) { return x.term; });
      var o = opts(g.term, wrong);
      if (!o) return null;
      return { cat: "term", key: "g:" + g.term, kicker: "Glossary", prompt: g.def_, sub: "Which term is this?", opts: o,
        why: '<p class="why-h"><strong>' + esc(g.term) + '</strong></p><p>' + esc(g.def_) + '</p><p class="small"><a href="#/glossary">Open the glossary</a></p>' };
    }
    function qConcept(c, pool) {
      var same = shuffle(pool.filter(function (x) { return x.slug !== c.slug && x.group === c.group; }));
      var other = shuffle(pool.filter(function (x) { return x.slug !== c.slug && x.group !== c.group; }));
      var wrong = same.concat(other).slice(0, 3).map(function (x) { return x.name; });
      var o = opts(c.name, wrong);
      if (!o) return null;
      return { cat: "term", key: "c:" + c.slug, kicker: "Concept", prompt: c.short, sub: "Which concept page is this?", opts: o,
        why: '<p class="why-h"><strong>' + esc(c.name) + '</strong></p><p>' + esc(c.short) + '</p>' + (c.contrast ? '<p class="small"><strong>Watch out:</strong> ' + esc(c.contrast) + '</p>' : '') + '<p class="small"><a href="#/wiki/c/' + c.slug + '">Open the concept page</a></p>' };
    }
    function usableYear(p) { return String(p.year) && p.cite.indexOf(String(p.year)) > -1 && p.cite.indexOf("reprint") < 0; }
    function qOrder(pool) {
      var ok = pool.filter(usableYear), tries = 0;
      if (ok.length < 3) ok = papers.filter(usableYear);
      while (tries++ < 40) {
        var a = sample(ok, 3), ys = a.map(function (p) { return p.year; }).sort(function (x, y) { return x - y; });
        if (ys[0] === ys[1] || ys[1] === ys[2]) continue;
        var first = a.filter(function (p) { return p.year === ys[0]; })[0];
        var o = opts(first.cite, a.filter(function (p) { return p !== first; }).map(function (p) { return p.cite; }));
        if (!o) continue;
        var sorted = a.slice().sort(function (x, y) { return x.year - y.year; });
        return { cat: "time", key: null, kicker: "Timeline race", prompt: "Which of these was published first?", sub: "", opts: o,
          why: '<p class="why-h">Oldest to newest</p><ul>' + sorted.map(function (p) { return '<li><strong>' + esc(p.cite) + '</strong>: ' + esc(p.title) + '</li>'; }).join("") + '</ul>' };
      }
      return null;
    }
    function qThread(t) {
      var member = byId[t.papers[Math.floor(Math.random() * t.papers.length)]];
      var non = shuffle(papers.filter(function (p) { return t.papers.indexOf(p.id) < 0; }));
      var wrong = [], seen = {};
      non.forEach(function (p) { if (wrong.length < 3 && !seen[p.cite]) { seen[p.cite] = 1; wrong.push(p.cite); } });
      var o = opts(member.cite, wrong);
      if (!o) return null;
      return { cat: "thread", key: null, kicker: "Thread detective", prompt: "Which of these papers is grouped under this thread on the Connections page?", sub: t.title, opts: o,
        why: '<p class="why-h">This thread groups</p><ul>' + t.papers.map(function (id) { return '<li><a href="#/paper/' + id + '">' + esc(byId[id].cite) + '</a></li>'; }).join("") + '</ul><p class="small"><a href="#/connect">Open Connections</a></p>' };
    }

    /* ---------- run builders ---------- */
    var prefs = { topic: "all" };
    function conceptTopic(c) {
      var n = {};
      c.papers.forEach(function (id) { if (byId[id]) n[byId[id].topic] = (n[byId[id].topic] || 0) + 1; });
      var best = null, bn = 0;
      Object.keys(n).forEach(function (k) { if (n[k] > bn) { bn = n[k]; best = k; } });
      return best;
    }
    function paperPool() { return papers.filter(function (p) { return prefs.topic === "all" || p.topic === prefs.topic; }); }
    function conceptPool() {
      var pool = concepts.filter(function (c) { return prefs.topic === "all" || conceptTopic(c) === prefs.topic; });
      return pool.length >= 6 ? pool : concepts;
    }
    function build(plan) {
      var pool = paperPool(), need = plan.filter(function (t) { return t === "finding" || t === "point" || t === "hole"; }).length;
      var ps = wpick(pool, function (p) { return "p:" + p.id; }, need);
      while (ps.length < need) ps = ps.concat(wpick(pool, function (p) { return "p:" + p.id; }, need - ps.length));
      var cp = wpick(conceptPool(), function (c) { return "c:" + c.slug; }, plan.filter(function (t) { return t === "concept"; }).length + 2);
      var gl = wpick(G.glossary, function (g) { return "g:" + g.term; }, plan.filter(function (t) { return t === "term"; }).length + 2);
      var ths = shuffle(G.threads), qs = [], pi = 0, ci = 0, gi = 0, ti = 0;
      plan.forEach(function (t) {
        var q = null, p;
        if (t === "finding" || t === "point" || t === "hole") {
          p = ps[pi++];
          q = (t === "finding" ? qFinding(p) : t === "point" ? qPoint(p) : qHole(p)) || qFinding(p);
        } else if (t === "term") { q = qTerm(gl[gi++ % gl.length]); }
        else if (t === "concept") { q = qConcept(cp[ci++ % cp.length], conceptPool()); }
        else if (t === "order") { q = qOrder(pool); }
        else if (t === "thread") { q = qThread(ths[ti++ % ths.length]); }
        if (q) qs.push(q);
      });
      return shuffle(qs);
    }
    function rep(t, n) { var a = []; for (var i = 0; i < n; i++) a.push(t); return a; }
    function weakPlan() {
      var keys = Object.keys(S.m).filter(function (k) { return S.m[k].b <= 1; })
        .sort(function (a, b) { return (S.m[b].w - S.m[a].w) || (S.m[a].b - S.m[b].b); }).slice(0, 10), qs = [];
      keys.forEach(function (k) {
        var id = k.slice(2), q = null;
        if (k.indexOf("p:") === 0 && byId[id]) { var p = byId[id], r = Math.random(); q = (r < 0.4 ? qFinding(p) : r < 0.7 ? qPoint(p) : qHole(p)) || qFinding(p); }
        else if (k.indexOf("c:") === 0 && conceptBy[id]) q = qConcept(conceptBy[id], concepts);
        else if (k.indexOf("g:") === 0) { var g = G.glossary.filter(function (x) { return x.term === id; })[0]; if (g) q = qTerm(g); }
        if (q) qs.push(q);
      });
      if (qs.length < 10) {
        var seen = {}; qs.forEach(function (q) { seen[q.key] = 1; });
        var fill = wpick(paperPool().filter(function (p) { return !seen["p:" + p.id]; }), function (p) { return "p:" + p.id; }, 10 - qs.length);
        fill.forEach(function (p) { var q = qFinding(p); if (q) qs.push(q); });
      }
      return shuffle(qs);
    }
    var MODES = [
      { id: "quick", name: "Quick fire", icon: "bolt", n: 10, blurb: "Ten mixed questions. A good warm-up.", plan: [].concat(rep("finding", 3), rep("point", 2), rep("hole", 2), ["term", "concept", "order"]) },
      { id: "paper", name: "Name that paper", icon: "target", n: 10, blurb: "Read a finding, pick the paper.", plan: rep("finding", 10) },
      { id: "holes", name: "Poke holes", icon: "search", n: 8, blurb: "Match each paper to the weakness a committee would press.", plan: rep("hole", 8) },
      { id: "terms", name: "Terms and concepts", icon: "book", n: 10, blurb: "Definitions in, names out.", plan: [].concat(rep("concept", 5), rep("term", 5)) },
      { id: "time", name: "Timeline race", icon: "clock", n: 8, blurb: "Which paper came first?", plan: rep("order", 8) },
      { id: "thread", name: "Thread detective", icon: "link", n: 8, blurb: "Which paper belongs to which argument?", plan: rep("thread", 8) },
      { id: "weak", name: "Weak spots", icon: "heart", n: 10, blurb: "Only what you have missed or not tried yet.", weak: true },
      { id: "boss", name: "Boss round", icon: "trophy", n: 20, blurb: "Twenty mixed questions, three hearts, double XP.", boss: true,
        plan: [].concat(rep("finding", 6), rep("point", 4), rep("hole", 4), rep("term", 2), rep("concept", 2), ["order", "thread"]) }
    ];
    var modeById = {}; MODES.forEach(function (m) { modeById[m.id] = m; });

    /* ---------- icons (inline SVG, no external assets) ---------- */
    var ICONS = {
      bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>',
      book: '<path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M4 17a3 3 0 013-3h12"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
      heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>',
      trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H4v2a4 4 0 004 4"/><path d="M16 6h4v2a4 4 0 01-4 4"/><path d="M12 13v4"/><path d="M8 21h8"/><path d="M10 17h4"/>',
      flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
      star: '<path d="M12 3l2.8 6 6.2.7-4.6 4.3 1.4 6.5-5.8-3.3-5.8 3.3 1.4-6.5L3 9.7 9.2 9z"/>',
      flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
      cross: '<path d="M6 6l12 12M18 6L6 18"/>',
      eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
      medal: '<circle cx="12" cy="14" r="6"/><path d="M8.5 3l3.5 6 3.5-6"/>',
      leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>'
    };
    function ic(n, cls) { return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[n] + '</svg>'; }

    /* ---------- badges ---------- */
    function topicMasteredShare(id) {
      var list = papers.filter(function (p) { return p.topic === id; });
      return list.filter(function (p) { return state("p:" + p.id) === "mastered"; }).length / list.length;
    }
    var BADGES = [
      { id: "first", name: "First steps", icon: "flag", desc: "Finish a round.", test: function () { return S.st.runs >= 1; } },
      { id: "hundred", name: "Hundred club", icon: "medal", desc: "Answer 100 questions.", test: function () { return S.st.answered >= 100; } },
      { id: "combo5", name: "On a roll", icon: "flame", desc: "Get 5 right in a row.", test: function () { return S.st.bestCombo >= 5; } },
      { id: "combo10", name: "Unstoppable", icon: "bolt", desc: "Get 10 right in a row.", test: function () { return S.st.bestCombo >= 10; } },
      { id: "perfect", name: "Flawless", icon: "star", desc: "Finish a round of 8 or more with no misses.", test: function () { return S.st.perfect >= 1; } },
      { id: "goal", name: "Goal getter", icon: "target", desc: "Reach the daily XP goal (" + GOAL + " XP).", test: function () { return S.goalDays.length >= 1; } },
      { id: "streak3", name: "Three days running", icon: "flame", desc: "Study three days in a row.", test: function () { return streak() >= 3; } },
      { id: "streak7", name: "A full week", icon: "leaf", desc: "Study seven days in a row.", test: function () { return streak() >= 7; } },
      { id: "terms", name: "Word nerd", icon: "book", desc: "Get 25 term and concept questions right.", test: function () { return S.st.term >= 25; } },
      { id: "time", name: "Clock keeper", icon: "clock", desc: "Get 15 timeline questions right.", test: function () { return S.st.time >= 15; } },
      { id: "holes", name: "Devil's advocate", icon: "search", desc: "Get 15 limitation questions right.", test: function () { return S.st.holes >= 15; } },
      { id: "boss", name: "Boss slayer", icon: "trophy", desc: "Clear the Boss round with a heart to spare.", test: function () { return S.st.boss >= 1; } },
      { id: "t-epi", name: "Epigenetics expert", icon: "leaf", desc: "Master half of the Epigenetics readings.", test: function () { return topicMasteredShare("epi") >= 0.5; } },
      { id: "t-clocks", name: "Clock master", icon: "clock", desc: "Master half of the Clocks readings.", test: function () { return topicMasteredShare("clocks") >= 0.5; } },
      { id: "t-plasticity", name: "Plasticity expert", icon: "leaf", desc: "Master half of the Plasticity readings.", test: function () { return topicMasteredShare("plasticity") >= 0.5; } }
    ];
    function checkBadges(into) {
      BADGES.forEach(function (b) {
        if (!S.badges[b.id] && b.test()) { S.badges[b.id] = today(); if (into) into.push(b); }
      });
    }

    /* ---------- run state ---------- */
    var run = null, skim = null, armed = false;
    var GOOD = ["Nice one.", "Yes, that's it.", "Exactly right.", "Got it.", "Spot on."];
    var BAD = ["Not quite.", "Close, but no.", "Good try. Here is the answer."];

    function startRun(modeId) {
      var m = modeById[modeId], qs = m.weak ? weakPlan() : build(m.plan);
      if (!qs.length) return;
      run = { mode: m, qs: qs, i: 0, picked: -1, combo: 0, best: 0, right: 0, xp: 0, hearts: m.boss ? 3 : null,
        missed: [], badges: [], levelUp: null, done: false, bonus: 0, out: false, fb: null };
      skim = null;
    }
    function answer(idx) {
      if (!run || run.picked > -1 || run.done) return;
      var q = run.qs[run.i], ok = q.opts[idx].ok, before = levelInfo(S.xp).i, gain = 0;
      run.picked = idx;
      S.st.answered++;
      if (ok) {
        S.st.correct++; run.right++; run.combo++;
        if (run.combo > run.best) run.best = run.combo;
        if (run.combo > S.st.bestCombo) S.st.bestCombo = run.combo;
        gain = 10 + Math.min(run.combo - 1, COMBO_CAP) * 2;
        if (run.mode.boss) gain *= 2;
        if (q.cat === "term") S.st.term++;
        if (q.cat === "time") S.st.time++;
        if (q.cat === "holes") S.st.holes++;
      } else {
        run.combo = 0; run.missed.push(q);
        if (run.hearts !== null) run.hearts--;
      }
      record(q.key, ok);
      addXp(gain); run.xp += gain; touchDay();
      var nb = []; checkBadges(nb); run.badges = run.badges.concat(nb);
      var after = levelInfo(S.xp).i;
      if (after > before) run.levelUp = LEVELS[after][0];
      run.fb = { ok: ok, gain: gain, text: ok ? (run.combo >= 3 ? run.combo + " in a row. " : "") + GOOD[(run.combo + run.i) % GOOD.length] : BAD[run.i % BAD.length], newBadges: nb, level: after > before ? LEVELS[after][0] : null };
      save();
    }
    function next() {
      if (!run || run.picked < 0) return;
      if (run.hearts === 0) { run.out = true; return finish(); }
      if (run.i + 1 >= run.qs.length) return finish();
      run.i++; run.picked = -1; run.fb = null;
    }
    function finish() {
      var n = run.qs.length, perfect = run.missed.length === 0 && n >= 8, before = levelInfo(S.xp).i, bonus = run.out ? 0 : 20;
      if (perfect) bonus += 30;
      if (run.mode.boss) bonus *= 2;
      if (run.mode.boss && !run.out && run.hearts >= 1) S.st.boss++;
      S.st.runs++; if (perfect) S.st.perfect++;
      addXp(bonus); run.xp += bonus; run.bonus = bonus; run.perfect = perfect; touchDay();
      var nb = []; checkBadges(nb); run.badges = run.badges.concat(nb);
      var after = levelInfo(S.xp).i;
      if (after > before) run.levelUp = LEVELS[after][0];
      run.done = true; save();
    }
    function startSkim() {
      var list = paperPool();
      skim = { list: list, i: 0, xp: 0 }; run = null;
      awardSkim();
    }
    function awardSkim() {
      var p = skim.list[skim.i];
      if (p && S.skim.indexOf(p.id) < 0) { S.skim.push(p.id); addXp(2); skim.xp += 2; touchDay(); var nb = []; checkBadges(nb); save(); }
    }

    /* ---------- views ---------- */
    function ring(pct, label, sub) {
      var C = 2 * Math.PI * 34, d = Math.min(1, pct) * C;
      return '<div class="cr-ring" role="img" aria-label="' + esc(label + " " + sub) + '"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="rt"/><circle cx="40" cy="40" r="34" class="rf" stroke-dasharray="' + d.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 40 40)"/></svg><span class="rv">' + esc(label) + '</span></div><p class="small cr-cap">' + esc(sub) + '</p>';
    }
    function statusCard() {
      var L = levelInfo(S.xp), dx = dailyXp(), st = streak();
      var acc = S.st.answered ? Math.round(100 * S.st.correct / S.st.answered) : null;
      return '<section class="card cr-status"><div class="cr-lvl"><span class="cr-lvl-n">Level ' + (L.i + 1) + '</span><h2>' + esc(L.name) + '</h2>' +
        '<div class="bar xp" role="img" aria-label="' + L.pct + ' percent to next level"><span style="width:' + L.pct + '%"></span></div>' +
        '<p class="small">' + S.xp + ' XP' + (L.next ? ' &middot; ' + L.left + ' to ' + esc(L.next) : ' &middot; top level reached') + '</p></div>' +
        '<div class="cr-stat">' + ring(dx / GOAL, Math.min(dx, GOAL) + "/" + GOAL, dx >= GOAL ? "Daily goal done" : "XP today") + '</div>' +
        '<div class="cr-stat cr-fire">' + ic("flame", st ? "on" : "") + '<span class="rv">' + st + '</span><p class="small cr-cap">' + (st === 1 ? "day streak" : "day streak") + '</p></div>' +
        '<p class="small cr-line">' + (acc === null ? "No answers yet. Pick any round below." : S.st.answered + ' answered &middot; ' + acc + '% right &middot; best run of ' + S.st.bestCombo + ' in a row') + '</p></section>';
    }
    function topicChips() {
      return '<div class="chips" role="group" aria-label="Limit to a topic">' + [["all", "All topics"]].concat(topics.map(function (t) { return [t.id, t.name]; })).map(function (t) {
        return '<button type="button" class="chip" data-cr="topic" data-v="' + t[0] + '" aria-pressed="' + (prefs.topic === t[0]) + '">' + esc(t[1]) + '</button>';
      }).join("") + '</div>';
    }
    function modeCard(m) {
      var locked = m.weak && S.st.answered < 5;
      return '<button type="button" class="cr-mode' + (m.boss ? ' boss' : '') + '" data-cr="start" data-v="' + m.id + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="cr-ico">' + ic(m.icon) + '</span><span class="cr-mt"><strong>' + esc(m.name) + '</strong><span>' + esc(m.blurb) + '</span></span>' +
        '<span class="cr-go">' + (locked ? 'Answer 5 questions first' : m.n + ' questions') + '</span></button>';
    }
    function masteryMap() {
      var counts = { "new": 0, weak: 0, learning: 0, mastered: 0 };
      var html = topics.map(function (t) {
        return '<div class="mm-row"><h3>' + esc(t.name) + '</h3><div class="mm-grid">' + papers.filter(function (p) { return p.topic === t.id; }).map(function (p) {
          var s = state("p:" + p.id); counts[s]++;
          return '<a class="mm s-' + s + '" href="#/wiki/p/' + p.id + '" title="' + esc(p.cite + ": " + STATE_LABEL[s]) + '" aria-label="' + esc(p.cite + ", " + STATE_LABEL[s]) + '"></a>';
        }).join("") + '</div></div>';
      }).join("");
      return '<h2>Mastery map</h2><p class="small">One square per paper. A paper is mastered after three right answers in a row. Select a square to open its wiki page.</p>' +
        '<ul class="mm-key"><li><span class="mm s-new"></span>Not tried (' + counts["new"] + ')</li><li><span class="mm s-weak"></span>Needs work (' + counts.weak + ')</li><li><span class="mm s-learning"></span>Learning (' + counts.learning + ')</li><li><span class="mm s-mastered"></span>Mastered (' + counts.mastered + ')</li></ul>' + html;
    }
    function badgeShelf() {
      var got = BADGES.filter(function (b) { return S.badges[b.id]; }).length;
      return '<h2>Badges <span class="count">' + got + ' of ' + BADGES.length + '</span></h2><ul class="badges">' + BADGES.map(function (b) {
        var on = !!S.badges[b.id];
        return '<li class="badge' + (on ? ' on' : '') + '"><span class="bi">' + ic(on ? b.icon : "lock") + '</span><span><strong>' + esc(b.name) + '</strong><span class="small">' + esc(b.desc) + (on ? " Earned." : "") + '</span></span></li>';
      }).join("") + '</ul>';
    }
    function viewHub() {
      var skimmed = S.skim.length;
      return '<span class="kicker">Cram</span><h1>Quick rounds, steady progress</h1>' +
        '<p class="lead">Short rounds built from the readings. Every right answer earns XP, every miss shows you why, and nothing here counts against you.</p>' +
        statusCard() +
        '<h2>Pick a round</h2><p class="small" style="margin:0">Papers can be limited to one topic. Concept and glossary questions use the whole guide unless a topic fits.</p>' + topicChips() +
        '<div class="cr-modes">' + MODES.map(modeCard).join("") + '</div>' +
        '<h2>Short on time?</h2><button type="button" class="cr-mode skim" data-cr="skim"><span class="cr-ico">' + ic("eye") + '</span><span class="cr-mt"><strong>Ten-minute skim</strong><span>Flip through one card per paper: the summary and key points. Earns a little XP the first time you see each paper.</span></span><span class="cr-go">' + skimmed + ' of ' + papers.length + ' skimmed</span></button>' +
        masteryMap() + badgeShelf() +
        '<p class="small" style="margin-top:22px">Progress is saved in this browser only. <button class="chip" type="button" data-cr="reset">' + (armed ? 'Click again to erase Cram progress' : 'Reset Cram progress') + '</button></p>';
    }
    function confetti() {
      var cols = ["c1", "c2", "c3", "c4"], out = "";
      for (var i = 0; i < 26; i++) out += '<i class="' + cols[i % 4] + '" style="left:' + Math.round(Math.random() * 100) + '%;animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's;--dx:' + Math.round(Math.random() * 120 - 60) + 'px"></i>';
      return '<div class="confetti" aria-hidden="true">' + out + '</div>';
    }
    function viewRun() {
      if (run.done) return viewResults();
      var q = run.qs[run.i], n = run.qs.length, answered = run.picked > -1, fb = run.fb, pct = Math.round(100 * (run.i + (answered ? 1 : 0)) / n);
      var hearts = "";
      if (run.hearts !== null) { for (var h = 0; h < 3; h++) hearts += '<span class="hrt' + (h < run.hearts ? ' on' : '') + '">' + ic("heart") + '</span>'; hearts = '<span class="cr-hearts" role="img" aria-label="' + run.hearts + ' hearts left">' + hearts + '</span>'; }
      var o = q.opts.map(function (x, i) {
        var cls = "opt";
        if (answered) cls += x.ok ? " right" : (i === run.picked ? " wrong" : " dim");
        return '<button type="button" class="' + cls + '" data-cr="pick" data-v="' + i + '"' + (answered ? ' disabled' : '') + '><span class="num">' + (answered && x.ok ? ic("check") : answered && i === run.picked ? ic("cross") : (i + 1)) + '</span><span class="ot">' + esc(x.t) + '</span></button>';
      }).join("");
      var panel = "";
      if (answered) {
        panel = '<div class="cr-fb ' + (fb.ok ? 'good' : 'bad') + '" role="status"><div class="fb-top"><strong>' + esc(fb.text) + '</strong>' + (fb.gain ? '<span class="xp-pop">+' + fb.gain + ' XP</span>' : '') + '</div>' +
          (fb.level ? '<p class="note">Level up: you are now a ' + esc(fb.level) + '.</p>' : '') +
          fb.newBadges.map(function (b) { return '<p class="note">New badge: ' + esc(b.name) + '.</p>'; }).join("") +
          '<div class="why">' + q.why + '</div><button type="button" class="btn big" id="cr-next" data-cr="next">' + (run.hearts === 0 || run.i + 1 >= n ? 'See results' : 'Next question') + '</button></div>';
      }
      return '<div class="cr-top"><button type="button" class="chip" data-cr="quit">Quit round</button><span class="cr-mode-name">' + esc(run.mode.name) + '</span>' + hearts +
        '<span class="cr-meta">Question ' + (run.i + 1) + ' of ' + n + '</span></div>' +
        '<div class="bar" role="img" aria-label="' + pct + ' percent through the round"><span style="width:' + pct + '%"></span></div>' +
        '<div class="cr-pills"><span class="pill">' + ic("bolt") + run.xp + ' XP this round</span><span class="pill' + (run.combo >= 3 ? ' hot' : '') + '">' + ic("flame") + run.combo + ' in a row</span></div>' +
        '<section class="cr-q"><span class="tag kind">' + esc(q.kicker) + '</span><h2 class="cr-prompt" id="cr-prompt" tabindex="-1">' + esc(q.prompt) + '</h2>' + (q.sub ? '<p class="cr-sub">' + esc(q.sub) + '</p>' : '') +
        '<div class="cr-opts" role="group" aria-label="Answers. Press 1 to ' + q.opts.length + ' to choose.">' + o + '</div>' + panel + '</section>' +
        '<p class="small cr-keys">Keyboard: 1 to ' + q.opts.length + ' to answer, Enter for next.</p>';
    }
    function viewResults() {
      var n = run.qs.length, acc = Math.round(100 * run.right / n), L = levelInfo(S.xp);
      var msg = run.out ? "Out of hearts. Boss rounds are meant to be hard, and every miss below is a clear target." :
        acc >= 90 ? "Outstanding round." : acc >= 70 ? "Solid round." : acc >= 40 ? "Getting there. The misses below are your next targets." : "A tough one, and that is what practice is for. Start with the misses below.";
      return (acc >= 80 && !run.out ? confetti() : "") +
        '<span class="kicker">' + esc(run.mode.name) + ' complete</span><h1>' + run.right + ' of ' + n + ' right</h1><p class="lead">' + msg + '</p>' +
        '<div class="grid three cr-res"><div class="card"><span class="small">XP earned</span><p class="big">+' + run.xp + '</p><p class="small">' + (run.bonus ? run.bonus + ' of that was the round bonus' + (run.perfect ? ' (flawless)' : '') : 'No round bonus this time') + '</p></div>' +
        '<div class="card"><span class="small">Best run</span><p class="big">' + run.best + '</p><p class="small">right in a row</p></div>' +
        '<div class="card"><span class="small">Level ' + (L.i + 1) + '</span><p class="big sm">' + esc(L.name) + '</p><div class="bar"><span style="width:' + L.pct + '%"></span></div><p class="small" style="margin:6px 0 0">' + (L.next ? L.left + ' XP to ' + esc(L.next) : 'Top level reached') + '</p></div></div>' +
        (run.levelUp ? '<p class="cr-banner">Level up: you are now a ' + esc(run.levelUp) + '.</p>' : '') +
        (run.badges.length ? '<h2>New badges</h2><ul class="badges">' + run.badges.map(function (b) { return '<li class="badge on"><span class="bi">' + ic(b.icon) + '</span><span><strong>' + esc(b.name) + '</strong><span class="small">' + esc(b.desc) + '</span></span></li>'; }).join("") + '</ul>' : '') +
        '<p style="margin-top:22px">' + (run.missed.length ? '<button type="button" class="btn orange" data-cr="redo">Redo the ' + run.missed.length + ' I missed</button> ' : '') +
        '<button type="button" class="btn" data-cr="again" data-v="' + run.mode.id + '">Play again</button> <button type="button" class="btn ghost" data-cr="quit">Back to Cram</button></p>' +
        (run.missed.length ? '<h2>Worth another look</h2><div class="cr-missed">' + run.missed.map(function (q) {
          var right = q.opts.filter(function (x) { return x.ok; })[0].t;
          return '<details class="card"><summary><strong>' + esc(q.kicker) + ':</strong> ' + esc(q.prompt.length > 130 ? q.prompt.slice(0, 127) + "..." : q.prompt) + '</summary><p class="small" style="margin:10px 0 4px">Answer</p><p><strong>' + esc(right) + '</strong></p><div class="why">' + q.why + '</div></details>';
        }).join("") + '</div>' : '');
    }
    function viewSkim() {
      var p = skim.list[skim.i];
      if (!p) { skim = null; return viewHub(); }
      var last = skim.i + 1 >= skim.list.length;
      return '<div class="cr-top"><button type="button" class="chip" data-cr="quit">Back to Cram</button><span class="cr-mode-name">Ten-minute skim</span><span class="cr-meta">Paper ' + (skim.i + 1) + ' of ' + skim.list.length + '</span></div>' +
        '<div class="bar"><span style="width:' + Math.round(100 * (skim.i + 1) / skim.list.length) + '%"></span></div>' +
        '<section class="cr-q skimcard"><span class="tag kind">' + esc(p.kind) + '</span><span class="tag">' + esc(topicName(p.topic)) + '</span><h2 class="cr-prompt" id="cr-prompt" tabindex="-1">' + esc(p.cite) + '</h2><p class="cr-sub">' + esc(p.title) + '</p>' +
        '<p>' + esc(p.summary) + '</p><ul>' + p.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul><p class="use">' + esc(p.use) + '</p><p class="small">' + wikiLink(p.id) + '</p>' +
        '<p class="cr-nav"><button type="button" class="btn ghost" data-cr="sback"' + (skim.i === 0 ? ' disabled' : '') + '>Back</button> <button type="button" class="btn big" data-cr="snext">' + (last ? 'Finish skim' : 'Next paper') + '</button></p></section>' +
        '<p class="small">' + (skim.xp ? '+' + skim.xp + ' XP from new papers this skim.' : 'Already-skimmed papers do not earn XP again.') + '</p>';
    }
    function topicName(id) { return (X.topicById[id] || { name: id }).name; }
    function view() {
      if (skim) return viewSkim();
      return run ? viewRun() : viewHub();
    }

    /* ---------- events ---------- */
    function click(el) {
      var a = el.dataset.cr, v = el.dataset.v;
      if (a === "topic") { prefs.topic = v; X.rerender(); }
      else if (a === "start" || a === "again") { startRun(v); X.refresh(); }
      else if (a === "pick") { focusId = "cr-next"; answer(parseInt(v, 10)); X.rerender(); }
      else if (a === "next") { next(); X.refresh(); }
      else if (a === "quit") { run = null; skim = null; X.refresh(); }
      else if (a === "redo") {
        var qs = shuffle(run.missed.map(function (q) { return reshuffle(q); }));
        run = { mode: run.mode, qs: qs, i: 0, picked: -1, combo: 0, best: 0, right: 0, xp: 0, hearts: null, missed: [], badges: [], levelUp: null, done: false, bonus: 0, out: false, fb: null };
        run.mode = { id: run.mode.id, name: run.mode.name + ": redo", n: qs.length };
        X.refresh();
      }
      else if (a === "skim") { startSkim(); X.refresh(); }
      else if (a === "snext") { if (skim.i + 1 >= skim.list.length) { skim = null; } else { skim.i++; awardSkim(); } X.refresh(); }
      else if (a === "sback") { if (skim.i > 0) { skim.i--; } X.refresh(); }
      else if (a === "reset") {
        if (armed) { S = fresh(); save(); armed = false; } else { armed = true; }
        X.rerender();
      }
    }
    function reshuffle(q) {
      return { cat: q.cat, key: q.key, kicker: q.kicker, prompt: q.prompt, sub: q.sub, why: q.why, opts: shuffle(q.opts.map(function (o) { return { t: o.t, ok: o.ok }; })) };
    }
    var focusId = null;
    function after() {
      var el = null;
      if (focusId) { el = document.getElementById(focusId); focusId = null; }
      if (!el && (run || skim)) el = document.getElementById("cr-prompt");
      if (el) { try { el.focus({ preventScroll: !!(el.id === "cr-next") }); } catch (e) { el.focus(); } }
      if (el && el.id === "cr-next") { try { el.scrollIntoView({ block: "nearest" }); } catch (e2) { /* ignore */ } }
    }
    function key(e) {
      if (!run || run.done || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target && e.target.tagName; if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if (run.picked < 0 && /^[1-9]$/.test(e.key)) {
        var i = parseInt(e.key, 10) - 1;
        if (i < run.qs[run.i].opts.length) { e.preventDefault(); focusId = "cr-next"; answer(i); X.rerender(); }
      } else if (run.picked > -1 && (e.key === "Enter" || e.key === "ArrowRight")) {
        if (e.target && e.target.id === "cr-next") return; // the button handles its own Enter
        e.preventDefault(); next(); X.refresh();
      }
    }

    return { view: view, click: click, key: key, after: after, active: function () { return !!(run || skim); },
      summary: function () { var L = levelInfo(S.xp); return { level: L.i + 1, name: L.name, xp: S.xp, streak: streak() }; } };
  };
})();
