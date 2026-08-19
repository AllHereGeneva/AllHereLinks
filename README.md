# All Here — QR landing page

A single-page "start here" for QR codes: the world map of meditators and the links
to get to know us, then the app's six instant meditations behind its play button.

No build step, no framework, no dependencies — plain HTML/CSS/JS. Push to `main`
and GitHub Pages serves it.

**Live:** https://allheregeneva.github.io/AllHereLinks/

---

## The design is a port of the app's Start screen

The page deliberately reuses the All Here app's home screen so someone who scans
the code and then downloads the app recognises the same surface. What's copied,
and from where in `AllHereApp`:

| Here | Source in the app |
| --- | --- |
| `assets/shader.js` — animated atmosphere | `src/shaders/glsl.ts` (`FRAG_EARTH_TOPDOWN` + `COMMON`), driven the way `src/components/AtmosphereBackground.tsx` drives it |
| `.play` in `assets/links.css` — ring, halo, ripple, breath, sway, break arc | `src/components/CircleButton.tsx` |
| `.attention` — Inner / Outer switch with its gliding rule | `src/components/AttentionSwitch.tsx` |
| Colour / type / spacing tokens at the top of `assets/links.css` | `src/theme/index.ts` |
| Titles, pill labels, and the two attention explanations | `app/(tabs)/index.tsx` + `src/content/copy.json` |
| The six `assets/audio/*.mp3` sets | `assets/audio/Inner/` + `assets/audio/Outer/` (re-encoded, see below) |
| `assets/img/allhere-logo.png` | `assets/images/allhere-logo.png` |

If any of those change upstream, they have to be copied over by hand — there's no
shared package.

### Three deliberate deviations

- **The pills are a selector, not six launchers.** In the app each pill starts its
  own track. Here a single play button plays whichever is selected, so the pills
  carry a visible pressed state (`aria-pressed`) that the app's don't have.
- **Switching attention keeps the length.** Going from Inner to Outer lands on the
  same duration rather than resetting to 1 min, since the reason to switch is
  usually to compare the two at the same length.
- **A scrim sits behind the link list** on narrow screens (`.links::before`), and a
  glass panel replaces it from 980px. The shader is dark but not uniformly so, and
  15 px labels over a moving surface get tiring; the app solves the same problem
  by stacking two flat dark overlays over its video background
  (`VideoBackground.tsx`).

---

## Layout

The order is the same at every size: **who we are, then the practice, then the
app**. Someone scanning the code should reach our own pages first; the meditation
is what keeps them, not what greets them.

**Phones (< 640px)** — three full-height screens:

| | |
| --- | --- |
| Screen 1 | wordmark, page title, the link list, the socials |
| Screen 2 | the practice, then the app download |
| Screen 3 | the booking options |

Each screen is a `.screen` wrapper at `min-height: 100svh` with
`scroll-snap-align: start`, and each but the last carries a cue to the next — "Try a
meditation", then "Booking options". They name their destination for a reason: a bare
chevron says "there is more" but not what, and without the second one nothing
announced the booking screen at all.

Snapping is `proximity`, not `mandatory`: a screen can grow past a short phone's
viewport, and mandatory snapping there fights anyone trying to reach its lower half.
The cues are plain `<a href>`s, so the jump is the browser's own smooth scroll — no
script, and they work with JS off. Only the last screen gives back the padding the
others reserve for their cue.

Inside screen 2 the hero turns sideways: the ring on the left, the three lengths
stacked beside it, the track name spanning both above them. A centred stack of
title, ring and pills is precisely the app's Start screen, which made the page
read as a copy of the app rather than as its doorway. The track name spans both
columns rather than sitting beside the ring because "Three minutes meditation"
needs about 210px on one line, which no column narrow enough to leave room for the
ring can give it — and below that width the non-breaking-space glue starts pushing
the first word onto a line of its own.

**640px and up** — one wider column, everything stacked in the same order.

**980px and up** — two columns. Left: the brand, then the practice and the app
download **merged into one block** (`.practice-block`) — try a meditation, and right
there is where it lives. Right: the links panel and the booking options.

The two columns start and end level, and that's built rather than lucky. Both
`.practice-block` and `.booking` are `align-self: stretch` in the row where they end,
so their bottom edges are the same grid line **whichever column turns out taller** —
and `.hero { margin-bottom: auto }` absorbs any surplus inside the left one, keeping
the download block pinned to that bottom edge.

