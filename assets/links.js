/**
 * Play button + length picker for the All Here landing page.
 *
 * Mirrors the app's Start screen behaviour: the two pills choose which
 * instant meditation is queued, the single big button plays / pauses it, and
 * the ring switches from its idle breath to the muted playing breath with an
 * elapsed arc drawn over it.
 *
 * Audio is `preload="none"` — someone scanning the QR code shouldn't pull a
 * megabyte before deciding to press play.
 */
(function () {
  'use strict';

  var playBtn = document.getElementById('play');
  var arc = document.getElementById('arc');
  var nowTitle = document.getElementById('now-title');
  var nowDuration = document.getElementById('now-duration');
  var pills = Array.prototype.slice.call(document.querySelectorAll('.pill'));
  if (!playBtn || !pills.length) return;

  // 2 * PI * 46 — the arc radius in the SVG viewBox. Must match the
  // stroke-dasharray in links.css.
  var CIRCUMFERENCE = 289.03;

  var audio = new Audio();
  audio.preload = 'none';
  // Keeps iOS from taking the page fullscreen; there's no video anyway.
  audio.setAttribute('playsinline', '');

  var current = pills[0];

  function setArc(fraction) {
    arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - fraction));
  }

  function select(pill) {
    if (pill === current) return;
    var wasPlaying = !audio.paused;
    current = pill;
    pills.forEach(function (p) {
      p.setAttribute('aria-pressed', String(p === current));
    });
    nowTitle.textContent = pill.dataset.title;
    nowDuration.textContent = pill.dataset.duration;
    playBtn.setAttribute('aria-label', 'Play the ' + pill.dataset.title.toLowerCase());
    // Switching length restarts from the top of the newly chosen track —
    // resuming mid-way through a different recording makes no sense.
    audio.pause();
    audio.src = pill.dataset.src;
    setArc(0);
    // Keep playing across a switch if the user was already listening; a
    // silent stop would read as the button breaking.
    if (wasPlaying) start();
    else stop();
  }

  function start() {
    if (!audio.src) audio.src = current.dataset.src;
    var p = audio.play();
    // Autoplay policies reject play() outside a user gesture; this call is
    // always inside a click handler, but a failed network load rejects too.
    if (p && typeof p.catch === 'function') {
      p.catch(function () { stop(); });
    }
  }

  function stop() {
    playBtn.classList.remove('is-playing');
    playBtn.setAttribute('aria-label', 'Play the ' + current.dataset.title.toLowerCase());
  }

  playBtn.addEventListener('click', function () {
    if (audio.paused) start();
    else audio.pause();
  });

  audio.addEventListener('play', function () {
    playBtn.classList.add('is-playing');
    playBtn.setAttribute('aria-label', 'Pause the ' + current.dataset.title.toLowerCase());
  });
  audio.addEventListener('pause', stop);

  audio.addEventListener('timeupdate', function () {
    if (!audio.duration || !isFinite(audio.duration)) return;
    setArc(audio.currentTime / audio.duration);
  });

  audio.addEventListener('ended', function () {
    stop();
    // Rewind so a second tap replays from the beginning rather than sitting
    // at the end doing nothing.
    audio.currentTime = 0;
    setArc(0);
  });

  pills.forEach(function (pill) {
    pill.addEventListener('click', function () { select(pill); });
  });

  setArc(0);
})();
