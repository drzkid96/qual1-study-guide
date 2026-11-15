/* Cram: learn each reading or concept, then drill it until it is answered right.
   Flow per item: short lesson (3 pages) -> drill queue -> missed questions come back (as a different
   question on the same item) and must be answered correctly twice in a row before they clear.
   Everything is generated from the guide's own data. Progress is stored in this browser only (key qual1.cram). */
(function () {
  "use strict";
  window.CramModule = function (X) {
    var G = X.G, WK = X.WK, esc = X.esc, kt = X.kt, ktList = X.ktList, store = X.store, papers = X.papers, byId = X.byId, topics = X.topics,
      concepts = X.concepts, conceptBy = X.conceptBy;

    var KEY = "qual1.cram";
    var LEVELS = [["Fresh reader", 0], ["Highlighter", 150], ["Margin scribbler", 400], ["Methyl marker", 800],
      ["Clock watcher", 1400], ["Plasticity pro", 2200], ["Committee ready", 3400], ["Qualified", 5000]];
    var GOAL = 100, COMBO_CAP = 5, NEED_AFTER_MISS = 2;
    var INTERVAL = [0, 1, 2, 4, 8]; // days before an item is due again, by box
    var DAY = 86400000;

    /* ---------- saved state ---------- */
    function fresh() {
      return { xp: 0, days: [], goalDays: [], badges: {}, m: {}, learned: {}, daily: { d: "", xp: 0 },
        st: { answered: 0, correct: 0, bestCombo: 0, runs: 0, clean: 0, boss: 0, term: 0, time: 0, holes: 0, retried: 0 } };
    }
    var S = store.get(KEY, null);
    if (!S || !S.st || !S.m) S = fresh();
    S.learned = S.learned || {}; S.goalDays = S.goalDays || []; S.badges = S.badges || {};
    ["clean", "retried", "boss", "term", "time", "holes"].forEach(function (k) { S.st[k] = S.st[k] || 0; });
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

    /* ---------- mastery: box 0..4 per item (p:id, c:slug, g:term) ---------- */
    function setBox(key, b) { if (!key) return; var m = S.m[key] || { b: 0, c: 0, w: 0 }; m.b = Math.max(0, Math.min(4, b)); m.t = Date.now(); S.m[key] = m; }
    function tally(key, ok) { if (!key) return; var m = S.m[key] || { b: 0, c: 0, w: 0 }; if (ok) m.c++; else m.w++; S.m[key] = m; }
    function state(key) {
      var m = S.m[key];
      if (!S.learned[key]) return m && m.w ? "weak" : "new";
      if (!m) return "learning";
      if (m.b >= 3) return "mastered";
      return m.b === 0 ? "weak" : "learning";
    }
    function isDue(key) {
      var m = S.m[key];
      if (!m || !S.learned[key] || !m.t) return false;
      return Date.now() - m.t > INTERVAL[m.b] * DAY;
    }
    var STATE_LABEL = { "new": "Not started", weak: "Needs work", learning: "Practicing", mastered: "Cleared" };
    function weight(key) { var m = S.m[key]; if (!m) return 4; return [6, 3, 2, 1, 0.5][m.b]; }

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
    function distractorPapers(p, n, avoid) {
      avoid = avoid || [];
      var pool = shuffle(papers.filter(function (q) { return q.id !== p.id && surname(q) !== surname(p) && avoid.indexOf(q.id) < 0; }));
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
      return '<p class="why-h"><strong>' + esc(p.cite) + '</strong> &middot; ' + esc(p.title) + '</p>' + ktList(p.points, 2) + '<p class="small">' + wikiLink(p.id) + '</p>';
    }
    function trunc(s, n) { s = String(s); if (s.length <= n) return s; var c = s.slice(0, n); return c.slice(0, c.lastIndexOf(" ")) + "..."; }
    var ptc = {};
    function nextPoint(p) { ptc[p.id] = ((ptc[p.id] == null ? Math.floor(Math.random() * p.points.length) : ptc[p.id] + 1)) % p.points.length; return p.points[ptc[p.id]]; }

    /* ---------- question builders (each returns a question or null) ---------- */
    function qFinding(p) {
      var o = opts(p.cite, distractorPapers(p, 3).map(function (q) { return q.cite; }));
      if (!o) return null;
      return { cat: "paper", kicker: "Name that paper", prompt: p.summary, sub: "Which paper is this?", opts: o, why: whyPaper(p) };
    }
    function qPoint(p) {
      var right = nextPoint(p);
      var wrong = distractorPapers(p, 3).map(function (q) { return q.points[Math.floor(Math.random() * q.points.length)]; });
      var o = opts(right, wrong);
      if (!o) return null;
      return { cat: "paper", kicker: "Key finding", prompt: "Which of these is a key point from " + p.cite + "?", sub: "", opts: o, why: whyPaper(p) };
    }
    function qHole(p) {
      var w = WK.p[p.id];
      if (!w || !w.lm || !w.lm.length) return null;
      var ds = distractorPapers(p, 3).filter(function (q) { return WK.p[q.id] && WK.p[q.id].lm.length; });
      var wrong = ds.map(function (q) { var l = WK.p[q.id].lm; return l[Math.floor(Math.random() * l.length)]; });
      var right = w.lm[Math.floor(Math.random() * w.lm.length)];
      var o = opts(right, wrong);
      if (!o) return null;
      return { cat: "holes", kicker: "Poke holes", prompt: "A committee member presses on " + p.cite + ". Which weakness fits this paper?", sub: "Limits as noted on the wiki page.",
        opts: o, why: '<p class="why-h"><strong>' + esc(p.cite) + '</strong>: limits to be ready for</p>' + ktList(w.lm, 2) + '<p class="small">' + wikiLink(p.id) + '</p>' };
    }
    function qConnect(p) {
      var w = WK.p[p.id];
      if (!w || !w.cx || !w.cx.length) return null;
      var x = w.cx[Math.floor(Math.random() * w.cx.length)], tgt = byId[x[0]];
      if (!tgt) return null;
      var avoid = w.cx.map(function (y) { return y[0]; }).concat([p.id]);
      var wrong = distractorPapers(tgt, 3, avoid).map(function (q) { return q.cite; });
      var o = opts(tgt.cite, wrong);
      if (!o) return null;
      return { cat: "paper", kicker: "Connections", prompt: x[1], sub: "This paper is connected to " + p.cite + ". Which paper is it?", opts: o,
        why: '<p class="why-h"><strong>' + esc(tgt.cite) + '</strong> &middot; ' + esc(tgt.title) + '</p><p>' + kt(x[1]) + '</p>' + whyConn(p) };
    }
    function whyConn(p) {
      var w = WK.p[p.id];
      return '<p class="small">Also connected to ' + p.cite + ':</p><ul>' + w.cx.slice(0, 4).map(function (y) { return '<li><strong>' + esc(byId[y[0]].cite) + '</strong>: ' + esc(trunc(y[1], 120)) + '</li>'; }).join("") + '</ul>';
    }
    function qPaperConcept(p) {
      var w = WK.p[p.id];
      if (!w || !w.terms || !w.terms.length) return null;
      var c = conceptBy[w.terms[Math.floor(Math.random() * w.terms.length)]];
      if (!c) return null;
      var wrong = shuffle(concepts.filter(function (x) { return w.terms.indexOf(x.slug) < 0 && x.slug !== c.slug; })).slice(0, 3).map(function (x) { return x.name; });
      var o = opts(c.name, wrong);
      if (!o) return null;
      return { cat: "term", kicker: "Concept behind the paper", prompt: c.short, sub: "A concept tied to " + p.cite + ". Which one is it?", opts: o, why: whyConcept(c) };
    }
    function whyConcept(c) {
      return '<p class="why-h"><strong>' + esc(c.name) + '</strong></p><div class="def mini"><p>' + kt(c.short, 2) + '</p></div>' + (c.contrast ? '<p class="small"><strong>Watch out:</strong> ' + kt(c.contrast, 2) + '</p>' : '') + '<p class="small"><a href="#/wiki/c/' + c.slug + '">Open the concept page</a></p>';
    }
    function qTerm(g) {
      var wrong = sample(G.glossary.filter(function (x) { return x.term !== g.term; }), 3).map(function (x) { return x.term; });
      var o = opts(g.term, wrong);
      if (!o) return null;
      return { cat: "term", kicker: "Glossary", prompt: g.def_, sub: "Which term is this?", opts: o,
        why: '<p class="why-h"><strong>' + esc(g.term) + '</strong></p><div class="def mini"><p>' + kt(g.def_, 2) + '</p></div><p class="small"><a href="#/glossary">Open the glossary</a></p>' };
    }
    function qConceptName(c, pool) {
      var same = shuffle(pool.filter(function (x) { return x.slug !== c.slug && x.group === c.group; }));
      var other = shuffle(pool.filter(function (x) { return x.slug !== c.slug && x.group !== c.group; }));
      var o = opts(c.name, same.concat(other).slice(0, 3).map(function (x) { return x.name; }));
      if (!o) return null;
      return { cat: "term", kicker: "Concept", prompt: c.short, sub: "Which concept is this?", opts: o, why: whyConcept(c) };
    }
    function qConceptShort(c) {
      var same = shuffle(concepts.filter(function (x) { return x.slug !== c.slug && x.group === c.group; }));
      var other = shuffle(concepts.filter(function (x) { return x.slug !== c.slug && x.group !== c.group; }));
      var o = opts(c.short, same.concat(other).slice(0, 3).map(function (x) { return x.short; }));
      if (!o) return null;
      return { cat: "term", kicker: "Definition", prompt: c.name, sub: "Which description fits?", opts: o, why: whyConcept(c) };
    }
    function qConceptPaper(c) {
      var ids = c.papers.filter(function (id) { return byId[id]; });
      if (!ids.length) return null;
      var right = byId[ids[Math.floor(Math.random() * ids.length)]];
      var wrong = shuffle(papers.filter(function (p) { return ids.indexOf(p.id) < 0; })).slice(0, 3).map(function (p) { return p.cite; });
      var o = opts(right.cite, wrong);
      if (!o) return null;
      return { cat: "paper", kicker: "Concept to paper", prompt: "Which paper bears on " + c.name + "?", sub: "As listed on the concept page.", opts: o,
        why: whyConcept(c) + '<p class="small">Papers on this concept: ' + ids.map(function (id) { return esc(byId[id].cite); }).join("; ") + '.</p>' };
    }
    function qConceptExam(c) {
      if (!c.exam || !c.exam.length) return null;
      var right = c.exam[Math.floor(Math.random() * c.exam.length)];
      var pool = []; concepts.forEach(function (x) { if (x.slug !== c.slug) x.exam.forEach(function (e) { if (c.exam.indexOf(e) < 0) pool.push(e); }); });
      var o = opts(right, sample(pool, 3));
      if (!o) return null;
      return { cat: "term", kicker: "Exam angle", prompt: "Which practice question fits the concept " + c.name + "?", sub: "From the concept page's exam angles.", opts: o, why: whyConcept(c) + '<p class="small">Exam angles for this concept:</p>' + ktList(c.exam, 2) };
    }
    function usableYear(p) { return p.cite.indexOf(String(p.year)) > -1 && p.cite.indexOf("reprint") < 0; }
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
        return { cat: "time", kicker: "Timeline race", prompt: "Which of these was published first?", sub: "", opts: o,
          why: '<p class="why-h">Oldest to newest</p><ul>' + sorted.map(function (p) { return '<li><strong>' + esc(p.cite) + '</strong>: ' + esc(p.title) + '</li>'; }).join("") + '</ul>' };
      }
      return null;
    }
    function qThread(t) {
      var member = byId[t.papers[Math.floor(Math.random() * t.papers.length)]];
      var wrong = [], seen = {};
      shuffle(papers.filter(function (p) { return t.papers.indexOf(p.id) < 0; })).forEach(function (p) { if (wrong.length < 3 && !seen[p.cite]) { seen[p.cite] = 1; wrong.push(p.cite); } });
      var o = opts(member.cite, wrong);
      if (!o) return null;
      return { cat: "thread", kicker: "Thread detective", prompt: "Which of these papers is grouped under this thread on the Connections page?", sub: t.title, opts: o,
        why: '<p class="why-h">This thread groups</p><ul>' + t.papers.map(function (id) { return '<li><a href="#/paper/' + id + '">' + esc(byId[id].cite) + '</a></li>'; }).join("") + '</ul><p class="small">' + kt(t.body, 3) + '</p>' };
    }

    /* ---------- question lists: one list per item; a missed question is re-asked as the next type in its list ---------- */
    function paperList(p) {
      var l = [function () { return qFinding(p); }, function () { return qPoint(p); }, function () { return qHole(p); },
        function () { return qConnect(p); }, function () { return qPaperConcept(p); }, function () { return qPoint(p); }];
      l.item = "p:" + p.id; return l;
    }
    function conceptList(c) {
      var l = [function () { return qConceptName(c, concepts); }, function () { return qConceptPaper(c); }, function () { return qConceptShort(c); }, function () { return qConceptExam(c); }];
      l.item = "c:" + c.slug; return l;
    }
    function glossList(g) { var l = [function () { return qTerm(g); }]; l.item = "g:" + g.term; return l; }
    function orderList(pool) { var l = [function () { return qOrder(pool); }]; l.item = null; return l; }
    function threadList(t) { var l = [function () { return qThread(t); }]; l.item = null; return l; }
    function fromList(list, idx) {
      for (var i = 0; i < list.length; i++) {
        var j = (idx + i) % list.length, q = list[j]();
        if (q) { q.list = list; q.idx = j; q.item = list.item; q.need = 1; q.attempts = 0; q.key = list.item; return q; }
      }
      return null;
    }
    function variant(q) {
      var v = fromList(q.list, (q.idx + 1) % q.list.length);
      if (!v) { v = { cat: q.cat, kicker: q.kicker, prompt: q.prompt, sub: q.sub, why: q.why, list: q.list, idx: q.idx, item: q.item, key: q.key, opts: shuffle(q.opts.map(function (o) { return { t: o.t, ok: o.ok }; })) }; }
      v.attempts = q.attempts; v.slot = q.slot;
      return v;
    }

    /* ---------- lessons (3 pages for a paper, 2 for a concept) ---------- */
    function topicName(id) { return (X.topicById[id] || { name: id }).name; }
    function lessonPaper(p) {
      var w = WK.p[p.id];
      var p1 = '<div class="ls-head"><span class="tag kind">' + esc(p.kind) + '</span><span class="tag">' + esc(topicName(p.topic)) + '</span></div><h2 class="ls-title" id="cr-prompt" tabindex="-1">' + esc(p.cite) + '</h2><p class="ls-sub">' + esc(p.title) + '</p>' +
        '<div class="callout take"><strong>The big idea</strong><p>' + kt(w.t) + '</p></div>' +
        '<h3>Why it was done</h3><p>' + kt(w.bg) + '</p><h3>What they did</h3><p>' + kt(w.ap) + '</p>';
      var p2 = '<h2 class="ls-title" id="cr-prompt" tabindex="-1">What it found</h2><p class="ls-sub">' + esc(p.cite) + '</p>' + ktList(w.f, 2) +
        (w.n && w.n.length ? '<h3>Numbers worth remembering</h3>' + ktList(w.n, 1) : '') + '<h3>In one line each</h3>' + ktList(p.points, 1);
      var terms = (w.terms || []).filter(function (s) { return conceptBy[s]; }).slice(0, 3);
      var p3 = '<h2 class="ls-title" id="cr-prompt" tabindex="-1">How to use it</h2><p class="ls-sub">' + esc(p.cite) + '</p>' +
        '<h3>The argument</h3><p class="arg">' + kt(w.arg) + '</p><h3>Where a committee will push</h3>' + ktList(w.lm, 2) +
        (terms.length ? '<h3>Terms to know</h3><dl class="mini">' + terms.map(function (s) { return '<dt>' + esc(conceptBy[s].name) + '</dt><dd>' + kt(conceptBy[s].short, 1) + '</dd>'; }).join("") + '</dl>' : '') +
        (w.cx && w.cx.length ? '<h3>Connects to</h3><ul>' + w.cx.slice(0, 3).map(function (y) { return '<li><strong>' + esc(byId[y[0]].cite) + '</strong>: ' + esc(trunc(y[1], 130)) + '</li>'; }).join("") + '</ul>' : '') +
        (w.ex && w.ex[0] ? '<div class="callout"><strong>A likely exam question</strong><p>' + kt(w.ex[0]) + '</p></div>' : '');
      return [p1, p2, p3];
    }
    function lessonConcept(c) {
      var p1 = '<div class="ls-head"><span class="tag">' + esc(c.group) + '</span></div><h2 class="ls-title" id="cr-prompt" tabindex="-1">' + esc(c.name) + '</h2>' +
        '<div class="def"><span class="def-l">In short</span><p>' + kt(c.short, 2) + '</p></div><p>' + kt(c.body, 5) + '</p>';
      var p2 = '<h2 class="ls-title" id="cr-prompt" tabindex="-1">Using it in an answer</h2><p class="ls-sub">' + esc(c.name) + '</p>' +
        (c.contrast ? '<div class="callout"><strong>Watch out</strong><p>' + kt(c.contrast) + '</p></div>' : '') +
        (c.exam && c.exam.length ? '<h3>Exam angles</h3>' + ktList(c.exam, 2) : '') +
        '<h3>Readings that bear on it</h3><ul>' + c.papers.filter(function (id) { return byId[id]; }).map(function (id) { return '<li><strong>' + esc(byId[id].cite) + '</strong>: ' + esc(trunc(WK.p[id].t, 120)) + '</li>'; }).join("") + '</ul>';
      return [p1, p2];
    }

    /* ---------- item lists and path ---------- */
    var prefs = { topic: "all", scope: "learned" };
    function conceptTopic(c) {
      var n = {}, best = null, bn = 0;
      c.papers.forEach(function (id) { if (byId[id]) n[byId[id].topic] = (n[byId[id].topic] || 0) + 1; });
      Object.keys(n).forEach(function (k) { if (n[k] > bn) { bn = n[k]; best = k; } });
      return best;
    }
    function pathItems() {
      var items = [];
      topics.forEach(function (t) {
        if (prefs.topic !== "all" && prefs.topic !== t.id) return;
        papers.filter(function (p) { return p.topic === t.id && WK.p[p.id]; }).forEach(function (p) { items.push({ key: "p:" + p.id, type: "p", id: p.id, track: t.id }); });
      });
      concepts.forEach(function (c) { if (prefs.topic === "all" || conceptTopic(c) === prefs.topic) items.push({ key: "c:" + c.slug, type: "c", id: c.slug, track: "concepts" }); });
      return items;
    }
    function itemTitle(it) { return it.type === "p" ? byId[it.id].cite : conceptBy[it.id].name; }
    function itemBlurb(it) { return it.type === "p" ? WK.p[it.id].t : conceptBy[it.id].short; }
    function learnedCount() { return Object.keys(S.learned).filter(function (k) { return k.indexOf("g:") !== 0; }).length; }
    function dueKeys() { return Object.keys(S.learned).filter(function (k) { return isDue(k) && (k.indexOf("p:") === 0 ? byId[k.slice(2)] : conceptBy[k.slice(2)]); }); }
    function nextUp() { var it = pathItems().filter(function (x) { return !S.learned[x.key]; }); return it.length ? it[0] : null; }
    function itemFromKey(k) { return k.indexOf("p:") === 0 ? { key: k, type: "p", id: k.slice(2) } : { key: k, type: "c", id: k.slice(2) }; }
    function listFor(it) { return it.type === "p" ? paperList(byId[it.id]) : conceptList(conceptBy[it.id]); }

    /* ---------- practice rounds (mixed questions; missed ones are still drilled until cleared) ---------- */
    function paperPool() {
      var all = papers.filter(function (p) { return (prefs.topic === "all" || p.topic === prefs.topic) && WK.p[p.id]; });
      if (prefs.scope === "learned") { var l = all.filter(function (p) { return S.learned["p:" + p.id]; }); if (l.length >= 5) return l; }
      return all;
    }
    function scopeNote() {
      var all = papers.filter(function (p) { return prefs.topic === "all" || p.topic === prefs.topic; }).length;
      var l = papers.filter(function (p) { return (prefs.topic === "all" || p.topic === prefs.topic) && S.learned["p:" + p.id]; }).length;
      if (prefs.scope === "learned" && l < 5) return "You have learned " + l + " here so far, so practice rounds use every paper until you reach 5.";
      return prefs.scope === "learned" ? "Practice rounds use the " + l + " papers you have learned." : "Practice rounds use all " + all + " papers.";
    }
    function conceptPool() {
      var pool = concepts.filter(function (c) { return prefs.topic === "all" || conceptTopic(c) === prefs.topic; });
      return pool.length >= 6 ? pool : concepts;
    }
    function rep(t, n) { var a = []; for (var i = 0; i < n; i++) a.push(t); return a; }
    var TYPEIDX = { finding: 0, point: 1, hole: 2, connect: 3 };
    function buildPlan(plan) {
      var pool = paperPool(), need = plan.filter(function (t) { return TYPEIDX[t] !== undefined; }).length;
      var ps = wpick(pool, function (p) { return "p:" + p.id; }, need);
      while (ps.length < need) ps = ps.concat(wpick(pool, function (p) { return "p:" + p.id; }, need - ps.length));
      var cp = wpick(conceptPool(), function (c) { return "c:" + c.slug; }, plan.filter(function (t) { return t === "concept"; }).length + 2);
      var gl = wpick(G.glossary, function (g) { return "g:" + g.term; }, plan.filter(function (t) { return t === "term"; }).length + 2);
      var ths = shuffle(G.threads), qs = [], pi = 0, ci = 0, gi = 0, ti = 0;
      plan.forEach(function (t) {
        var q = null;
        if (TYPEIDX[t] !== undefined) { q = fromList(paperList(ps[pi++]), TYPEIDX[t]); }
        else if (t === "term") { q = fromList(glossList(gl[gi++ % gl.length]), 0); }
        else if (t === "concept") { q = fromList(conceptList(cp[ci++ % cp.length]), Math.random() < 0.5 ? 0 : 2); }
        else if (t === "order") { q = fromList(orderList(pool), 0); }
        else if (t === "thread") { q = fromList(threadList(ths[ti++ % ths.length]), 0); }
        if (q) qs.push(q);
      });
      return shuffle(qs);
    }
    function dueQueue() {
      var keys = shuffle(dueKeys()).slice(0, 8), qs = [];
      keys.forEach(function (k) { var q = fromList(listFor(itemFromKey(k)), Math.floor(Math.random() * 4)); if (q) qs.push(q); });
      return qs;
    }
    var MODES = [
      { id: "quick", name: "Quick fire", icon: "bolt", n: 10, blurb: "Ten mixed questions across what you have learned.", plan: [].concat(rep("finding", 3), rep("point", 2), rep("hole", 2), ["term", "concept", "order"]) },
      { id: "paper", name: "Name that paper", icon: "target", n: 10, blurb: "Read a finding, pick the paper.", plan: rep("finding", 10) },
      { id: "holes", name: "Poke holes", icon: "search", n: 8, blurb: "Match each paper to the weakness a committee would press.", plan: rep("hole", 8) },
      { id: "connect", name: "Connect the dots", icon: "link", n: 8, blurb: "Which paper does this relationship point to?", plan: rep("connect", 8) },
      { id: "terms", name: "Terms and concepts", icon: "book", n: 10, blurb: "Definitions in, names out.", plan: [].concat(rep("concept", 5), rep("term", 5)) },
      { id: "time", name: "Timeline race", icon: "clock", n: 8, blurb: "Which paper came first?", plan: rep("order", 8) },
      { id: "thread", name: "Thread detective", icon: "link", n: 8, blurb: "Which paper belongs to which argument?", plan: rep("thread", 8) },
      { id: "boss", name: "Boss round", icon: "trophy", n: 20, blurb: "Twenty mixed questions, three hearts, double XP. No second chances.", boss: true,
        plan: [].concat(rep("finding", 6), rep("point", 4), rep("hole", 4), rep("term", 2), rep("concept", 2), ["order", "thread"]) }
    ];
    var modeById = {}; MODES.forEach(function (m) { modeById[m.id] = m; });

    /* ---------- icons ---------- */
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
      lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
      medal: '<circle cx="12" cy="14" r="6"/><path d="M8.5 3l3.5 6 3.5-6"/>',
      leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>',
      play: '<path d="M7 4l13 8-13 8z"/>',
      refresh: '<path d="M20 11a8 8 0 00-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0014 4l2-2"/><path d="M20 20v-5h-5"/>',
      circle: '<circle cx="12" cy="12" r="8"/>',
      half: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>',
      alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
      repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>'
    };
    function ic(n, cls) { return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[n] + '</svg>'; }
    var STATE_ICON = { "new": "circle", weak: "alert", learning: "half", mastered: "check" };

    /* ---------- badges ---------- */
    function masteredShare(id) {
      var list = papers.filter(function (p) { return p.topic === id; });
      return list.filter(function (p) { return state("p:" + p.id) === "mastered"; }).length / list.length;
    }
    var BADGES = [
      { id: "first", name: "First steps", icon: "flag", desc: "Finish a lesson or a round.", test: function () { return S.st.runs >= 1; } },
      { id: "learn5", name: "Scholar", icon: "book", desc: "Learn and clear 5 readings or concepts.", test: function () { return learnedCount() >= 5; } },
      { id: "learn25", name: "Deep reader", icon: "medal", desc: "Learn and clear 25 readings or concepts.", test: function () { return learnedCount() >= 25; } },
      { id: "clean", name: "Clean sweep", icon: "star", desc: "Clear a lesson without a single miss.", test: function () { return S.st.clean >= 1; } },
      { id: "retry", name: "Never gives up", icon: "repeat", desc: "Win 10 re-asked questions.", test: function () { return S.st.retried >= 10; } },
      { id: "hundred", name: "Hundred club", icon: "medal", desc: "Answer 100 questions.", test: function () { return S.st.answered >= 100; } },
      { id: "combo5", name: "On a roll", icon: "flame", desc: "Get 5 first tries right in a row.", test: function () { return S.st.bestCombo >= 5; } },
      { id: "combo10", name: "Unstoppable", icon: "bolt", desc: "Get 10 first tries right in a row.", test: function () { return S.st.bestCombo >= 10; } },
      { id: "goal", name: "Goal getter", icon: "target", desc: "Reach the daily XP goal (" + GOAL + " XP).", test: function () { return S.goalDays.length >= 1; } },
      { id: "streak3", name: "Three days running", icon: "flame", desc: "Study three days in a row.", test: function () { return streak() >= 3; } },
      { id: "streak7", name: "A full week", icon: "leaf", desc: "Study seven days in a row.", test: function () { return streak() >= 7; } },
      { id: "terms", name: "Word nerd", icon: "book", desc: "Get 25 term and concept questions right.", test: function () { return S.st.term >= 25; } },
      { id: "holes", name: "Devil's advocate", icon: "search", desc: "Get 15 limitation questions right.", test: function () { return S.st.holes >= 15; } },
      { id: "boss", name: "Boss slayer", icon: "trophy", desc: "Clear the Boss round with a heart to spare.", test: function () { return S.st.boss >= 1; } },
      { id: "t-epi", name: "Epigenetics expert", icon: "leaf", desc: "Master half of the Epigenetics readings.", test: function () { return masteredShare("epi") >= 0.5; } },
      { id: "t-clocks", name: "Clock master", icon: "clock", desc: "Master half of the Clocks readings.", test: function () { return masteredShare("clocks") >= 0.5; } },
      { id: "t-plasticity", name: "Plasticity expert", icon: "leaf", desc: "Master half of the Plasticity readings.", test: function () { return masteredShare("plasticity") >= 0.5; } }
    ];
    function checkBadges(into) {
      BADGES.forEach(function (b) { if (!S.badges[b.id] && b.test()) { S.badges[b.id] = today(); if (into) into.push(b); } });
    }

    /* ---------- session ---------- */
    var sess = null, armed = false, focusId = null;
    var GOOD = ["Nice one.", "Yes, that's it.", "Exactly right.", "Got it.", "Spot on."];

    function newSess(kind, mode) {
      return { kind: kind, mode: mode, item: null, phase: "drill", page: 0, pages: [], queue: [], total: 0, cleared: 0, firstOk: 0, misses: 0, retryRight: 0,
        combo: 0, best: 0, xp: 0, picked: -1, fb: null, hearts: kind === "boss" ? 3 : null, badges: [], levelUp: null, missedQs: [], itemRes: {}, bonus: 0, out: false, done: false, learnedNow: false };
    }
    function startLearn(key, drillOnly) {
      var it = itemFromKey(key);
      if (it.type === "p" ? !byId[it.id] : !conceptBy[it.id]) return;
      sess = newSess("learn", { id: "learn", name: "Learn: " + itemTitle(it) });
      sess.item = key;
      sess.pages = it.type === "p" ? lessonPaper(byId[it.id]) : lessonConcept(conceptBy[it.id]);
      if (drillOnly) startDrill(); else sess.phase = "lesson";
    }
    function startDrill() {
      var list = listFor(itemFromKey(sess.item)), qs = [];
      for (var i = 0; i < list.length; i++) { var q = fromList(list, i); if (q && !qs.some(function (x) { return x.idx === q.idx; })) qs.push(q); }
      qs.forEach(function (q, i) { q.slot = i; });
      sess.queue = qs; sess.total = qs.length; sess.phase = "drill"; sess.picked = -1; sess.fb = null;
    }
    function startMode(id) {
      var m = modeById[id], qs;
      if (id === "due") { qs = dueQueue(); m = { id: "due", name: "Review due", n: qs.length }; }
      else qs = buildPlan(m.plan);
      if (!qs.length) return;
      sess = newSess(m.boss ? "boss" : id === "due" ? "review" : "practice", m);
      qs.forEach(function (q, i) { q.slot = i; });
      sess.queue = qs; sess.total = qs.length;
    }
    function cur() { return sess.queue[0]; }
    function answer(idx) {
      if (!sess || sess.picked > -1 || sess.done || sess.phase !== "drill") return;
      var q = cur(), ok = q.opts[idx].ok, first = q.attempts === 0, before = levelInfo(S.xp).i, gain = 0;
      sess.picked = idx; q.attempts++;
      S.st.answered++;
      if (ok) {
        S.st.correct++;
        if (first) {
          sess.combo++; sess.firstOk++;
          if (sess.combo > sess.best) sess.best = sess.combo;
          if (sess.combo > S.st.bestCombo) S.st.bestCombo = sess.combo;
          gain = 10 + Math.min(sess.combo - 1, COMBO_CAP) * 2;
          if (q.cat === "term") S.st.term++;
          if (q.cat === "time") S.st.time++;
          if (q.cat === "holes") S.st.holes++;
        } else { gain = 4; sess.retryRight++; S.st.retried++; }
        if (sess.kind === "boss") gain *= 2;
      } else {
        sess.combo = 0;
        if (first) { sess.misses++; sess.missedQs.push(q); }
        if (sess.hearts !== null) sess.hearts--;
      }
      if (first && q.item) { sess.itemRes[q.item] = sess.itemRes[q.item] !== false && ok; if (sess.kind !== "learn") tally(q.item, ok); }
      addXp(gain); sess.xp += gain; touchDay();
      var nb = []; checkBadges(nb); sess.badges = sess.badges.concat(nb);
      var after = levelInfo(S.xp).i, lvl = after > before ? LEVELS[after][0] : null;
      if (lvl) sess.levelUp = lvl;
      var needMore = ok && q.need > 1;
      sess.fb = { ok: ok, first: first, gain: gain, level: lvl, newBadges: nb, needMore: needMore,
        text: ok ? (!first ? (needMore ? "Right. Once more to lock it in." : "Right. That one is cleared.") : (sess.combo >= 3 ? sess.combo + " in a row. " : "") + GOOD[(sess.combo + sess.cleared) % GOOD.length]) : "Not quite. Here is the fact, and this one comes back." };
      save();
    }
    function insertAt(v) { var pos = Math.min(sess.queue.length, 2); sess.queue.splice(pos, 0, v); }
    function next() {
      if (!sess || sess.picked < 0) return;
      var q = sess.queue.shift(), ok = q.opts[sess.picked].ok;
      sess.picked = -1; sess.fb = null;
      if (sess.kind === "boss") { if (sess.hearts === 0) { sess.out = true; return finish(); } if (!sess.queue.length) return finish(); return; }
      if (ok && q.need <= 1) { sess.cleared++; }
      else {
        var v = variant(q);
        v.need = ok ? q.need - 1 : NEED_AFTER_MISS; v.slot = q.slot;
        insertAt(v);
      }
      if (!sess.queue.length) finish();
    }
    function finish() {
      var before = levelInfo(S.xp).i, bonus = 0, n = sess.total;
      if (sess.kind === "learn") {
        var firstTime = !S.learned[sess.item];
        bonus = 20 + (sess.misses === 0 ? 10 : 0) + (firstTime ? 15 : 0);
        S.learned[sess.item] = Date.now();
        setBox(sess.item, sess.misses === 0 ? 3 : 2);
        if (sess.misses === 0) S.st.clean++;
        sess.learnedNow = firstTime;
      } else if (sess.kind === "review") {
        bonus = 15;
        Object.keys(sess.itemRes).forEach(function (k) { var m = S.m[k]; setBox(k, sess.itemRes[k] ? (m ? m.b + 1 : 1) : 1); });
      } else if (sess.kind === "practice") {
        bonus = 20 + (sess.misses === 0 && n >= 8 ? 20 : 0);
        Object.keys(sess.itemRes).forEach(function (k) { if (S.learned[k]) setBox(k, sess.itemRes[k] ? (S.m[k] ? S.m[k].b + 1 : 1) : 1); });
      } else if (sess.kind === "boss") {
        bonus = sess.out ? 0 : 60; if (!sess.out && sess.hearts >= 1) S.st.boss++;
      }
      S.st.runs++; addXp(bonus); sess.xp += bonus; sess.bonus = bonus; touchDay();
      var nb = []; checkBadges(nb); sess.badges = sess.badges.concat(nb);
      var after = levelInfo(S.xp).i; if (after > before) sess.levelUp = LEVELS[after][0];
      sess.done = true; sess.phase = "done"; save();
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
        '<div class="cr-stat cr-fire">' + ic("flame", st ? "on" : "") + '<span class="rv">' + st + '</span><p class="small cr-cap">day streak</p></div>' +
        '<p class="small cr-line">' + learnedCount() + ' of ' + (papers.length + concepts.length) + ' items learned' + (acc === null ? "" : ' &middot; ' + S.st.answered + ' answered &middot; ' + acc + '% right') + '</p></section>';
    }
    function topicChips() {
      return '<div class="chips" role="group" aria-label="Limit to a topic">' + [["all", "All topics"]].concat(topics.map(function (t) { return [t.id, t.name]; })).map(function (t) {
        return '<button type="button" class="chip" data-cr="topic" data-v="' + t[0] + '" aria-pressed="' + (prefs.topic === t[0]) + '">' + esc(t[1]) + '</button>';
      }).join("") + '</div>';
    }
    function hero() {
      var nu = nextUp(), due = dueKeys().length, html = "";
      if (nu) {
        html += '<section class="cr-hero"><span class="kicker">Next up</span><h2>' + esc(itemTitle(nu)) + '</h2><p class="small cr-tag">' + (nu.type === "p" ? esc(topicName(byId[nu.id].topic)) : 'Concept') + '</p><p>' + kt(trunc(itemBlurb(nu), 170), 2) + '</p>' +
          '<p class="cr-how">' + ic("book") + 'A 3-minute lesson, then a drill: anything you miss comes back until you get it right twice.</p>' +
          '<button type="button" class="btn big orange" data-cr="learn" data-v="' + nu.key + '">' + ic("play") + ' Start the lesson</button></section>';
      } else {
        html += '<section class="cr-hero"><span class="kicker">All lessons done</span><h2>You have worked through everything here</h2><p>Keep it fresh with review rounds, then try the Boss round.</p></section>';
      }
      if (due) html += '<section class="cr-due"><div><strong>' + due + ' item' + (due === 1 ? "" : "s") + ' due for review</strong><span class="small">Spaced repetition: coming back after a gap is what makes it stick.</span></div><button type="button" class="btn big" data-cr="start" data-v="due">' + ic("refresh") + ' Review now</button></section>';
      return html;
    }
    function row(it) {
      var s = state(it.key), due = isDue(it.key);
      return '<button type="button" class="cr-row s-' + s + '" data-cr="learn" data-v="' + it.key + '"><span class="st">' + ic(STATE_ICON[s]) + '</span><span class="rt"><strong>' + esc(itemTitle(it)) + '</strong><span>' + esc(trunc(itemBlurb(it), 100)) + '</span></span><span class="rs">' + (due ? 'Review due' : STATE_LABEL[s]) + '</span></button>';
    }
    function pathView() {
      var items = pathItems(), tracks = [];
      topics.forEach(function (t) { if (prefs.topic === "all" || prefs.topic === t.id) tracks.push([t.id, t.name]); });
      tracks.push(["concepts", "Key concepts"]);
      return '<h2>Learning path</h2><p class="small" style="margin:0">Tap any item to start its lesson and drill. Items go from Not started to Practicing to Cleared as you answer; cleared items come back for review on a schedule.</p>' + topicChips() +
        tracks.map(function (tr) {
          var list = items.filter(function (x) { return x.track === tr[0]; });
          if (!list.length) return "";
          var done = list.filter(function (x) { return S.learned[x.key]; }).length;
          return '<details class="cr-track"' + (tr[0] === (nextUp() || {}).track ? ' open' : '') + '><summary><strong>' + esc(tr[1]) + '</strong><span class="small">' + done + ' of ' + list.length + ' learned</span><span class="bar"><span style="width:' + Math.round(100 * done / list.length) + '%"></span></span></summary><div class="cr-rows">' + list.map(row).join("") + '</div></details>';
        }).join("");
    }
    function modeCard(m) {
      return '<button type="button" class="cr-mode' + (m.boss ? ' boss' : '') + '" data-cr="start" data-v="' + m.id + '">' +
        '<span class="cr-ico">' + ic(m.icon) + '</span><span class="cr-mt"><strong>' + esc(m.name) + '</strong><span>' + esc(m.blurb) + '</span></span><span class="cr-go">' + m.n + ' questions</span></button>';
    }
    function masteryMap() {
      var counts = { "new": 0, weak: 0, learning: 0, mastered: 0 };
      var html = topics.map(function (t) {
        return '<div class="mm-row"><h3>' + esc(t.name) + '</h3><div class="mm-grid">' + papers.filter(function (p) { return p.topic === t.id; }).map(function (p) {
          var s = state("p:" + p.id); counts[s]++;
          return '<button type="button" class="mm s-' + s + '" data-cr="learn" data-v="p:' + p.id + '" title="' + esc(p.cite + ": " + STATE_LABEL[s]) + '" aria-label="' + esc(p.cite + ", " + STATE_LABEL[s] + ". Start lesson") + '"></button>';
        }).join("") + '</div></div>';
      }).join("");
      return '<h2>Mastery map</h2><p class="small">One square per paper. Tap a square to start its lesson.</p>' +
        '<ul class="mm-key"><li><span class="mm s-new"></span>Not started (' + counts["new"] + ')</li><li><span class="mm s-weak"></span>Needs work (' + counts.weak + ')</li><li><span class="mm s-learning"></span>Practicing (' + counts.learning + ')</li><li><span class="mm s-mastered"></span>Cleared (' + counts.mastered + ')</li></ul>' + html;
    }
    function badgeShelf() {
      var got = BADGES.filter(function (b) { return S.badges[b.id]; }).length;
      return '<h2>Badges <span class="count">' + got + ' of ' + BADGES.length + '</span></h2><ul class="badges">' + BADGES.map(function (b) {
        var on = !!S.badges[b.id];
        return '<li class="badge' + (on ? ' on' : '') + '"><span class="bi">' + ic(on ? b.icon : "lock") + '</span><span><strong>' + esc(b.name) + '</strong><span class="small">' + esc(b.desc) + (on ? " Earned." : "") + '</span></span></li>';
      }).join("") + '</ul>';
    }
    function viewHub() {
      return '<span class="kicker">Cram</span><h1>Learn it, then drill it until it sticks</h1>' +
        '<p class="lead">Each reading and concept gets a short lesson, then a drill. Missed questions return as a different question on the same material and must be answered right twice before they clear.</p>' +
        statusCard() + hero() + pathView() +
        '<h2>Practice rounds</h2><p class="small" style="margin:0">Mixed questions for after you have learned a few items. Anything you miss is drilled until it clears, except in the Boss round.</p>' +
        '<div class="chips" role="group" aria-label="Question pool"><button type="button" class="chip" data-cr="scope" data-v="learned" aria-pressed="' + (prefs.scope === "learned") + '">What I have learned</button><button type="button" class="chip" data-cr="scope" data-v="all" aria-pressed="' + (prefs.scope === "all") + '">Everything</button></div>' +
        '<p class="small" style="margin:4px 0 10px">' + esc(scopeNote()) + '</p>' +
        '<div class="cr-modes">' + MODES.map(modeCard).join("") + '</div>' +
        masteryMap() + badgeShelf() +
        '<p class="small" style="margin-top:22px">Progress is saved in this browser only. <button class="chip" type="button" data-cr="reset">' + (armed ? 'Click again to erase Cram progress' : 'Reset Cram progress') + '</button></p>';
    }
    function confetti() {
      var cols = ["c1", "c2", "c3", "c4"], out = "";
      for (var i = 0; i < 26; i++) out += '<i class="' + cols[i % 4] + '" style="left:' + Math.round(Math.random() * 100) + '%;animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's;--dx:' + Math.round(Math.random() * 120 - 60) + 'px"></i>';
      return '<div class="confetti" aria-hidden="true">' + out + '</div>';
    }
    function stepper(phase) {
      var steps = [["lesson", "Learn"], ["drill", "Drill"], ["done", "Cleared"]], at = steps.map(function (s) { return s[0]; }).indexOf(phase);
      return '<ol class="cr-steps" aria-label="Progress">' + steps.map(function (s, i) { return '<li class="' + (i < at ? 'done' : i === at ? 'now' : '') + '"' + (i === at ? ' aria-current="step"' : '') + '><span>' + (i < at ? ic("check") : (i + 1)) + '</span>' + s[1] + '</li>'; }).join("") + '</ol>';
    }
    function topBar(label) {
      return '<div class="cr-top"><button type="button" class="chip" data-cr="quit">Back to Cram</button><span class="cr-mode-name">' + esc(label) + '</span></div>';
    }
    function viewLesson() {
      var last = sess.page >= sess.pages.length - 1, it = itemFromKey(sess.item);
      var dots = sess.pages.map(function (x, i) { return '<span class="' + (i === sess.page ? 'on' : i < sess.page ? 'done' : '') + '"></span>'; }).join("");
      return topBar(itemTitle(it)) + stepper("lesson") +
        '<section class="cr-q lesson"><p class="small ls-pg">Lesson page ' + (sess.page + 1) + ' of ' + sess.pages.length + '</p>' + sess.pages[sess.page] + '</section>' +
        '<div class="cr-act"><span class="dots" aria-hidden="true">' + dots + '</span>' +
        (sess.page > 0 ? '<button type="button" class="btn ghost big" data-cr="lback">Back</button>' : '<button type="button" class="btn ghost big" data-cr="skiplesson">Skip to drill</button>') +
        '<button type="button" class="btn big" id="cr-next" data-cr="lnext">' + (last ? 'Start the drill' : 'Next page') + '</button></div>';
    }
    function viewRun() {
      if (sess.done) return viewResults();
      if (sess.phase === "lesson") return viewLesson();
      var q = cur(), answered = sess.picked > -1, fb = sess.fb, learn = sess.kind === "learn";
      var pct = Math.round(100 * sess.cleared / sess.total);
      var hearts = "";
      if (sess.hearts !== null) { for (var h = 0; h < 3; h++) hearts += '<span class="hrt' + (h < sess.hearts ? ' on' : '') + '">' + ic("heart") + '</span>'; hearts = '<span class="cr-hearts" role="img" aria-label="' + sess.hearts + ' hearts left">' + hearts + '</span>'; }
      var o = q.opts.map(function (x, i) {
        var cls = "opt";
        if (answered) cls += x.ok ? " right" : (i === sess.picked ? " wrong" : " dim");
        return '<button type="button" class="' + cls + '" data-cr="pick" data-v="' + i + '"' + (answered ? ' disabled' : '') + '><span class="num">' + (answered && x.ok ? ic("check") : answered && i === sess.picked ? ic("cross") : (i + 1)) + '</span><span class="ot">' + esc(x.t) + '</span></button>';
      }).join("");
      var lastQ = sess.kind === "boss" ? (sess.hearts === 0 || sess.queue.length === 1) : (answered && sess.queue.length === 1 && fb.ok && !fb.needMore);
      var panel = "", bar = "";
      if (answered) {
        panel = '<div class="cr-fb ' + (fb.ok ? 'good' : 'bad') + '" role="status"><div class="fb-top"><strong>' + esc(fb.text) + '</strong>' + (fb.gain ? '<span class="xp-pop">+' + fb.gain + ' XP</span>' : '') + '</div>' +
          (fb.level ? '<p class="note">Level up: you are now a ' + esc(fb.level) + '.</p>' : '') +
          fb.newBadges.map(function (b) { return '<p class="note">New badge: ' + esc(b.name) + '.</p>'; }).join("") +
          (fb.ok && !fb.needMore ? '<details class="why"><summary>Review the fact</summary>' + q.why + '</details>' : '<div class="why">' + q.why + '</div>') + '</div>';
        bar = '<div class="cr-act fbbar ' + (fb.ok ? 'good' : 'bad') + '"><span class="vd">' + ic(fb.ok ? "check" : "cross") + '<span>' + (fb.ok ? (fb.gain ? '+' + fb.gain + ' XP' : 'Right') : 'Comes back') + '</span></span>' +
          '<button type="button" class="btn big" id="cr-next" data-cr="next">' + (lastQ ? (learn ? 'Finish' : 'See results') : fb.ok ? 'Next question' : 'Got it, keep going') + '</button></div>';
      }
      var meter = sess.kind === "boss" ? '<span class="cr-meta">Question ' + (sess.total - sess.queue.length + 1) + ' of ' + sess.total + '</span>' : '<span class="cr-meta">Cleared ' + sess.cleared + ' of ' + sess.total + '</span>';
      return topBar(sess.mode.name) + (learn ? stepper("drill") : '') +
        '<div class="cr-prog">' + meter + hearts + '</div>' +
        '<div class="bar" role="img" aria-label="' + pct + ' percent cleared"><span style="width:' + (sess.kind === "boss" ? Math.round(100 * (sess.total - sess.queue.length + (answered ? 1 : 0)) / sess.total) : pct) + '%"></span></div>' +
        '<div class="cr-pills"><span class="pill">' + ic("bolt") + sess.xp + ' XP</span><span class="pill' + (sess.combo >= 3 ? ' hot' : '') + '">' + ic("flame") + sess.combo + ' in a row</span>' +
        ((q.attempts - (answered ? 1 : 0)) > 0 ? '<span class="pill redo">' + ic("repeat") + 'Second chance' + (q.need > 1 ? ': right twice to clear' : '') + '</span>' : '') + '</div>' +
        '<section class="cr-q"><span class="tag kind">' + esc(q.kicker) + '</span><h2 class="cr-prompt" id="cr-prompt" tabindex="-1">' + esc(q.prompt) + '</h2>' + (q.sub ? '<p class="cr-sub">' + esc(q.sub) + '</p>' : '') +
        '<div class="cr-opts" role="group" aria-label="Answers. Press 1 to ' + q.opts.length + ' to choose.">' + o + '</div>' + panel + bar + '</section>' +
        '<p class="small cr-keys">Keyboard: 1 to ' + q.opts.length + ' to answer, Enter for next.</p>';
    }
    function viewResults() {
      var n = sess.total, L = levelInfo(S.xp), learn = sess.kind === "learn", boss = sess.kind === "boss";
      var acc = n ? Math.round(100 * sess.firstOk / n) : 0;
      var head, msg;
      if (learn) {
        head = 'Cleared: ' + esc(itemTitle(itemFromKey(sess.item)));
        msg = sess.misses === 0 ? "A clean sweep: every question right on the first try." : sess.misses + " question" + (sess.misses === 1 ? " was" : "s were") + " missed on the first try and then answered right twice. That is how it sticks.";
      } else if (boss) {
        head = sess.out ? "Out of hearts" : "Boss round complete";
        msg = sess.out ? "Boss rounds are meant to be hard. Every miss below is a clear target, so drill those readings next." : "You made it through " + n + " questions with " + sess.hearts + " heart" + (sess.hearts === 1 ? "" : "s") + " left.";
      } else {
        head = sess.mode.name + " cleared";
        msg = sess.misses === 0 ? "Every question right on the first try." : sess.misses + " missed on the first try, all cleared by the end.";
      }
      var nu = nextUp(), missedItems = {};
      sess.missedQs.forEach(function (q) { if (q.item && q.item.indexOf("g:") !== 0) missedItems[q.item] = 1; });
      return (acc >= 80 && !sess.out ? confetti() : "") +
        '<span class="kicker">' + (learn ? "Lesson complete" : "Round complete") + '</span><h1>' + head + '</h1><p class="lead">' + msg + '</p>' +
        '<div class="grid three cr-res"><div class="card"><span class="small">First-try correct</span><p class="big">' + sess.firstOk + ' of ' + n + '</p><p class="small">' + (boss ? "" : sess.retryRight + ' more won on a second chance') + '</p></div>' +
        '<div class="card"><span class="small">XP earned</span><p class="big">+' + sess.xp + '</p><p class="small">' + (sess.bonus ? sess.bonus + ' of that was the finish bonus' : 'No finish bonus this time') + '</p></div>' +
        '<div class="card"><span class="small">Level ' + (L.i + 1) + '</span><p class="big sm">' + esc(L.name) + '</p><div class="bar"><span style="width:' + L.pct + '%"></span></div><p class="small" style="margin:6px 0 0">' + (L.next ? L.left + ' XP to ' + esc(L.next) : 'Top level reached') + '</p></div></div>' +
        (sess.levelUp ? '<p class="cr-banner">Level up: you are now a ' + esc(sess.levelUp) + '.</p>' : '') +
        (sess.badges.length ? '<h2>New badges</h2><ul class="badges">' + sess.badges.map(function (b) { return '<li class="badge on"><span class="bi">' + ic(b.icon) + '</span><span><strong>' + esc(b.name) + '</strong><span class="small">' + esc(b.desc) + '</span></span></li>'; }).join("") + '</ul>' : '') +
        '<div class="cr-actions">' +
        (learn && nu ? '<button type="button" class="btn big orange" data-cr="learn" data-v="' + nu.key + '">Next: ' + esc(trunc(itemTitle(nu), 40)) + '</button>' : '') +
        (learn ? '<button type="button" class="btn big" data-cr="learn" data-v="' + sess.item + '" data-d="1">Drill it again</button>' : '<button type="button" class="btn big" data-cr="start" data-v="' + sess.mode.id + '">Play again</button>') +
        '<button type="button" class="btn ghost big" data-cr="quit">Back to Cram</button></div>' +
        (sess.missedQs.length ? '<h2>What tripped you up</h2><div class="cr-missed">' + sess.missedQs.map(function (q) {
          var right = q.opts.filter(function (x) { return x.ok; })[0].t;
          return '<details class="card"><summary><strong>' + esc(q.kicker) + ':</strong> ' + esc(trunc(q.prompt, 130)) + '</summary><p class="small" style="margin:10px 0 4px">Answer</p><p><strong>' + esc(right) + '</strong></p><div class="why">' + q.why + '</div></details>';
        }).join("") + '</div>' : '') +
        (Object.keys(missedItems).length && !learn ? '<h2>Re-learn these</h2><div class="cr-rows">' + Object.keys(missedItems).map(function (k) { return row(itemFromKey(k)); }).join("") + '</div>' : '');
    }
    function view() { return sess ? viewRun() : viewHub(); }

    /* ---------- events ---------- */
    function click(el) {
      var a = el.dataset.cr, v = el.dataset.v;
      if (a === "topic") { prefs.topic = v; X.rerender(); }
      else if (a === "scope") { prefs.scope = v; X.rerender(); }
      else if (a === "learn") { startLearn(v, !!el.dataset.d); X.refresh(); }
      else if (a === "start") { startMode(v); X.refresh(); }
      else if (a === "lnext") { if (sess.page >= sess.pages.length - 1) startDrill(); else sess.page++; X.refresh(); }
      else if (a === "lback") { if (sess.page > 0) sess.page--; X.refresh(); }
      else if (a === "skiplesson") { startDrill(); X.refresh(); }
      else if (a === "pick") { focusId = "cr-next"; answer(parseInt(v, 10)); X.rerender(); }
      else if (a === "next") { next(); X.refresh(); }
      else if (a === "quit") { sess = null; X.refresh(); }
      else if (a === "reset") { if (armed) { S = fresh(); save(); armed = false; } else { armed = true; } X.rerender(); }
    }
    function after() {
      var el = null;
      if (focusId) { el = document.getElementById(focusId); focusId = null; }
      if (!el && sess) el = document.getElementById("cr-prompt");
      if (el) { try { el.focus({ preventScroll: el.id === "cr-next" }); } catch (e) { el.focus(); } }
      if (el && el.id === "cr-next") { try { el.scrollIntoView({ block: "nearest" }); } catch (e2) { /* ignore */ } }
    }
    function key(e) {
      if (!sess || sess.done || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target && e.target.tagName; if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if (sess.phase === "lesson") {
        if (e.key === "ArrowRight" || (e.key === "Enter" && !(e.target && e.target.tagName === "BUTTON"))) { e.preventDefault(); click({ dataset: { cr: "lnext" } }); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); click({ dataset: { cr: "lback" } }); }
        return;
      }
      if (sess.picked < 0 && /^[1-9]$/.test(e.key)) {
        var i = parseInt(e.key, 10) - 1;
        if (i < cur().opts.length) { e.preventDefault(); focusId = "cr-next"; answer(i); X.rerender(); }
      } else if (sess.picked > -1 && (e.key === "Enter" || e.key === "ArrowRight")) {
        if (e.target && e.target.id === "cr-next") return;
        e.preventDefault(); next(); X.refresh();
      }
    }

    return { view: view, click: click, key: key, after: after, active: function () { return !!sess; } };
  };
})();
