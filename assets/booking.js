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
    { types: ['xr'],    name: 'Silent Mind XR Session' },
    { types: ['zenbu'], name: 'Zenbu Koko' },
    // One activity under two API ids. `eeg` is Geneva's, titled "EEG Meditation
    // Session"; `qm` is the same session in Hyderabad and Los Angeles, titled "QM
    // Session" — QM being Quantified Meditation. The Lounge site's fuller public
    // name covers both.
    { types: ['eeg', 'qm'], name: 'Quantified Meditation Session' },
    { types: ['lmt'],   name: 'Track &amp; Train' },
  ];

  /** Display names for the venue ids the API tags activities with. */
  var VENUES = {
    geneva:     { name: 'Geneva' },
    hyderabad:  { name: 'Hyderabad' },
    losangeles: { name: 'Los Angeles' },
    tokyo:      { name: 'Tokyo' },
  };

  var root = document.getElementById('booking');
  var body = document.getElementById('booking-body');
  var venuesEl = document.getElementById('booking-venues');
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

  /**
   * A single-type activity deep-links straight to its calendar. One covering two ids
   * can't: they're disjoint by venue (Geneva's `eeg` versus Hyderabad and Los
   * Angeles' `qm`), the booking page's flowPick doesn't check that the venue it
   * guessed actually runs the type it was handed, and so `?a=eeg` would open an
   * empty calendar for a reader in India. The plain calendar lets that page resolve
   * the venue itself, which it already does from the browser timezone.
   */
  function hrefFor(act) {
    return act.types.length === 1
      ? BOOKING_URL + '?a=' + encodeURIComponent(act.types[0])
      : BOOKING_URL;
  }

  function render() {
    body.textContent = '';
    var list = el('ul', 'booking__options');

    ACTIVITIES.forEach(function (act) {
      var li = document.createElement('li');
      var a = el('a', 'booking__option');
      a.href = hrefFor(act);
      a.target = '_blank';
      a.rel = 'noopener';

      var text = el('span', 'booking__what');
      // innerHTML for the one name carrying an entity (Track &amp; Train).
      var name = el('span', 'booking__session');
      name.innerHTML = act.name;
      text.appendChild(name);

      var meta = el('span', 'booking__meta', metaFor[act.types[0]] || '');
      meta.setAttribute('data-type', act.types[0]);
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
   * Every venue, named once under the heading, in the order they're declared above —
   * which is therefore the editorial order, not the API's.
   *
   * Not filtered to venues with something on the calendar: this says where All Here
   * operates, which stays true whether or not Tokyo has an opening this week. It
   * needs no data either, so it goes up as soon as the script runs.
   */
  function renderVenues() {
    if (!venuesEl) return;
    venuesEl.textContent = Object.keys(VENUES).map(function (id) {
      return VENUES[id].name;
    }).join('  ·  ');
    venuesEl.hidden = false;
  }

  /**
   * One line per activity: how long it takes, and nothing else.
   *
   * No venues — they're named once under the heading instead, where they don't
   * repeat the same four names down every row. No prices either: the booking page
   * states those next to the slot you're actually choosing, where they can't drift
   * out of step with what you'll be charged.
   *
   * Duration is dropped when a type's slots differ in length (the EEG sessions run
   * both 120 and 150 minutes), so a line can be short but never wrong.
   */
  function describe(group) {
    var minutes = Object.keys(group.minutes);
    return minutes.length === 1 ? minutes[0] + ' min' : '';
  }

  function enrich(data) {
    if (!data || !data.activities) return;

    var groups = {};
    data.activities.forEach(function (a) {
      if (!a.type) return;
      var g = groups[a.type] || (groups[a.type] = { minutes: {} });
      if (a.slotMinutes) g.minutes[a.slotMinutes] = true;
    });

    ACTIVITIES.forEach(function (act) {
      // Union across every id this one activity is filed under, so a merged row
      // reads from all of them rather than one id's share.
      var merged = { minutes: {} };
      var found = false;
      act.types.forEach(function (t) {
        var g = groups[t];
        if (!g) return;
        found = true;
        Object.keys(g.minutes).forEach(function (m) { merged.minutes[m] = true; });
      });
      if (!found) return;
      var key = act.types[0];
      metaFor[key] = describe(merged);
      var slot = body.querySelector('.booking__meta[data-type="' + key + '"]');
      if (slot) slot.textContent = metaFor[key];
    });
  }

  // --- start ------------------------------------------------------------

  renderVenues();
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
   * their links never depend on either: only the "Geneva · 30 min" lines
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
