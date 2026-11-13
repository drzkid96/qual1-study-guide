(function () {
  "use strict";
  var G = window.GUIDE;
  var papers = G.papers, topics = G.topics;
  var byId = {}; papers.forEach(function (p) { byId[p.id] = p; });
  var topicById = {}; topics.forEach(function (t) { topicById[t.id] = t; });
  var WK = window.WIKI || { p: {}, c: [] };
  var concepts = WK.c, conceptBy = {}; concepts.forEach(function (c) { conceptBy[c.slug] = c; });
  var backlinks = {}; Object.keys(WK.p).forEach(function (id) { WK.p[id].cx.forEach(function (x) { (backlinks[x[0]] = backlinks[x[0]] || []).push(id); }); });
  var main = document.getElementById("main");
  var navEl = document.getElementById("nav");

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: progress lasts this visit only */ } }
  };
  var reviewed = store.get("qual1.reviewed", []);
  function isReviewed(id) { return reviewed.indexOf(id) > -1; }
  function setReviewed(id, on) {
    var i = reviewed.indexOf(id);
    if (on && i < 0) reviewed.push(id);
    if (!on && i > -1) reviewed.splice(i, 1);
    store.set("qual1.reviewed", reviewed);
  }
  function paperLink(p) {
    if (p.doi) return { href: "https://doi.org/" + p.doi, label: "Open paper (DOI)" };
    return { href: "https://scholar.google.com/scholar?q=" + encodeURIComponent(p.title), label: "Find paper (search)" };
  }
  var chevron = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- components ---------- */
  function paperCard(p, opts) {
    opts = opts || {};
    var l = paperLink(p);
    var hl = opts.hl || function (s) { return esc(s); };
    return '<details class="paper' + (isReviewed(p.id) ? ' reviewed' : '') + '" id="' + p.id + '"' + (opts.open ? ' open' : '') + '>' +
      '<summary><div class="p-top"><span class="p-cite">' + hl(p.cite) + '</span></div>' +
      '<p class="p-sum">' + hl(p.summary) + '</p>' +
      '<div class="p-tags"><span class="tag kind">' + esc(p.kind) + '</span>' +
      p.themes.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") +
      '<span class="more">Details ' + chevron + '</span></div></summary>' +
      '<div class="p-body">' +
      '<p class="p-title">' + hl(p.title) + '</p><p class="p-meta">' + esc(p.authors) + ' &middot; ' + esc(p.venue) + '</p>' +
      '<h4>Key points</h4><ul>' + p.points.map(function (x) { return '<li>' + hl(x) + '</li>'; }).join("") + '</ul>' +
      '<h4>How to use it</h4><p class="use">' + hl(p.use) + '</p>' +
      '<div class="p-foot">' + (WK.p[p.id] ? '<a href="#/wiki/p/' + p.id + '">Read the wiki page</a>' : '') + '<a href="' + esc(l.href) + '" target="_blank" rel="noopener noreferrer">' + l.label + '</a>' +
      '<label><input type="checkbox" data-review="' + p.id + '"' + (isReviewed(p.id) ? ' checked' : '') + '> Mark as reviewed</label></div>' +
      '</div></details>';
  }
  function pills(ids) {
    return '<ul class="pill-list">' + ids.map(function (id) {
      return '<li><a href="#/paper/' + id + '">' + esc(byId[id].cite) + '</a></li>';
    }).join("") + '</ul>';
  }
  function progressFor(list) {
    var done = list.filter(function (p) { return isReviewed(p.id); }).length;
    return { done: done, total: list.length, pct: list.length ? Math.round(100 * done / list.length) : 0 };
  }
  function bar(pr) { return '<div class="bar" role="img" aria-label="' + pr.done + ' of ' + pr.total + ' reviewed"><span style="width:' + pr.pct + '%"></span></div>'; }

  /* ---------- nav ---------- */
  var NAV = [["#/", "Start"], ["#/topic/epi", "Epigenetics"], ["#/topic/clocks", "Clocks"], ["#/topic/plasticity", "Plasticity"], ["#/wiki", "Wiki"], ["#/connect", "Connections"], ["#/practice", "Essay prompts"], ["#/test", "Self-test"], ["#/glossary", "Glossary"]];
  function renderNav(route) {
    navEl.innerHTML = NAV.map(function (n) {
      var cur = (n[0] === "#/" && (route === "" || route === "/")) || (n[0] !== "#/" && ("#" + route).indexOf(n[0]) === 0) ||
        (route.indexOf("/paper/") === 0 && n[0] === "#/topic/" + (byId[route.split("/")[2]] || {}).topic);
      return '<a href="' + n[0] + '"' + (cur ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join("");
  }

  /* ---------- views ---------- */
  function viewHome() {
    var all = progressFor(papers);
    return '<section class="hero"><span class="kicker">Qualifying exam 1</span>' +
      '<h1>Epigenetics, clocks and developmental plasticity</h1>' +
      '<p class="lead">' + papers.length + ' readings in three themes, with a short note on each, a wiki page for every paper and ' + concepts.length + ' concept pages, the threads that connect them, practice essay prompts and a self-test.</p></section>' +
      '<section class="card" style="margin:18px 0"><div class="progress-line"><strong>Your progress</strong><span>' + all.done + ' of ' + all.total + ' reviewed</span></div>' + bar(all) +
      '<p class="small" style="margin:10px 0 0">Tick "Mark as reviewed" inside any paper. Progress is saved in this browser only. <button class="chip" id="reset-progress" type="button">Reset progress</button></p></section>' +
      '<div class="grid three">' + topics.map(function (t) {
        var pr = progressFor(papers.filter(function (p) { return p.topic === t.id; }));
        return '<a class="card topic-card" href="#/topic/' + t.id + '"><span class="count">' + t.count + '</span><h3>' + esc(t.name) + '</h3><p>' + esc(t.blurb) + '</p>' + bar(pr) + '<span class="small">' + pr.done + ' of ' + pr.total + ' reviewed</span></a>';
      }).join("") + '</div>' +
      '<h2>How to use this guide</h2><ol class="steps">' +
      '<li><strong>Skim a topic.</strong> Each paper has a one-paragraph summary. Open details for key points and how to use it in an answer.</li>' +
      '<li><strong>Go deep in the wiki.</strong> Every paper has a synthesized page (question, approach, findings, argument, limits, exam angles), and concept pages tie papers together.</li>' +
      '<li><strong>Read the connections.</strong> The threads page shows how papers talk to each other, which is what exam answers need.</li>' +
      '<li><strong>Practice.</strong> Try an essay prompt, then quiz yourself with flashcards in either direction.</li></ol>' +
      '<p style="margin-top:22px"><a class="btn" href="#/connect">Start with the big picture</a> <a class="btn ghost" href="#/wiki">Open the wiki</a> <a class="btn ghost" href="#/test">Go to self-test</a></p>';
  }

  var topicState = { theme: "All", sort: "curated", unreviewed: false };
  function viewTopic(id, openId) {
    var t = topicById[id]; if (!t) return viewNotFound();
    var list = papers.filter(function (p) { return p.topic === id; });
    var counts = {}; t.themes.forEach(function (th) { counts[th] = list.filter(function (p) { return p.themes.indexOf(th) > -1; }).length; });
    var shown = list.filter(function (p) {
      return (topicState.theme === "All" || p.themes.indexOf(topicState.theme) > -1) && (!topicState.unreviewed || !isReviewed(p.id));
    });
    if (topicState.sort === "new") shown.sort(function (a, b) { return b.year - a.year; });
    if (topicState.sort === "old") shown.sort(function (a, b) { return a.year - b.year; });
    if (topicState.sort === "az") shown.sort(function (a, b) { return a.cite.localeCompare(b.cite); });
    var pr = progressFor(list);
    return '<span class="kicker">Topic</span><h1>' + esc(t.name) + '</h1><p class="lead">' + esc(t.blurb) + '</p>' +
      '<div class="progress-line"><span>' + pr.done + ' of ' + pr.total + ' reviewed</span></div>' + bar(pr) +
      '<div class="chips" role="group" aria-label="Filter by theme">' +
      ['All'].concat(t.themes).map(function (th) {
        var n = th === "All" ? list.length : counts[th];
        return '<button type="button" class="chip" data-theme="' + esc(th) + '" aria-pressed="' + (topicState.theme === th) + '">' + esc(th) + ' (' + n + ')</button>';
      }).join("") + '</div>' +
      '<div class="toolbar"><label>Sort <select id="sort">' + [["curated","Suggested order"],["new","Newest first"],["old","Oldest first"],["az","Author A to Z"]].map(function (o) { return '<option value="' + o[0] + '"' + (topicState.sort === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label>' +
      '<label><input type="checkbox" id="unrev"' + (topicState.unreviewed ? ' checked' : '') + '> Hide reviewed</label>' +
      '<span class="small">' + shown.length + ' shown</span></div>' +
      (shown.length ? '<div class="papers">' + shown.map(function (p) { return paperCard(p, { open: p.id === openId }); }).join("") + '</div>' : '<div class="empty">Nothing to show with these filters.</div>');
  }

  function viewConnect() {
    return '<span class="kicker">Big picture</span><h1>How the readings connect</h1><p class="lead">Exam answers usually draw on several papers at once. These threads group the readings by the argument they support. Select a paper to jump to its notes.</p>' +
      G.threads.map(function (t) { return '<article class="card thread"><h3>' + esc(t.title) + '</h3><p>' + esc(t.body) + '</p>' + pills(t.papers) + '</article>'; }).join("");
  }
  function viewPractice() {
    return '<span class="kicker">Practice</span><h1>Essay prompts</h1><p class="lead">Practice prompts written from the themes in the readings, with papers to draw on and a starting angle. They are suggestions for practice, not predictions of the exam.</p>' +
      G.prompts.map(function (q, i) {
        return '<article class="card prompt" style="margin-bottom:14px"><span class="tag">Prompt ' + (i + 1) + '</span><h3>' + esc(q.q) + '</h3><p class="small" style="margin-bottom:0">Papers to draw on</p>' + pills(q.papers) + '<p class="hint"><strong>Angle:</strong> ' + esc(q.hint) + '</p></article>';
      }).join("");
  }
  function viewGlossary() {
    return '<span class="kicker">Reference</span><h1>Glossary</h1><dl class="gloss">' +
      G.glossary.map(function (g) { return '<div><dt>' + esc(g.term) + '</dt><dd>' + esc(g.def_) + '</dd></div>'; }).join("") + '</dl>';
  }

  /* ---------- self-test ---------- */
  var deck = null; // { cards:[ids], i, shown, got:[], missed:[], mode, topic }
  var testPrefs = { topic: "all", mode: "finding" };
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function startDeck(ids) { deck = { cards: shuffle(ids), i: 0, shown: false, got: [], missed: [] }; }
  function viewTest() {
    var setup = '<div class="deck-setup"><label>Topic <select id="t-topic"><option value="all">All topics</option>' +
      topics.map(function (t) { return '<option value="' + t.id + '"' + (testPrefs.topic === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join("") + '</select></label>' +
      '<label>Direction <select id="t-mode"><option value="finding"' + (testPrefs.mode === "finding" ? " selected" : "") + '>Paper to finding</option><option value="paper"' + (testPrefs.mode === "paper" ? " selected" : "") + '>Finding to paper</option></select></label>' +
      '<button class="btn" id="t-start" type="button">' + (deck ? "Restart" : "Start") + '</button></div>';
    var head = '<span class="kicker">Self-test</span><h1>Flashcards</h1><p class="lead">Pick a direction. "Paper to finding" shows a citation and asks what it found. "Finding to paper" shows a finding and asks which paper it is.</p>' + setup;
    if (!deck) return head;
    if (deck.i >= deck.cards.length) {
      return head + '<div class="card"><h3>Round complete</h3><p>' + deck.got.length + ' of ' + deck.cards.length + ' marked "Got it".</p>' +
        (deck.missed.length ? '<button class="btn orange" id="t-missed" type="button">Redo the ' + deck.missed.length + ' to review</button>' : '<p>Nothing left to review in this round.</p>') + '</div>';
    }
    var p = byId[deck.cards[deck.i]];
    var front, back;
    if (testPrefs.mode === "finding") {
      front = '<div><span class="tag kind">' + esc(p.kind) + '</span><span class="tag">' + esc(topicById[p.topic].name) + '</span><p class="q" style="margin-top:12px">' + esc(p.cite) + '</p><p class="muted">What did it do and find?</p></div>';
      back = '<p>' + esc(p.summary) + '</p><ul>' + p.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
    } else {
      front = '<div><span class="tag">' + esc(topicById[p.topic].name) + '</span><p class="q" style="margin-top:12px">' + esc(p.summary) + '</p><p class="muted">Which paper is this?</p></div>';
      back = '<p><strong>' + esc(p.cite) + '</strong><br>' + esc(p.title) + '</p><ul>' + p.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
    }
    return head + '<div class="progress-line"><span>Card ' + (deck.i + 1) + ' of ' + deck.cards.length + '</span><span>' + deck.got.length + ' got it, ' + deck.missed.length + ' to review</span></div>' +
      '<div class="flash-card" aria-live="polite">' + front + (deck.shown ? '<div class="a">' + back + '</div>' : '') +
      '<div class="flash-actions">' + (deck.shown ?
        '<button class="btn" id="t-got" type="button">Got it</button><button class="btn orange" id="t-miss" type="button">Review again</button>' :
        '<button class="btn" id="t-show" type="button">Show answer</button>') + '</div></div>';
  }


  /* ---------- wiki ---------- */
  function list(items) { return '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>'; }
  function wikiLink(id) { return '<a href="#/wiki/p/' + id + '">' + esc(byId[id].cite) + '</a>'; }
  function conceptPills(slugs) {
    return '<ul class="pill-list">' + slugs.map(function (sl) { return '<li><a href="#/wiki/c/' + sl + '">' + esc(conceptBy[sl].name) + '</a></li>'; }).join("") + '</ul>';
  }
  function wikiTabs(cur) {
    return '<p class="subnav">' + [["#/wiki", "Papers"], ["#/wiki/concepts", "Concepts"], ["#/wiki/timeline", "Timeline"]].map(function (t) {
      return '<a href="' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
    }).join("") + '</p>';
  }
  function viewWiki() {
    return '<span class="kicker">Wiki</span><h1>Reading wiki</h1>' +
      '<p class="lead">One page for every assigned paper, written as a synthesis in plain wording: the question, the approach, the findings, the argument, and where it connects. Concept pages pull the papers together.</p>' + wikiTabs("#/wiki") +
      topics.map(function (t) {
        var list = papers.filter(function (p) { return p.topic === t.id && WK.p[p.id]; });
        return '<section class="wiki-sec"><h2>' + esc(t.name) + ' <span class="count">' + list.length + '</span></h2><ul class="wiki-list">' +
          list.map(function (p) { return '<li><a class="w-cite" href="#/wiki/p/' + p.id + '">' + esc(p.cite) + '</a><span class="w-take">' + esc(WK.p[p.id].t) + '</span></li>'; }).join("") + '</ul></section>';
      }).join("");
  }
  function viewWikiPaper(id) {
    var p = byId[id], w = WK.p[id], t = topicById[p.topic], l = paperLink(p);
    var idx = papers.filter(function (x) { return x.topic === p.topic; }), i = idx.indexOf(p);
    var prev = idx[i - 1], next = idx[i + 1];
    var bl = (backlinks[id] || []).filter(function (x) { return x !== id; });
    return '<span class="kicker"><a href="#/wiki">Wiki</a> &middot; ' + esc(t.name) + ' &middot; ' + p.year + '</span><h1>' + esc(p.cite) + '</h1>' +
      '<p class="lead">' + esc(p.title) + '</p><p class="p-meta">' + esc(p.authors) + ' &middot; ' + esc(p.venue) + ' &middot; ' + esc(p.kind) + '</p>' +
      '<div class="callout"><strong>Takeaway</strong><p>' + esc(w.t) + '</p></div>' +
      '<h2>Background</h2><p>' + esc(w.bg) + '</p><h2>Approach</h2><p>' + esc(w.ap) + '</p>' +
      '<h2>Findings</h2>' + list(w.f) + '<h2>Argument</h2><p>' + esc(w.arg) + '</p>' +
      '<div class="two"><div><h3>Strengths</h3>' + list(w.st) + '</div><div><h3>Limits</h3>' + list(w.lm) + '</div></div>' +
      (w.n.length ? '<h3>Numbers worth remembering</h3>' + list(w.n) : '') +
      '<h2>Concepts</h2>' + conceptPills(w.terms) +
      '<h2>Connections</h2><ul class="conn">' + w.cx.map(function (x) { return '<li>' + wikiLink(x[0]) + ' <span>' + esc(x[1]) + '</span></li>'; }).join("") + '</ul>' +
      (bl.length ? '<h3>Referenced from</h3><ul class="pill-list">' + bl.map(function (x) { return '<li>' + wikiLink(x) + '</li>'; }).join("") + '</ul>' : '') +
      '<h2>Exam angles</h2>' + list(w.ex) +
      '<p class="p-foot"><a href="#/paper/' + id + '">Study-guide card</a><a href="' + esc(l.href) + '" target="_blank" rel="noopener noreferrer">' + l.label + '</a></p>' +
      '<p class="pager">' + (prev ? '<a href="#/wiki/p/' + prev.id + '">&larr; ' + esc(prev.cite) + '</a>' : '<span></span>') + (next ? '<a href="#/wiki/p/' + next.id + '">' + esc(next.cite) + ' &rarr;</a>' : '<span></span>') + '</p>';
  }
  function viewConcepts() {
    var groups = []; concepts.forEach(function (c) { if (groups.indexOf(c.group) < 0) groups.push(c.group); });
    return '<span class="kicker">Wiki</span><h1>Concepts</h1><p class="lead">Short explainers with the papers that bear on each idea.</p>' + wikiTabs("#/wiki/concepts") +
      groups.map(function (g) {
        return '<section class="wiki-sec"><h2>' + esc(g) + '</h2><ul class="wiki-list">' + concepts.filter(function (c) { return c.group === g; }).map(function (c) {
          return '<li><a class="w-cite" href="#/wiki/c/' + c.slug + '">' + esc(c.name) + '</a><span class="w-take">' + esc(c.short) + '</span></li>';
        }).join("") + '</ul></section>';
      }).join("");
  }
  function viewConcept(slug) {
    var c = conceptBy[slug]; if (!c) return viewNotFound();
    var rel = {}; c.papers.forEach(function (id) { WK.p[id].terms.forEach(function (t) { if (t !== slug) rel[t] = (rel[t] || 0) + 1; }); });
    var relList = Object.keys(rel).sort(function (a, b) { return rel[b] - rel[a]; }).slice(0, 6);
    return '<span class="kicker"><a href="#/wiki/concepts">Concepts</a> &middot; ' + esc(c.group) + '</span><h1>' + esc(c.name) + '</h1><p class="lead">' + esc(c.short) + '</p>' +
      '<p>' + esc(c.body) + '</p>' + (c.contrast ? '<div class="callout"><strong>Watch out</strong><p>' + esc(c.contrast) + '</p></div>' : '') +
      (c.exam.length ? '<h2>Exam angles</h2>' + list(c.exam) : '') +
      '<h2>Papers (' + c.papers.length + ')</h2><ul class="wiki-list">' + c.papers.map(function (id) {
        return '<li><a class="w-cite" href="#/wiki/p/' + id + '">' + esc(byId[id].cite) + '</a><span class="w-take">' + esc(WK.p[id].t) + '</span></li>'; }).join("") + '</ul>' +
      (relList.length ? '<h3>Related concepts</h3>' + conceptPills(relList) : '');
  }
  function viewTimeline() {
    var list = papers.slice().sort(function (a, b) { return a.year - b.year || a.cite.localeCompare(b.cite); });
    var decades = []; list.forEach(function (p) { var d = Math.floor(p.year / 10) * 10; if (decades.indexOf(d) < 0) decades.push(d); });
    return '<span class="kicker">Wiki</span><h1>Timeline</h1><p class="lead">Every paper in publication order, to see how the ideas build.</p>' + wikiTabs("#/wiki/timeline") +
      decades.map(function (d) {
        return '<section class="wiki-sec"><h2>' + d + 's</h2><ul class="wiki-list">' + list.filter(function (p) { return Math.floor(p.year / 10) * 10 === d; }).map(function (p) {
          return '<li><a class="w-cite" href="#/wiki/p/' + p.id + '">' + esc(p.cite) + '</a><span class="w-take"><span class="tag">' + esc(topicById[p.topic].name) + '</span> ' + esc(WK.p[p.id].t) + '</span></li>'; }).join("") + '</ul></section>';
      }).join("");
  }

  /* ---------- search ---------- */
  function viewSearch(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return '<h1>Search</h1><p class="lead">Type a paper, finding or term in the search box.</p>';
    function match(s) { s = s.toLowerCase(); return terms.every(function (t) { return s.indexOf(t) > -1; }); }
    var re = new RegExp("(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "ig");
    function hl(s) { return esc(s).replace(re, "<mark>$1</mark>"); }
    function wtext(p) { var w = WK.p[p.id]; return w ? [w.t, w.bg, w.ap, w.f.join(" "), w.arg, w.st.join(" "), w.lm.join(" "), w.n.join(" "), w.ex.join(" ")].join(" ") : ""; }
    var hits = papers.filter(function (p) { return match([p.cite, p.title, p.authors, p.venue, p.summary, p.points.join(" "), p.use, p.themes.join(" "), wtext(p)].join(" ")); });
    var chits = concepts.filter(function (c) { return match([c.name, c.short, c.body, c.contrast, c.exam.join(" ")].join(" ")); });
    var terms2 = G.glossary.filter(function (g) { return match(g.term + " " + g.def_); });
    return '<span class="kicker">Search</span><h1>Results for "' + esc(q) + '"</h1><p class="lead">' + hits.length + ' paper' + (hits.length === 1 ? "" : "s") + ', ' + chits.length + ' concept page' + (chits.length === 1 ? "" : "s") + ' and ' + terms2.length + ' glossary term' + (terms2.length === 1 ? "" : "s") + '.</p>' +
      (chits.length ? '<h2>Concept pages</h2><ul class="wiki-list">' + chits.map(function (c) { return '<li><a class="w-cite" href="#/wiki/c/' + c.slug + '">' + hl(c.name) + '</a><span class="w-take">' + hl(c.short) + '</span></li>'; }).join("") + '</ul>' : '') +
      (hits.length ? '<div class="papers">' + hits.map(function (p) { return paperCard(p, { hl: hl }); }).join("") + '</div>' : '') +
      (terms2.length ? '<h2>Glossary</h2><dl class="gloss">' + terms2.map(function (g) { return '<div><dt>' + hl(g.term) + '</dt><dd>' + hl(g.def_) + '</dd></div>'; }).join("") + '</dl>' : '') +
      (!hits.length && !terms2.length && !chits.length ? '<div class="empty">No matches. Try a shorter word.</div>' : '');
  }
  function viewNotFound() { return '<h1>Page not found</h1><p><a href="#/">Back to start</a></p>'; }

  /* ---------- router ---------- */
  var current = { route: "" };
  function route() {
    var h = decodeURIComponent((location.hash || "#/").slice(1));
    var r = h.split("?")[0]; current.route = r;
    var parts = r.split("/").filter(Boolean), html, scrollTo = null, title = "Qual 1 Study Guide";
    if (!parts.length) html = viewHome();
    else if (parts[0] === "topic") { html = viewTopic(parts[1]); title = (topicById[parts[1]] || { name: "Topic" }).name + " | " + title; }
    else if (parts[0] === "paper" && byId[parts[1]]) {
      var p = byId[parts[1]]; topicState.theme = "All"; topicState.unreviewed = false; topicState.sort = "curated";
      html = viewTopic(p.topic, p.id); scrollTo = p.id; title = p.cite + " | " + title;
    }
    else if (parts[0] === "wiki") {
      if (!parts[1]) { html = viewWiki(); title = "Wiki | " + title; }
      else if (parts[1] === "p" && byId[parts[2]] && WK.p[parts[2]]) { html = viewWikiPaper(parts[2]); title = byId[parts[2]].cite + " (wiki) | " + title; }
      else if (parts[1] === "c" && conceptBy[parts[2]]) { html = viewConcept(parts[2]); title = conceptBy[parts[2]].name + " | " + title; }
      else if (parts[1] === "concepts") { html = viewConcepts(); title = "Concepts | " + title; }
      else if (parts[1] === "timeline") { html = viewTimeline(); title = "Timeline | " + title; }
      else html = viewNotFound();
    }
    else if (parts[0] === "connect") { html = viewConnect(); title = "Connections | " + title; }
    else if (parts[0] === "practice") { html = viewPractice(); title = "Essay prompts | " + title; }
    else if (parts[0] === "test") { html = viewTest(); title = "Self-test | " + title; }
    else if (parts[0] === "glossary") { html = viewGlossary(); title = "Glossary | " + title; }
    else if (parts[0] === "search") { html = viewSearch(r.slice("/search/".length)); title = "Search | " + title; }
    else html = viewNotFound();
    main.innerHTML = html; document.title = title; renderNav(r);
    if (scrollTo) { var el = document.getElementById(scrollTo); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } }
    else if (!route.keepScroll) { window.scrollTo(0, 0); }
    route.keepScroll = false;
  }
  function rerender() { route.keepScroll = true; var y = window.scrollY; route(); window.scrollTo(0, y); }

  /* ---------- events ---------- */
  main.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.review) {
      setReviewed(t.dataset.review, t.checked);
      var card = t.closest(".paper"); if (card) card.classList.toggle("reviewed", t.checked);
      if (current.route.indexOf("/topic/") === 0 || current.route === "") { /* counts refresh on next render */ }
    } else if (t.id === "sort") { topicState.sort = t.value; rerender(); }
    else if (t.id === "unrev") { topicState.unreviewed = t.checked; rerender(); }
    else if (t.id === "t-topic") { testPrefs.topic = t.value; }
    else if (t.id === "t-mode") { testPrefs.mode = t.value; if (deck) { deck.shown = false; } rerender(); }
  });
  main.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.theme) { topicState.theme = b.dataset.theme; rerender(); }
    else if (b.id === "reset-progress") { if (b.dataset.armed) { reviewed = []; store.set("qual1.reviewed", reviewed); rerender(); } else { b.dataset.armed = "1"; b.textContent = "Click again to clear all"; } }
    else if (b.id === "t-start") {
      var ids = papers.filter(function (p) { return testPrefs.topic === "all" || p.topic === testPrefs.topic; }).map(function (p) { return p.id; });
      startDeck(ids); rerender();
    }
    else if (b.id === "t-show") { deck.shown = true; rerender(); }
    else if (b.id === "t-got") { deck.got.push(deck.cards[deck.i]); deck.i++; deck.shown = false; rerender(); }
    else if (b.id === "t-miss") { deck.missed.push(deck.cards[deck.i]); deck.i++; deck.shown = false; rerender(); }
    else if (b.id === "t-missed") { startDeck(deck.missed); rerender(); }
  });
  document.getElementById("search-form").addEventListener("submit", function (e) {
    e.preventDefault(); var q = document.getElementById("q").value.trim();
    location.hash = q ? "#/search/" + encodeURIComponent(q) : "#/";
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeprint", function () { document.querySelectorAll("details.paper").forEach(function (d) { d.open = true; }); });
  route();
})();
