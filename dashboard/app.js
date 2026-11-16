// radar-3 dashboard: renders window.RADAR (written by main.ts into ../data.js).
// No network, no fetch: the whole dataset ships with the page.
(function () {
  var R = window.RADAR;
  if (!R) { document.body.innerHTML = '<p style="padding:40px">No radar data: data.js did not load.</p>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var compact = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var pct = function (n) { return (n > 0 ? '+' : '') + n.toFixed(1) + '%'; };
  var age = function (d) { return d == null ? 'n/a' : (d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd'); };
  var mult = function (m) { return m.toFixed(3) + 'x'; };

  var state = { tab: 'pre', q: '', cat: '', chain: '', minTvl: 0, sort: 'rank' };
  var bySlug = {};
  R.rows.forEach(function (r) { bySlug[r.slug] = r; });
  var liveBySlug = {};
  R.live.forEach(function (r) { liveBySlug[r.slug] = r; });

  // ---- header chips -------------------------------------------------------
  $('meta-chips').innerHTML = [
    ['Snapshot', R.as_of],
    ['Source', esc(R.source)],
    ['Floor', compact(R.floor_usd)],
    ['Watchlist', R.watchlist_size + ' protocols'],
    ['Board', R.board_size + ' ranked'],
    ['Model', R.model_version],
  ].map(function (c) { return '<span class="chip">' + c[0] + ': <b>' + c[1] + '</b></span>'; }).join('');

  // ---- spotlight: top 5 ---------------------------------------------------
  $('spotlight-cards').innerHTML = R.rows.slice(0, 5).map(function (r) {
    return '<div class="card" data-slug="' + esc(r.slug) + '">' +
      '<div class="rank">#' + r.rank + '</div>' +
      '<div class="name">' + esc(r.name) + '</div>' +
      '<div class="cat">' + esc(r.category || 'Uncategorized') + ' &middot; ' + compact(r.tvl_usd) + ' TVL</div>' +
      '<div class="value">' + compact(r.implied_value_usd) + '</div>' +
      '<div class="range">' + compact(r.implied_low_usd) + ' &ndash; ' + compact(r.implied_high_usd) + '</div>' +
      '</div>';
  }).join('');

  // ---- model panel --------------------------------------------------------
  var cal = R.calibration;
  $('multiples-table').querySelector('tbody').innerHTML = cal.byCategory.map(function (c) {
    return '<tr><td>' + esc(c.category) + (c.fromGlobal ? ' *' : '') + '</td>' +
      '<td class="num">' + c.n + '</td><td class="num">' + mult(c.median) + '</td>' +
      '<td class="num">' + mult(c.p25) + ' &ndash; ' + mult(c.p75) + '</td></tr>';
  }).join('');
  $('model-check').innerHTML = 'In-sample check on <b>' + cal.check.n + '</b> tokened protocols in this snapshot: ' +
    'the calibrated model lands within 2&times; of the real market cap <b>' +
    (cal.check.within2x * 100).toFixed(0) + '%</b> of the time (median error <b>' +
    cal.check.medianFactor.toFixed(2) + '&times;</b>), against <b>' +
    (cal.check.flatWithin2x * 100).toFixed(0) + '%</b> for a flat 0.25&times; rule (median ' +
    cal.check.flatMedianFactor.toFixed(2) + '&times;). * = category too thin for its own multiple, so the global median is used. ' +
    'These are in-sample figures: they show the calibration fits the snapshot, not that it predicts the future.';

  // ---- filter options -----------------------------------------------------
  var cats = R.categories.map(function (c) { return c.category; });
  $('f-cat').innerHTML = '<option value="">All categories</option>' +
    cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
  var chainSet = {};
  R.rows.forEach(function (r) { r.chains.forEach(function (c) { chainSet[c] = true; }); });
  var chains = Object.keys(chainSet).sort();
  $('f-chain').innerHTML = '<option value="">All chains</option>' +
    chains.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');

  // ---- board --------------------------------------------------------------
  var PRE_HEAD = '<tr><th class="num">#</th><th>Protocol</th><th>Category</th><th>Chains</th>' +
    '<th class="num">TVL</th><th class="num">7d</th><th class="num">Age</th>' +
    '<th class="num">Implied value</th><th class="num">Range</th><th class="num">Multiple</th></tr>';
  var LIVE_HEAD = '<tr><th class="num">#</th><th>Protocol</th><th>Category</th><th>Chains</th>' +
    '<th class="num">TVL</th><th class="num">Market cap</th><th class="num">Multiple</th><th class="num">7d</th></tr>';
  var sorters = {
    rank: function (a, b) { return a.rank - b.rank; },
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    growth: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
    age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
    name: function (a, b) { return a.name < b.name ? -1 : 1; },
  };
  function filteredRows() {
    var q = state.q.toLowerCase();
    return R.rows.filter(function (r) {
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      if (state.cat && (r.category || 'Uncategorized') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      return true;
    }).sort(sorters[state.sort]);
  }
  function renderBoard() {
    var head = $('board-table').querySelector('thead');
    var body = $('board-table').querySelector('tbody');
    if (state.tab === 'pre') {
      head.innerHTML = PRE_HEAD;
      var rows = filteredRows();
      body.innerHTML = rows.map(function (r) {
        var chg = r.change_7d == null ? '&mdash;' :
          '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
        return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
          '<td><strong>' + esc(r.name) + '</strong><span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || 'Uncategorized') + '</td>' +
          '<td>' + esc(r.chains[0] || '') + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>' +
          '<td class="num">' + compact(r.tvl_usd) + '</td><td class="num">' + chg + '</td>' +
          '<td class="num">' + age(r.age_days) + '</td>' +
          '<td class="num"><strong>' + compact(r.implied_value_usd) + '</strong></td>' +
          '<td class="num">' + compact(r.implied_low_usd) + ' &ndash; ' + compact(r.implied_high_usd) + '</td>' +
          '<td class="num">' + mult(r.multiple) + '</td></tr>';
      }).join('');
      $('board-count').textContent = 'Showing ' + rows.length + ' of ' + R.board_size + ' pre-token protocols.';
    } else {
      head.innerHTML = LIVE_HEAD;
      body.innerHTML = R.live.map(function (r, i) {
        var chg = r.change_7d == null ? '&mdash;' :
          '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
        return '<tr data-slug="' + esc(r.slug) + '" data-live="1"><td class="num">' + (i + 1) + '</td>' +
          '<td><strong>' + esc(r.name) + '</strong><span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || 'Uncategorized') + '</td>' +
          '<td>' + esc(r.chains[0] || '') + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>' +
          '<td class="num">' + compact(r.tvl_usd) + '</td>' +
          '<td class="num"><strong>' + compact(r.mcap_usd || 0) + '</strong></td>' +
          '<td class="num">' + (r.multiple == null ? '&mdash;' : mult(r.multiple)) + '</td>' +
          '<td class="num">' + chg + '</td></tr>';
      }).join('');
      $('board-count').textContent = 'The ' + R.live.length + ' largest live-token protocols, by market cap — the market the multiples come from.';
    }
  }

  // ---- movers -------------------------------------------------------------
  $('movers-list').innerHTML = R.movers.map(function (r) {
    return '<li data-slug="' + esc(r.slug) + '"><div class="name">' + esc(r.name) + '</div>' +
      '<div class="chg up">' + pct(r.change_7d || 0) + '</div>' +
      '<div class="sub">#' + r.rank + ' &middot; ' + compact(r.tvl_usd) + ' TVL &middot; ' + esc(r.category || '') + '</div></li>';
  }).join('');

  // ---- categories ---------------------------------------------------------
  $('category-table').querySelector('tbody').innerHTML = R.categories.map(function (c) {
    return '<tr data-slug="' + esc(c.top_slug) + '"><td>' + esc(c.category) + '</td>' +
      '<td class="num">' + c.rows + '</td><td class="num">' + compact(c.tvl_usd) + '</td>' +
      '<td>' + esc(c.top_name) + '</td><td class="num">' + mult(c.multiple) + '</td></tr>';
  }).join('');

  // ---- provenance ---------------------------------------------------------
  $('provenance').textContent = 'Snapshot: ' + R.source + ', as of ' + R.as_of + '. ' +
    R.board_size + ' protocols ranked from the snapshot; ' + R.watchlist_size + ' on the watchlist; ' +
    R.live_size + ' already live. Model ' + R.model_version + '.';

  // ---- detail drawer ------------------------------------------------------
  function openDetail(slug) {
    var r = bySlug[slug];
    var body = $('drawer-body');
    if (r) {
      var comps = r.comparables.map(function (s) { return R.comparables[s]; }).filter(Boolean);
      var base = r.tvl_usd * r.growth_multiplier * r.maturity_multiplier * r.breadth_multiplier;
      body.innerHTML =
        '<h2>' + esc(r.name) + '</h2>' +
        '<p class="meta">#' + r.rank + ' &middot; ' + esc(r.category || 'Uncategorized') + ' &middot; ' +
        esc(r.chains.join(', ')) + ' &middot; TVL ' + compact(r.tvl_usd) + ' &middot; age ' + age(r.age_days) + '</p>' +
        '<div class="big">' + compact(r.implied_value_usd) + '</div>' +
        '<p class="band">Implied value, with the honest range ' + compact(r.implied_low_usd) + ' &ndash; ' + compact(r.implied_high_usd) + '.</p>' +
        '<h3>How the value is built</h3><div class="waterfall">' +
        '<div class="row"><span>TVL</span><span>' + money(r.tvl_usd) + '</span></div>' +
        '<div class="row"><span>&times; category multiple (' + esc(r.multiple_source) + ')</span><span>' + r.multiple.toFixed(4) + '&times;</span></div>' +
        '<div class="row"><span>&times; growth (7d ' + (r.change_7d == null ? 'n/a' : pct(r.change_7d)) + ')</span><span>' + r.growth_multiplier.toFixed(3) + '&times;</span></div>' +
        '<div class="row"><span>&times; maturity (' + age(r.age_days) + ' without a token)</span><span>' + r.maturity_multiplier.toFixed(3) + '&times;</span></div>' +
        '<div class="row"><span>&times; breadth (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</span><span>' + r.breadth_multiplier.toFixed(3) + '&times;</span></div>' +
        '<div class="row"><span>Implied value</span><span>' + money(r.implied_value_usd) + '</span></div>' +
        '</div>' +
        '<p class="meta">' + (r.multiple_source === 'global median'
          ? 'This category has too few tokened protocols in this snapshot for its own multiple, so the global median is used instead — the comparables below are the tokened ' + esc(r.category || 'Uncategorized') + ' protocols that exist. '
          : 'The multiple is the median of the tokened ' + esc(r.category || 'Uncategorized') + ' protocols below, taken from this snapshot — not a number chosen by hand. ') +
        'Base ' + money(Math.round(base)) + ' &times; ' + r.multiple.toFixed(4) + '&times;.</p>' +
        '<h3>Comparables — tokened protocols in the same category</h3>' +
        '<table class="comp"><thead><tr><th>Protocol</th><th class="num">Market cap</th><th class="num">TVL</th><th class="num">Multiple</th></tr></thead><tbody>' +
        comps.map(function (c) {
          return '<tr><td>' + esc(c.name) + '</td><td class="num">' + compact(c.mcap_usd) + '</td>' +
            '<td class="num">' + compact(c.tvl_usd) + '</td><td class="num">' + mult(c.multiple) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<h3>Farm plan — 8 steps</h3><ol class="steps">' +
        r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    } else {
      var l = liveBySlug[slug];
      if (!l) return;
      body.innerHTML =
        '<h2>' + esc(l.name) + '</h2>' +
        '<p class="meta">' + esc(l.category || 'Uncategorized') + ' &middot; ' + esc(l.chains.join(', ')) +
        ' &middot; already live &middot; TVL ' + compact(l.tvl_usd) + '</p>' +
        '<div class="big">' + compact(l.mcap_usd || 0) + '</div>' +
        '<p class="band">Market cap, as the market prices it — no model needed.</p>' +
        '<div class="waterfall">' +
        '<div class="row"><span>Market cap</span><span>' + money(l.mcap_usd || 0) + '</span></div>' +
        '<div class="row"><span>TVL</span><span>' + money(l.tvl_usd) + '</span></div>' +
        '<div class="row"><span>Market-cap-to-TVL multiple</span><span>' + (l.multiple == null ? 'n/a' : mult(l.multiple)) + '</span></div>' +
        '<div class="row"><span>7-day TVL change</span><span>' + (l.change_7d == null ? 'n/a' : pct(l.change_7d)) + '</span></div>' +
        '</div>' +
        '<p class="meta">This protocol already trades, so it cannot be farmed for a launch. It is shown because its ' +
        'multiple is part of the calibration that values the pre-token board.</p>';
    }
    $('drawer').hidden = false;
    try { history.replaceState(null, '', '#/detail/' + encodeURIComponent(slug)); } catch (e) { /* ignore */ }
  }
  function closeDetail() {
    $('drawer').hidden = true;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }
  $('drawer-close').addEventListener('click', closeDetail);
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-slug]');
    if (t) openDetail(t.getAttribute('data-slug'));
  });

  // ---- tabs and filters ---------------------------------------------------
  function setTab(tab) {
    state.tab = tab;
    $('tab-pre').classList.toggle('active', tab === 'pre');
    $('tab-live').classList.toggle('active', tab === 'live');
    $('filters').style.display = tab === 'pre' ? '' : 'none';
    renderBoard();
  }
  $('tab-pre').addEventListener('click', function () { setTab('pre'); });
  $('tab-live').addEventListener('click', function () { setTab('live'); });
  $('q').addEventListener('input', function () { state.q = $('q').value; renderBoard(); });
  $('f-cat').addEventListener('change', function () { state.cat = $('f-cat').value; renderBoard(); });
  $('f-chain').addEventListener('change', function () { state.chain = $('f-chain').value; renderBoard(); });
  $('f-tvl').addEventListener('change', function () { state.minTvl = Number($('f-tvl').value); renderBoard(); });
  $('f-sort').addEventListener('change', function () { state.sort = $('f-sort').value; renderBoard(); });

  // ---- hash routes: #/detail/<slug> and #/filter/<category> ---------------
  var hash = location.hash;
  if (hash.indexOf('#/filter/') === 0) {
    var cat = decodeURIComponent(hash.slice(9));
    if (cats.indexOf(cat) >= 0) { state.cat = cat; $('f-cat').value = cat; }
  }
  renderBoard();
  if (hash.indexOf('#/detail/') === 0) openDetail(decodeURIComponent(hash.slice(9)));
  window.__ready = true;
})();
