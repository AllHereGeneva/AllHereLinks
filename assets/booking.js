/**
 * Booking options.
 *
 * Lists what we offer and sends each one to its own calendar on
 * allherelounge.com/booking/. It doesn't book: reserving needs a signed-in account
 * and credits (the API answers 402 no_credit when they run out), and all of that
 * already lives on that page. Duplicating it here would mean every future booking
 * change had to be made twice.
 *
 * It used to list the next few dated slots. Activities are the better unit: a date
 * is stale the moment it passes, whereas "we run these five things" holds, and the
 * booking page's own calendar is a better place to choose a time than three rows on
 * a landing page.
 *
 * `?a=<type>` on that page calls its `flowPick(type)` and opens that activity's
 * calendar directly, so every row is a real deep link. It also guesses the venue
 * from the browser timezone, which is why nothing here needs to.
 */
(function () {
  'use strict';

  var API = 'https://api.allherelounge.com/booking';
  var BOOKING_URL = 'https://allherelounge.com/booking/';

  /**
   * What we offer, in the order it should be read — shortest and most accessible
   * first, deepest last. `type` is both the id the API tags slots with and the id
   * the booking page's `?a=` deep link accepts.
   *
   * The names are ours, not the API's, in one case: the API still titles the EEG
   * activity "EEG Meditation Session", while the Lounge site calls it a Quantified
   * Meditation Session in public. The public name wins.
   */
  var ACTIVITIES = [
    { type: 'xr',    name: 'Silent Mind XR Session' },
    { type: 'zenbu', name: 'Zenbu Koko' },
    { type: 'eeg',   name: 'Quantified Meditation Session' },
    { type: 'lmt',   name: 'Track &amp; Train' },
    { type: 'qm',    name: 'QM Session' },
  ];

  /**
   * Display names for the venue ids the API tags activities with, and the currency
   * to price them in.
   *
   * `currency` is only set where it's actually known. The API returns a bare number
   * for `price` and no currency (per-venue currency is still a config item in the
   * multi-venue plan), and a price against the wrong symbol is worse than no price.
   */
  var VENUES = {
    geneva:     { name: 'Geneva', currency: 'CHF' },
    hyderabad:  { name: 'Hyderabad' },
    losangeles: { name: 'Los Angeles' },
    tokyo:      { name: 'Tokyo' },
  };

  var root = document.getElementById('booking');
  var body = document.getElementById('booking-body');
  if (!root || !body) return;

  // --- rendering --------------------------------------------------------

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /**
   * The rows, from the config alone — no data needed, so they go up immediately.
   * The catalogue then fills in each row's details (see describe); if it never
   * arrives, the list still stands and every link still works.
   */
  var metaFor = {};

  function render() {
    body.textContent = '';
    var list = el('ul', 'booking__options');

    ACTIVITIES.forEach(function (act) {
      var li = document.createElement('li');
      var a = el('a', 'booking__option');
      a.href = BOOKING_URL + '?a=' + encodeURIComponent(act.type);
      a.target = '_blank';
      a.rel = 'noopener';

      var text = el('span', 'booking__what');
      // innerHTML for the one name carrying an entity (Track &amp; Train).
      var name = el('span', 'booking__session');
      name.innerHTML = act.name;
      text.appendChild(name);

      var meta = el('span', 'booking__meta', metaFor[act.type] || '');
      meta.setAttribute('data-type', act.type);
      text.appendChild(meta);

      a.appendChild(text);
      a.appendChild(el('span', 'booking__chevron', '›'));
      li.appendChild(a);
      list.appendChild(li);
    });

    body.appendChild(list);

    var cta = el('a', 'booking__cta', 'See the full calendar ›');
    cta.href = BOOKING_URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    body.appendChild(cta);
  }

  /**
   * One line per activity: where it runs, how long it takes, what it costs — each
   * part included only when the catalogue says it unambiguously.
   *
   * Duration is dropped when a type's slots differ in length (the EEG sessions run
   * both 120 and 150 minutes), and price is dropped unless the type runs at exactly
   * one venue whose currency we know. Both rules exist so a row can be short but
   * never wrong.
   */
  function describe(group) {
    var parts = [];

    // Walk VENUES rather than the group, so venues always read in the declared
    // order instead of whatever order the API happened to return them in.
    var venues = Object.keys(VENUES).filter(function (v) { return group.venues[v]; });
    if (venues.length) {
      parts.push(venues.map(function (v) { return VENUES[v].name; }).join(', '));
    }

    var minutes = Object.keys(group.minutes);
    if (minutes.length === 1) parts.push(minutes[0] + ' min');

    var prices = Object.keys(group.prices);
    if (prices.length === 1 && venues.length === 1 && VENUES[venues[0]].currency) {
      parts.push(prices[0] + ' ' + VENUES[venues[0]].currency);
    }

    return parts.join('  ·  ');
  }

  function enrich(data) {
    if (!data || !data.activities) return;

    var groups = {};
    data.activities.forEach(function (a) {
      if (!a.type) return;
      var g = groups[a.type] || (groups[a.type] = { venues: {}, minutes: {}, prices: {} });
      if (a.venue) g.venues[a.venue] = true;
      if (a.slotMinutes) g.minutes[a.slotMinutes] = true;
      if (a.price != null) g.prices[a.price] = true;
    });

    ACTIVITIES.forEach(function (act) {
      var g = groups[act.type];
      if (!g) return;
      metaFor[act.type] = describe(g);
      var slot = body.querySelector('.booking__meta[data-type="' + act.type + '"]');
      if (slot) slot.textContent = metaFor[act.type];
    });
  }

  // --- start ------------------------------------------------------------

  render();

  function load() {
    // 24 KB, and the API doesn't compress it. The rows don't need it — only their
    // detail lines do — so it waits until the panel is within a screen of the
    // viewport: immediately on desktop, and on a phone only for visitors who reach
    // the last screen.
    fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(enrich)
      .catch(function () { /* the rows stand without their detail lines */ });
  }

  /**
   * Two independent triggers, because the detail lines are worth fetching once but
   * not worth losing to a single missed signal:
   *
   *   - a rect test, run immediately and again on scroll / resize. This is what
   *     covers the panel already being in view at load (every desktop visit), and
   *     it works even where the page isn't being actively rendered.
   *   - an IntersectionObserver, which is the idiomatic tool and catches anything
   *     that moves the panel into view without a scroll event — a hash landing, a
   *     restored scroll position, a layout shift above it.
   *
   * Whichever fires first wins; `loaded` makes the other a no-op. The rows and
   * their links never depend on either: only the "Geneva · 30 min · 30 CHF" lines
   * do, so a visitor who never reaches the panel never pays for the 24 KB (which
   * the API does not compress).
   */
  var loaded = false;

  function nearViewport() {
    var r = root.getBoundingClientRect();
    return r.top < window.innerHeight + 200 && r.bottom > -200;
  }

  function trigger() {
    if (loaded) return;
    loaded = true;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (io) io.disconnect();
    load();
  }

  function onScroll() { if (nearViewport()) trigger(); }

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) trigger();
    }, { rootMargin: '200px' });
    io.observe(root);
  }

  onScroll();
  if (!loaded) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }
})();
