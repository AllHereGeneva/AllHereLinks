/**
 * Location-aware booking panel.
 *
 * Reads the real session catalogue from the Lounge API and shows what's bookable
 * near the visitor. It does NOT book: reserving needs a signed-in account and
 * credits (the API answers 402 no_credit when they run out), and all of that
 * already lives on allherelounge.com/booking/. Duplicating that flow here would
 * mean every future booking change had to be made twice, so this panel ends at a
 * link into it.
 *
 * How a venue is resolved, in order:
 *   1. `?venue=<id>` on the URL — what the QR code printed AT a venue carries.
 *      Instant, exact, and asks the visitor for nothing.
 *   2. An explicit tap on "Use my location", for codes handed out elsewhere.
 *      Never on load: a permission prompt is a poor greeting, and the answer
 *      arrives too late to place the panel without the page jumping.
 *
 * With a venue, the panel moves to the front (CSS `order`, so the DOM doesn't
 * change) and lists that venue's next sessions. Without one it stays last and
 * lists the venues that have sessions at all.
 */
(function () {
  'use strict';

  var API = 'https://api.allherelounge.com/booking';
  var BOOKING_URL = 'https://allherelounge.com/booking/';

  /**
   * The venues the API tags its activities with. Coordinates are city-level on
   * purpose — the question is "is this visitor in a city where we have a venue",
   * not "are they in the doorway" — so the radius is generous and a rooftop-exact
   * latitude would buy nothing.
   *
   * `currency` is only set where it's actually known. The API returns a bare
   * number for `price` and no currency (per-venue currency is still a config item
   * in the multi-venue plan), and a price shown against the wrong symbol is worse
   * than no price at all.
   */
  var VENUES = {
    geneva: {
      name: 'Geneva',
      // Street only: the venue name already carries the city, and
      // "Geneva · Clos Belmont 12, 1208 Geneva" said it twice.
      address: 'Clos Belmont 12',
      lat: 46.1985, lon: 6.1655, radiusKm: 30,
      currency: 'CHF',
    },
    hyderabad: { name: 'Hyderabad',   lat: 17.3850, lon: 78.4867,   radiusKm: 40 },
    losangeles:{ name: 'Los Angeles', lat: 34.0522, lon: -118.2437, radiusKm: 60 },
    tokyo:     { name: 'Tokyo',       lat: 35.6762, lon: 139.6503,  radiusKm: 45 },
  };

  var HOW_MANY_SLOTS = 3;

  var root = document.getElementById('booking');
  var body = document.getElementById('booking-body');
  var titleEl = document.getElementById('booking-where');
  if (!root || !body) return;

  var venueId = null;
  var catalogue = null;   // grouped by venue once fetched
  var fetching = false;

  // --- geometry ---------------------------------------------------------

  function distanceKm(aLat, aLon, bLat, bLon) {
    // Haversine. Plenty for a "same city?" test.
    var R = 6371;
    var dLat = (bLat - aLat) * Math.PI / 180;
    var dLon = (bLon - aLon) * Math.PI / 180;
    var la1 = aLat * Math.PI / 180, la2 = bLat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // --- dates ------------------------------------------------------------

  /**
   * Slot datetimes come as "2026-08-19T17:00" with no zone, and they mean the
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
    // Compared against venue-local dates, so the visitor's own local date is the
    // right yardstick: it keeps "today" meaning today wherever they are.
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // --- data -------------------------------------------------------------

  function load() {
    if (catalogue || fetching) return Promise.resolve(catalogue);
    fetching = true;
    // 24 KB, and the API doesn't compress it — which is why this is never fetched
    // on load unless the panel is actually up front.
    return fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        fetching = false;
        catalogue = group(data);
        return catalogue;
      })
      .catch(function () {
        fetching = false;
        return null;
      });
  }

  function group(data) {
    var out = {};
    if (!data || !data.activities) return out;
    var today = todayIso();
    data.activities.forEach(function (a) {
      var v = a.venue;
      if (!v || !VENUES[v]) return;
      var slot = parseSlot(a.datetime);
      if (!slot || slot.day < today) return;
      var left = (a.capacity == null ? null : a.capacity - (a.booked || 0));
      if (left !== null && left <= 0) return;   // full: nothing to offer
      (out[v] = out[v] || []).push({
        slot: slot, title: a.title || '', type: a.type || '',
        price: a.price, left: left,
      });
    });
    Object.keys(out).forEach(function (v) {
      out[v].sort(function (x, y) { return x.slot.utc - y.slot.utc; });
    });
    return out;
  }

  // --- rendering --------------------------------------------------------

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function bookHref(type) {
    return type ? BOOKING_URL + '?a=' + encodeURIComponent(type) : BOOKING_URL;
  }

  function renderVenue(id, sessions) {
    var venue = VENUES[id];
    body.textContent = '';
    titleEl.textContent = venue.address ? venue.name + ' · ' + venue.address : venue.name;
    titleEl.hidden = false;

    if (!sessions || !sessions.length) {
      body.appendChild(el('p', 'booking__note', 'No sessions on the calendar right now.'));
      body.appendChild(cta('See the calendar'));
      return;
    }

    var list = el('ul', 'booking__slots');
    sessions.slice(0, HOW_MANY_SLOTS).forEach(function (s) {
      var li = document.createElement('li');
      var a = el('a', 'booking__slot');
      a.href = bookHref(s.type);
      a.target = '_blank';
      a.rel = 'noopener';

      var when = el('span', 'booking__when');
      when.appendChild(el('span', 'booking__day', formatDay(s.slot)));
      when.appendChild(el('span', 'booking__time', s.slot.hhmm));
      a.appendChild(when);

      var what = el('span', 'booking__what');
      what.appendChild(el('span', 'booking__session', s.title));
      var bits = [];
      if (s.price != null && venue.currency) bits.push(s.price + ' ' + venue.currency);
      if (s.left != null) bits.push(s.left + (s.left === 1 ? ' place left' : ' places left'));
      if (bits.length) what.appendChild(el('span', 'booking__meta', bits.join('  ·  ')));
      a.appendChild(what);

      a.appendChild(el('span', 'booking__chevron', '›'));
      li.appendChild(a);
      list.appendChild(li);
    });
    body.appendChild(list);
    body.appendChild(cta('Book at allherelounge.com'));
  }

  function renderVenueList(grouped) {
    body.textContent = '';
    titleEl.hidden = true;

    var ids = Object.keys(VENUES).filter(function (id) {
      return grouped && grouped[id] && grouped[id].length;
    });

    if (!ids.length) {
      body.appendChild(el('p', 'booking__note',
        'Sessions run at our venues in Geneva and beyond.'));
      body.appendChild(cta('See the calendar'));
    } else {
      var list = el('ul', 'booking__slots');
      ids.forEach(function (id) {
        var n = grouped[id].length;
        var li = document.createElement('li');
        var a = el('a', 'booking__slot');
        a.href = BOOKING_URL;
        a.target = '_blank';
        a.rel = 'noopener';
        var what = el('span', 'booking__what');
        what.appendChild(el('span', 'booking__session', VENUES[id].name));
        what.appendChild(el('span', 'booking__meta',
          n + (n === 1 ? ' session upcoming' : ' sessions upcoming')));
        a.appendChild(what);
        a.appendChild(el('span', 'booking__chevron', '›'));
        li.appendChild(a);
        list.appendChild(li);
      });
      body.appendChild(list);
    }
    body.appendChild(locateButton());
  }

  function cta(label) {
    var a = el('a', 'booking__cta', label + ' ›');
    a.href = BOOKING_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function locateButton() {
    if (!navigator.geolocation) return document.createComment('no geolocation');
    var b = el('button', 'booking__locate', 'Use my location');
    b.type = 'button';
    b.addEventListener('click', function () {
      b.disabled = true;
      b.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        var near = nearestVenue(pos.coords.latitude, pos.coords.longitude);
        if (near) { activate(near); return; }
        b.textContent = 'No venue nearby';
      }, function () {
        // Denied, unavailable or timed out — all the same to us: the list of
        // venues stays, which is a perfectly good fallback.
        b.disabled = false;
        b.textContent = 'Location unavailable';
      }, { timeout: 8000, maximumAge: 600000 });
    });
    return b;
  }

  /** Nearest venue within its own radius that actually has sessions. */
  function nearestVenue(lat, lon) {
    var best = null;
    Object.keys(VENUES).forEach(function (id) {
      if (!catalogue || !catalogue[id] || !catalogue[id].length) return;
      var v = VENUES[id];
      var km = distanceKm(lat, lon, v.lat, v.lon);
      if (km <= v.radiusKm && (!best || km < best.km)) best = { id: id, km: km };
    });
    return best && best.id;
  }

  /** Promote the panel to the front and show that venue's sessions. */
  function activate(id) {
    venueId = id;
    document.body.classList.add('has-venue');
    renderVenue(id, catalogue && catalogue[id]);
  }

  // --- start ------------------------------------------------------------

  var asked = null;
  try {
    asked = new URLSearchParams(window.location.search).get('venue');
  } catch (e) { /* very old browser: fall through to the venue list */ }
  if (asked) asked = asked.toLowerCase().replace(/[^a-z]/g, '');

  if (asked && VENUES[asked]) {
    // Front and centre, so its content is worth fetching straight away.
    document.body.classList.add('has-venue');
    titleEl.textContent = VENUES[asked].name;
    titleEl.hidden = false;
    load().then(function (grouped) { activate(asked); });
  } else if ('IntersectionObserver' in window) {
    // Last on the page: don't spend the request until it's nearly in view.
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      load().then(renderVenueList);
    }, { rootMargin: '200px' });
    io.observe(root);
  } else {
    load().then(renderVenueList);
  }
})();