That last part is the whole trick. With `align-self: start` the alignment held only
while the left column was the taller one; the moment the right grew past it, the
booking frame slid below the download buttons. Putting `margin-top: auto` on `.app`
instead would pin it to the bottom but collapse its own margin to nothing whenever
the left column was taller, gluing it to the pills — hence the surplus being absorbed
above it rather than below.

Both wrappers exist for one layout each and dissolve in the other with
`display: contents`: `.screen` groups a phone screen, `.practice-block` groups the
desktop left-hand column. That's what lets one set of markup carry both.

Pairing the tall links panel with the short brand row — rather than with the
practice — is what keeps the two columns near even: grid rows are shared between
columns, so a short item beside a tall one wastes exactly that difference. It fits a
1280×800 laptop exactly, with the activity list scrolling inside its panel rather
than the page scrolling past the fold.

The practice group sits with equal air above and below it — the same step from the
page title down to "Try a meditation" as from the pills down to the hairline. `.brand`
is `align-self: end` so the gap below it is a value we set rather than whatever the
grid has left over; with `center` there, the grid adds its own leftover air on top of
the margin and the gap came out at twice the one underneath (66px against 32px).

Two traps behind the vertical centring:

- Grid rows are all `auto`, never `1fr`. A fractional row swallows the free space
  and leaves `align-content: center` nothing to distribute, which pins the brand
  to the top of the window instead of centring the stack.
- The page uses `min-height`, not `height`. With a fixed height, `align-content:
  center` on content taller than the container overflows *both* ways and puts the
  top of the first panel permanently out of reach — the same trap as flex-centring
  a container smaller than its content. Worth remembering before adding anything
  to the right column.

---

## Editing

**Links** — plain markup in `index.html`, under `<ul class="link-list">`. Each row
is a `<li>` with an inline SVG icon, a title, a sub-label and a chevron. The first
row carries `link--featured` (the 4 px accent rail) and a `link__thumb` preview;
keep both on one row only, or the emphasis stops meaning anything.

Socials are **not** rows: they're bare icons on one line (`<ul class="socials">`),
because three full rows for three handles was most of the list's height and none
of its substance. The circular shell is the app's own icon button; `aria-label`
carries the name for screen readers and `title` for pointer users, since there's
no visible text.

**Section headings** — four of them ("Get to know us", "Try a meditation",
"Download the Silent Mind App", "Booking options"), all on one `.section-title` tier:
the app's h3, sentence case. No exceptions — they match in font, size and colour
everywhere.

The download heading briefly shrank to a muted label on desktop, because at the
shared size it ran the full width of the column and looked oversized next to the
short "Try a meditation". That was treating a **grouping** problem as a size
problem, and it made the heading read as a stray label. What actually fixes it:

- The practice heading had its tier's `margin-bottom` **and** the hero's flex `gap`,
  so it sat 32px from its own content while the content items sat 16px apart — it
  floated above the group instead of belonging to it. `.hero .section-title` now
  zeroes that margin and lets the gap do the spacing.
- The download block gets a double step of air and a hairline above it (the same
  divider the app puts between list rows), so two equally-weighted headings still
  read as two groups. On phones they're separate stacked sections 72px apart, which
  already reads as a break, so no rule there.

The headings were overlines at first, which put an 11 px uppercase eyebrow above the
18 px track readout it was meant to govern — the hierarchy read upside-down. Sizes
now descend strictly: 26 page title, 18 section heading, 14 the attention switch, 12
the readout on desktop (22 / 16 / 14 / 12 on phones). Keep new headings on that
tier.

The app heading reuses allhere.org's own wording above its store badges. Wording an
existing call to action twice over is worse than reusing it, so take app copy from
allhere.org or the Lounge site rather than inventing it here.

The download block is the heading plus the two official badges side by side, and
nothing else. It carried a shot of the app in a hand (the Lounge site's
`app-phone.jpg`) to show what was being downloaded; it was the tallest thing in the
block on both layouts and made the ask busier than "here are the two buttons". The
asset is gone from this repo — it's still in `AllHereLounge/site/assets/images/` if
it's ever wanted back.

**The meditations** — everything lives in the pills' data attributes, in two
`.pills` groups (one per attention). No JS change is needed to add or repoint one.

- A plain track: `data-src`, `data-title`, `data-duration`.
- A rounds session: `data-rounds`, `data-round-src` and `data-break-src` with
  `{n}` substituted per round, plus `data-break-seconds`.
- **Drop `data-break-src` and the break is silent** — which is exactly the app's
  outer session, where the breaks are a minute of silence because the inner break
  clips announce the next round's object and would contradict the outer sequence.

