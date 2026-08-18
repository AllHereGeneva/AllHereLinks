/**
 * Upcoming sessions panel.
 *
 * Lists the next sessions across every venue and hands off to
 * allherelounge.com/booking/ for the rest. It doesn't book: reserving needs a
 * signed-in account and credits (the API answers 402 no_credit when they run
 * out), and all of that already lives on that page. Duplicating it here would
 * mean every future booking change had to be made twice.
 *
 * No geolocation, and no venue in the URL. An earlier version reordered the page
 * around where the visitor was, which meant the panel only appeared if they
 * arrived through a venue-specific code or explicitly asked to be located —
 * so someone standing in Geneva on a plain link saw nothing at all. Listing what
 * is coming up, wherever it is, and naming the cities is simpler and always says
 * something true.
 */
(function () {
  'use strict';

  var API = 'https://api.allherelounge.com/booking';
  var BOOKING_URL = 'https://allherelounge.com/booking/';

  /**
   * Display names for the venue ids the API tags activities with, and the
   * currency to price them in.
   *
   * `currency` is only set where it's actually known. The API returns a bare
   * number for `price` and no currency (per-venue currency is still a config item
   * in the multi-venue plan), and a price shown against the wrong symbol is worse
   * than no price at all — so a venue without one simply shows no price.
   */
  var VENUES = {
    geneva:     { name: 'Geneva', currency: 'CHF' },
    hyderabad:  { name: 'Hyderabad' },
    losangeles: { name: 'Los Angeles' },
    tokyo:      { name: 'Tokyo' },
  };

  /** Enough to show there's a programme; the link carries the rest. Three also
   *  matches the three-row link list above it on desktop, and keeps the right-hand
   *  column inside a 1280x800 laptop. */
  var HOW_MANY = 3;

  var root = document.getElementById('booking');
  var body = document.getElementById('booking-body');
  var citiesEl = document.getElementById('booking-cities');
  if (!root || !body) return;

  // --- dates ------------------------------------------------------------

  /**
   * Slot datetimes arrive as "2026-08-19T17:00" with no zone, and they mean the
   * VENUE's local time (the Lounge booking page says as much). Handing that to
   * `new Date()` would make the browser read it as the visitor's local time and
   * then reformat it into their zone — so 17:00 in Geneva would show as 08:00 to
   * someone in Los Angeles. Parse the parts by hand and format through UTC, which
   * keeps the digits exactly as the venue published them.
   */
  function parseSlot(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
    if (!m) return null;
    return {
      utc: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])),
      hhmm: m[4] + ':' + m[5],
      day: m[1] + '-' + m[2] + '-' + m[3],
    };
  }

  function formatDay(slot) {
    return slot.utc.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  }

  function todayIso() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // --- data -------------------------------------------------------------

  /** Upcoming, non-full sessions from every known venue, soonest first. */
  function upcoming(data) {
    if (!data || !data.activities) return [];
    var today = todayIso();
    var out = [];
    data.activities.forEach(function (a) {
      if (!a.venue || !VENUES[a.venue]) return;
      var slot = parseSlot(a.datetime);
      if (!slot || slot.day < today) return;
      var left = (a.capacity == null ? null : a.capacity - (a.booked || 0));
      // Nothing to offer on a full session.
      if (left !== null && left <= 0) return;
      out.push({
        slot: slot, venue: a.venue, title: a.title || '',
        type: a.type || '', price: a.price, left: left,
      });
    });
    out.sort(function (x, y) { return x.slot.utc - y.slot.utc; });
    return out;
  }

  // --- rendering --------------------------------------------------------

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function link(cls, href) {
    var a = el('a', cls);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function render(sessions) {
    if (!sessions || !sessions.length) return;   // keep the static fallback

    // The cities with something coming up, in the order they appear — takes the
    // place of a single venue's address now that the list spans venues.
    var cities = [];
    sessions.forEach(function (s) {
      var n = VENUES[s.venue].name;
      if (cities.indexOf(n) < 0) cities.push(n);
    });
    citiesEl.textContent = cities.join('  ·  ');
    citiesEl.hidden = false;

    body.textContent = '';
    var list = el('ul', 'booking__slots');

    sessions.slice(0, HOW_MANY).forEach(function (s) {
      var venue = VENUES[s.venue];
      var li = document.createElement('li');
      var a = link('booking__slot', BOOKING_URL + '?a=' + encodeURIComponent(s.type));

      var when = el('span', 'booking__when');
      when.appendChild(el('span', 'booking__day', formatDay(s.slot)));
      when.appendChild(el('span', 'booking__time', s.slot.hhmm));
      a.appendChild(when);

      var what = el('span', 'booking__what');
      what.appendChild(el('span', 'booking__session', s.title));
      // The city belongs on every row, not just in the header: the list mixes
      // venues, so a time without a place doesn't tell you whether it's yours.
      var bits = [venue.name];
      if (s.price != null && venue.currency) bits.push(s.price + ' ' + venue.currency);
      if (s.left != null) bits.push(s.left + (s.left === 1 ? ' place left' : ' places left'));
      what.appendChild(el('span', 'booking__meta', bits.join('  ·  ')));
      a.appendChild(what);

      a.appendChild(el('span', 'booking__chevron', '›'));
      li.appendChild(a);
      list.appendChild(li);
    });

    body.appendChild(list);
    var cta = link('booking__cta', BOOKING_URL);
    cta.textContent = 'Book a session ›';
    body.appendChild(cta);
  }

  // --- start ------------------------------------------------------------

  function load() {
    // 24 KB, and the API doesn't compress it — so it waits until the panel is
    // actually near the viewport (see maybeLoad). On desktop that's immediately,
    // since the panel sits in the right-hand column; on a phone it's the last
    // screen, so only visitors who scroll that far pay for it.
    fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { render(upcoming(data)); })
      .catch(function () { /* the static fallback in the markup stands */ });
  }

  /**
   * Fetch once the panel is within a screen of the viewport. A plain rect test
   * rather than an IntersectionObserver: the observer only reports while the page
   * is actually being rendered, so a page opened in a background tab (or a headless
   * check) would sit on the fallback until it was looked at. This runs the moment
   * the script does, wherever the panel happens to be.
   */
  var loaded = false;

  function nearViewport() {
    var r = root.getBoundingClientRect();
    return r.top < window.innerHeight + 200 && r.bottom > -200;
  }

  function maybeLoad() {
    if (loaded || !nearViewport()) return;
    loaded = true;
    window.removeEventListener('scroll', maybeLoad);
    window.removeEventListener('resize', maybeLoad);
    load();
  }

  maybeLoad();
  if (!loaded) {
    window.addEventListener('scroll', maybeLoad, { passive: true });
    window.addEventListener('resize', maybeLoad);
  }
})();
