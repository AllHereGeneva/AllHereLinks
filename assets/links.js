/**
 * Instant meditations for the All Here landing page.
 *
 * Mirrors the app's Start screen: an Inner / Outer attention switch chooses
 * which set of three meditations the pills draw from, and the single big button
 * plays whichever is selected. Four of the six are plain tracks; the other two
 * are 3-round sessions with a break between rounds, so this file is mostly a
 * small segment sequencer.
 *
 * Audio is `preload="none"` — someone scanning the QR code shouldn't pull
 * megabytes before deciding to press play. The next segment of a session is
 * prefetched while the current one runs, so rounds follow on without a gap.
 */
(function () {
  'use strict';

  var playBtn = document.getElementById('play');
  var arc = document.getElementById('arc');
  var nowTitle = document.getElementById('now-title');
  var nowDuration = document.getElementById('now-duration');
  var breakLabel = document.getElementById('break-label');
  var attentionRow = document.getElementById('attention-row');
  var attentionRule = document.getElementById('attention-rule');
  var groups = {};
  Array.prototype.forEach.call(document.querySelectorAll('.pills'), function (g) {
    groups[g.dataset.group] = g;
  });
  if (!playBtn || !groups.inner || !groups.outer) return;

  // 2 * PI * 46 — the arc radius in the SVG viewBox. Must match the
  // stroke-dasharray in links.css.
  var CIRCUMFERENCE = 289.03;
  // Closing bell, played after the last round of a session — the app's
  // `hasOutro: true` on both 3-round tracks (catalog.ts).
  var OUTRO_SRC = 'assets/audio/bell_short.mp3';
  // A silent break still needs *something* playing: on mobile, an idle audio
  // element for a minute lets the audio session go quiet and the screen sleep.
  // This is the app's own 2 s silence asset, looped.
  var SILENCE_SRC = 'assets/audio/silence.mp3';

  var audio = new Audio();
  audio.preload = 'none';
  // Keeps iOS from taking the page fullscreen; there's no video anyway.
  audio.setAttribute('playsinline', '');

  // Warms the next segment while the current one plays.
  var prefetcher = new Audio();
  prefetcher.preload = 'auto';

  var attention = 'inner';
  var current = groups.inner.querySelector('.pill');

  // --- session state ---------------------------------------------------
  // `segments` is the flattened plan for the selected meditation; `index` is
  // the segment being played. A plain track is simply a one-segment session.
  var segments = [];
  var index = 0;
  // True from just before a segment's src swap until playback resumes. Swapping
  // `audio.src` mid-playback makes the browser fire `pause`, which would
  // otherwise read as the user stopping and flicker the glyph on every round
  // change.
  var switching = false;
  // Wall-clock break bookkeeping. The countdown and the arc both read from
  // this, so a break behaves the same whether it has audio (inner) or not
  // (outer) — one code path instead of two.
  var breakEndsAt = 0;
  var breakTimer = 0;
  var breakTicker = 0;

  function setArc(fraction) {
    arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction))));
  }

  /**
   * Expand a pill's data attributes into the list of segments to play.
   * A pill either names one file (`data-src`) or describes a rounds session
   * (`data-rounds` + `data-round-src`, optional `data-break-src`).
   */
  function planFor(pill) {
    if (pill.dataset.src) {
      return [{ src: pill.dataset.src, kind: 'track' }];
    }
    var rounds = parseInt(pill.dataset.rounds, 10) || 1;
    var breakSeconds = parseInt(pill.dataset.breakSeconds, 10) || 60;
    var plan = [];
    for (var n = 1; n <= rounds; n++) {
      plan.push({
        src: pill.dataset.roundSrc.replace('{n}', String(n)),
        kind: 'round',
        round: n,
        of: rounds,
      });
      // No break after the final round — the outro bell closes the session.
      if (n < rounds) {
        plan.push({
          src: pill.dataset.breakSrc ? pill.dataset.breakSrc.replace('{n}', String(n)) : null,
          kind: 'break',
          seconds: breakSeconds,
        });
      }
    }
    plan.push({ src: OUTRO_SRC, kind: 'outro' });
    return plan;
  }

  /** The meta line under the title: total duration, or which round is running. */
  function describe() {
    var seg = segments[index];
    if (!seg || seg.kind === 'track') return current.dataset.duration;
    if (seg.kind === 'round') return 'Round ' + seg.round + ' of ' + seg.of;
    if (seg.kind === 'break') return 'Break';
    return current.dataset.duration;
  }

  function label(verb) {
    playBtn.setAttribute('aria-label', verb + ' the ' + current.dataset.title.toLowerCase());
  }

  function clearBreak() {
    if (breakTimer) { clearTimeout(breakTimer); breakTimer = 0; }
    if (breakTicker) { clearInterval(breakTicker); breakTicker = 0; }
    breakEndsAt = 0;
    playBtn.classList.remove('is-break');
    breakLabel.textContent = '';
  }

  /** Back to the top of the currently selected meditation, not playing. */
  function reset() {
    switching = false;
    clearBreak();
    audio.pause();
    audio.loop = false;
    audio.removeAttribute('src');
    index = 0;
    segments = planFor(current);
    setArc(0);
    nowTitle.textContent = current.dataset.title;
    nowDuration.textContent = current.dataset.duration;
    playBtn.classList.remove('is-playing');
    label('Play');
  }

  function prefetchNext() {
    var next = segments[index + 1];
    if (next && next.src) prefetcher.src = next.src;
  }

  /** Load and play `segments[index]`, whatever kind it is. */
  function playSegment() {
    var seg = segments[index];
    if (!seg) { finish(); return; }
    clearBreak();
    nowDuration.textContent = describe();
    switching = true;

    if (seg.kind === 'break') {
      playBtn.classList.add('is-break');
      breakEndsAt = Date.now() + seg.seconds * 1000;
      // An inner break is a 60 s spoken clip; an outer break is silence. Either
      // way the wall-clock timer below is what advances the session, so the two
      // stay in step even if a clip runs a fraction short.
      audio.loop = !seg.src;
      audio.src = seg.src || SILENCE_SRC;
      tickBreak();
      breakTicker = setInterval(tickBreak, 250);
      breakTimer = setTimeout(advance, seg.seconds * 1000);
    } else {
      audio.loop = false;
      audio.src = seg.src;
      setArc(0);
    }

    var p = audio.play();
    // play() rejects outside a user gesture, and when a segment fails to load.
    // Either way, stop rather than leaving the button stuck mid-session.
    if (p && typeof p.catch === 'function') {
      p.catch(function () { switching = false; stopAll(); });
    }
    prefetchNext();
  }

  function tickBreak() {
    var seg = segments[index];
    if (!seg || seg.kind !== 'break') return;
    var remainingMs = Math.max(0, breakEndsAt - Date.now());
    var remaining = Math.ceil(remainingMs / 1000);
    var mm = Math.floor(remaining / 60);
    var ss = remaining % 60;
    breakLabel.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
    setArc(1 - remainingMs / (seg.seconds * 1000));
  }

  function advance() {
    clearBreak();
    index++;
    if (index >= segments.length) { finish(); return; }
    playSegment();
  }

  /** The session ran to its end. Rewind so a second tap starts from round 1. */
  function finish() {
    switching = false;
    clearBreak();
    audio.pause();
    audio.loop = false;
    audio.removeAttribute('src');
    index = 0;
    setArc(0);
    nowDuration.textContent = current.dataset.duration;
    playBtn.classList.remove('is-playing');
    label('Play');
  }

  /** Stop where we are, keeping the position so the button can resume. */
  function stopAll() {
    if (breakTimer) { clearTimeout(breakTimer); breakTimer = 0; }
    if (breakTicker) { clearInterval(breakTicker); breakTicker = 0; }
    audio.pause();
    playBtn.classList.remove('is-playing');
    label('Play');
  }

  // --- events ----------------------------------------------------------

  playBtn.addEventListener('click', function () {
    if (!audio.paused) { stopAll(); return; }
    var seg = segments[index];
    // Nothing loaded (fresh page, or after finish) — start this segment.
    if (!seg || !audio.getAttribute('src')) { playSegment(); return; }
    // A paused break has to be re-armed: its deadline is wall-clock, so
    // resuming against a stale one would expire the break immediately. Restart
    // the minute rather than resuming a partly-elapsed countdown.
    if (seg.kind === 'break') { playSegment(); return; }
    switching = true;
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () { switching = false; stopAll(); });
    }
  });

  audio.addEventListener('play', function () {
    switching = false;
    playBtn.classList.add('is-playing');
    label('Pause');
  });

  audio.addEventListener('pause', function () {
    // Ignore the pause the browser fires when we swap src between segments;
    // reflect only a real stop (user tap, or an interruption like an incoming
    // call taking the audio session).
    if (switching) return;
    stopAll();
  });

  audio.addEventListener('timeupdate', function () {
    var seg = segments[index];
    // Breaks drive the arc from the wall clock (see tickBreak), not from the
    // audio, so a looping silence can't rewind it.
    if (!seg || seg.kind === 'break') return;
    if (!audio.duration || !isFinite(audio.duration)) return;
    setArc(audio.currentTime / audio.duration);
  });

  audio.addEventListener('ended', function () {
    var seg = segments[index];
    // A break ends on its timer, not on its clip: the clip may run a hair
    // short, and a silent break has no clip at all.
    if (seg && seg.kind === 'break') return;
    advance();
  });

  // --- pills -----------------------------------------------------------

  function selectPill(pill) {
    if (pill === current) return;
    Array.prototype.forEach.call(pill.parentNode.querySelectorAll('.pill'), function (p) {
      p.setAttribute('aria-pressed', String(p === pill));
    });
    current = pill;
    // Switching meditation restarts from the top of the new one — resuming
    // part-way through a different recording makes no sense.
    reset();
  }

  Object.keys(groups).forEach(function (key) {
    groups[key].addEventListener('click', function (e) {
      var pill = e.target.closest('.pill');
      if (pill) selectPill(pill);
    });
  });

  // --- attention switch ------------------------------------------------

  /** Match the gliding rule to the active word's measured extent. */
  function positionRule() {
    var active = attentionRow.querySelector('.attention__opt[aria-pressed="true"]');
    if (!active) return;
    var rowBox = attentionRow.getBoundingClientRect();
    var box = active.getBoundingClientRect();
    if (!box.width) return;
    attentionRule.style.width = box.width + 'px';
    attentionRule.style.transform = 'translateX(' + (box.left - rowBox.left) + 'px)';
    attentionRule.style.opacity = '1';
  }

  function setAttention(next) {
    if (next === attention) return;
    // Remember which length was selected so the switch lands on the equivalent
    // one: someone comparing inner and outer at 3 min wants the same length,
    // not a reset to 1 min.
    var lengthIndex = Array.prototype.indexOf.call(current.parentNode.children, current);

    attention = next;
    Array.prototype.forEach.call(attentionRow.querySelectorAll('.attention__opt'), function (o) {
      o.setAttribute('aria-pressed', String(o.dataset.attention === attention));
    });
    positionRule();

    // Swap which group of three is in the flow, and crossfade — the app
    // remounts its pills on the attention change, which re-runs their FadeIn.
    Object.keys(groups).forEach(function (key) {
      groups[key].hidden = key !== attention;
    });
    var shown = groups[attention];
    shown.classList.remove('pills--enter');
    // Force a reflow so re-adding the class restarts the animation even when
    // the user toggles back and forth quickly.
    void shown.offsetWidth;
    shown.classList.add('pills--enter');

    var pill = shown.children[lengthIndex] || shown.children[0];
    Array.prototype.forEach.call(shown.querySelectorAll('.pill'), function (p) {
      p.setAttribute('aria-pressed', String(p === pill));
    });
    current = pill;
    reset();
  }

  attentionRow.addEventListener('click', function (e) {
    var opt = e.target.closest('.attention__opt');
    if (opt) { setAttention(opt.dataset.attention); return; }
    var info = e.target.closest('.attention__info');
    if (info) {
      var dialog = document.getElementById(info.dataset.dialog);
      if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (dialog) {
    dialog.addEventListener('click', function (e) {
      // Backdrop click: the dialog element is the event target only when the
      // click landed outside its content box.
      if (e.target === dialog || e.target.hasAttribute('data-close')) dialog.close();
    });
  });

  window.addEventListener('resize', positionRule);
  // The rule is measured from rendered text, so it must be re-measured once the
  // web font swaps in — Montserrat is wider than the fallback stack.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionRule);

  reset();
  positionRule();
})();