`links.js` expands that into a segment list, plays the segments back to back, and
closes a rounds session with `assets/audio/bell_short.mp3` (the app's
`hasOutro: true`). Breaks advance on a wall-clock timer rather than on the clip
ending, so audio and silent breaks share one code path. The next segment is
prefetched while the current one plays, so rounds follow on without a gap.

Source audio is `AllHereApp/assets/audio/{Inner,Outer}/*.mp3`, which ships at
256 kbps stereo. Re-encode before committing — 96 kbps is transparent for voice
and cuts the whole set from ~60 MB to 22 MB, which matters when the page is
reached by scanning a code on mobile data:

```bash
ffmpeg -i inner_1min.mp3 -codec:a libmp3lame -b:a 96k -ar 44100 assets/audio/inner_1min.mp3
```

Nothing is fetched until the visitor presses play (`preload="none"`), so the page
itself opens in well under 200 KB.

**The atmosphere** — `assets/shader.js` holds one fragment shader in `FRAG`. To
change theme, paste another `FRAG_*` body from the app's `src/shaders/glsl.ts`;
the uniforms (`uTime`, `uRes`) are identical, so it's a straight copy. The current
one is the lake (`FRAG_EARTH_TOPDOWN`), the atmosphere a first-time app user lands
on; `FRAG_SPACE` (twinkling stars and a milky-way band) is the livelier
alternative.

> The lake is **deliberately very slow** in the app — its rings expand over six to
> nine minutes, so the surface barely moves during a short visit. That's the
> intended contemplative reading, not a stalled render. Speeding it up means
> scaling the `uTime` multipliers in the `ripple()` calls.

The shader keeps the app's perf guardrails: one frame in three (~20 fps), the
drawing buffer capped at 1.5× CSS pixels, and no frames submitted while the tab is
hidden. If WebGL is unavailable the CSS gradient on `body` shows through instead —
the same fallback the app uses.

> Do not put `overflow`, `filter` or `contain` on `<html>` or `<body>`: any of them
> makes the element a containing block for `position: fixed` descendants, which
> detaches the atmosphere canvas from the viewport and scrolls it off the page.

**The world map thumbnail** — a crop of the live leaderboard. Regenerate it when
the map changes:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --hide-scrollbars --virtual-time-budget=9000 --window-size=1400,900 \
  --screenshot=map-raw.png "https://allheregeneva.github.io/AllHereLeaderboard/"
python3 -c "
from PIL import Image
im = Image.open('map-raw.png')
crop = im.crop((110, 215, 1010, 745))        # map body only: no nav, panel or footer
t = crop.resize((208, 122), Image.LANCZOS)   # 104x61 CSS at 2x
t.convert('P', palette=Image.ADAPTIVE, colors=128).save('assets/img/worldmap.png', optimize=True)
"
```

---

## The booking panel

"Booking options" lists what we offer and sends each row to its own calendar on
`allherelounge.com/booking/`. It doesn't book: reserving needs a signed-in account
(email OTP, Google, Apple) and credits — the API answers `402 no_credit` when they
run out — and all of that already exists in the Lounge site's 1,600-line booking
page. A second implementation here would mean every future booking change had to be
made twice, in a place where an auth bug would touch real accounts.

`?a=<type>` on that page calls its own `flowPick(type)` and opens that activity's
calendar directly, so every row is a real deep link. That page also guesses the
venue from the browser timezone, which is why nothing here needs to.

### Activities, not dates

It used to list the next few dated slots. Activities are the better unit: a date is
stale the moment it passes, whereas "we run these five things" holds, and the
booking page's calendar is a better place to pick a time than three rows on a
landing page.

`ACTIVITIES` in `assets/booking.js` — the list, in reading order, shortest and most
accessible first. `types` holds the ids the API tags slots with, which are also the
ids `?a=` accepts, so adding an activity is a single entry.

**One activity sits under two API ids.** `eeg` is Geneva's, titled "EEG Meditation
Session"; `qm` is the same session in Hyderabad and Los Angeles, titled "QM Session"
— QM being Quantified Meditation. They're one row here under the Lounge site's fuller
public name, **Quantified Meditation Session**, and its detail line unions all three
venues. Worth reconciling upstream so one activity stops having two names and two
ids.

That merge is also the one row that does **not** deep-link. The two ids are disjoint
by venue, and the booking page's `flowPick` doesn't check that the venue it guessed
actually runs the type it was handed — so `?a=eeg` would open an empty calendar for a
reader in India. It goes to the plain calendar instead and lets that page resolve the
venue, which it already does from the browser timezone.

### Why the rows render before the data

The rows and their links need no data, so they go up the moment the script runs. The
catalogue then fills in each row's detail line, and if it never arrives the list
still stands with every link working — which is also what a visitor with no
JavaScript gets from the static fallback in `index.html`.

That detail line carries where the activity runs and how long it takes, and nothing
else:

The venues are named **once, under the heading** (`.booking__venues`), in `VENUES`
declaration order — not on each row, where the same four names repeated all the way
down. That line isn't filtered to venues with something on the calendar either: it
says where All Here operates, which stays true whether or not Tokyo has an opening
this week. It needs no data, so it renders as soon as the script does.

Each row then carries only its duration, dropped when a type's slots differ in length
(EEG runs both 120 and 150 min) — so a line can be short but never wrong.

**No prices.** The booking page states them next to the slot you're actually
choosing, where they can't drift out of step with what you'll be charged.

### The list scrolls on desktop

The list is taller than the right-hand column has room for once everything else is
placed, so from 980px `.booking__options` is capped at three rows and scrolls inside
the panel. A permanent bottom fade is safe because the list is always longer than the
cap — but it sits on the bottom **edge** only: reaching further up dimmed a row that
was fully present, which read as a rendering fault rather than as "there is more
below". On phones the panel has a whole screen to itself, so there's no cap and no
scrolling.

### Fetching

The catalogue is 24 KB and **the API does not compress it** — bigger than this whole
page. It's fetched only when the panel is within a screen of the viewport:
immediately on desktop, and on a phone only for visitors who reach the last screen.

Two independent triggers do that, because the detail lines are worth fetching once
but not worth losing to a single missed signal: a `getBoundingClientRect` test (run
immediately, then on scroll and resize) and an `IntersectionObserver`. Whichever
fires first wins. The rect test is what covers the panel already being in view at
load; the observer catches anything that moves it into view without a scroll event —
a hash landing, a restored scroll position, a layout shift above it.

> Neither trigger fires in a browser pane that isn't being actively rendered, which
> is worth knowing if you ever test this headless: scroll events aren't dispatched
> and intersections aren't computed. The at-load path is observable at desktop
> widths; the lazy path needs a real browser.

---

## The QR codes

`qr/allhere-qr.svg` (vector, for print) and `qr/allhere-qr.png` both encode
`https://allheregeneva.github.io/AllHereLinks/` at error-correction level Q, so they
still scan with a logo covering the centre or with some print wear.

**Regenerate them whenever the URL changes** — see the migration note below:

```bash
python3 -c "
import segno
q = segno.make('https://allhere.org/start/', error='q')
q.save('qr/allhere-qr.svg', scale=10, border=2, dark='#00102E', light=None)
q.save('qr/allhere-qr.png', scale=16, border=2, dark='#00102E', light='#FFFFFF')
"
```

---

## Moving to allhere.org

The page is self-contained: copy `index.html`, `assets/` and drop them in a
directory on the web server. Two things are absolute rather than relative and have
to be updated:

1. `og:url` and `og:image` in `index.html` — link-preview crawlers don't resolve
   relative paths.
2. The URL baked into the QR codes (above). **Anything already printed keeps
   pointing at the GitHub Pages URL**, so leave a redirect from
   `allheregeneva.github.io/AllHereLinks/` to the new home rather than deleting
   this repo.

Everything else (fonts from Google Fonts, the world map link, the store links)
works unchanged.

### Store ids

`id6765625119` and `org.allhere.silentmind`, verified against the iTunes lookup
API and the live Play listing. Same ids the live allhere.org footer and the
Lounge site (`silent-mind.html`) use; this page just omits the `/ch/` storefront
so Apple redirects each visitor to their own.

A **stale** pair (`6746474674` / `com.allhere.allhere`, both 404) is still hard-coded
in two places that haven't shipped or aren't public:
`_WIP/allhere-website/src/pages/` (the unreleased Astro rebuild — `index.astro`,
`the-practice/silent-mind-app.astro`, `the-technology/silent-mind-xr.astro`) and
`XRPlatform_Doc/index.html`. Worth fixing there before that rebuild goes live.

---

## Local preview

```bash
python3 ../.claude/serve-nocache.py 8778 AllHereLinks
```

(That's what `.claude/launch.json` runs. It's `http.server` plus a
`Cache-Control: no-store` header — the plain module sends `Last-Modified`, and the
browser then happily reuses a stale stylesheet after an edit, which quietly made
several rounds of local testing measure the *previous* CSS. Nothing about it ships;
GitHub Pages does its own, correct, ETag caching.)

Then open http://localhost:8778. A server is needed because the audio is loaded
over HTTP; opening `index.html` from `file://` works for layout but the shader and
audio may be blocked.
