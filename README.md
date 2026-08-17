# All Here — QR landing page

A single-page "start here" for QR codes: the app's six instant meditations behind
its play button, the world map of meditators, and the links to get to know us.

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

`assets/img/app-phone.jpg` comes from the Lounge site instead
(`AllHereLounge/site/assets/images/app-phone.jpg`), which puts it beside its own
download links; it happens to show the very screen this page ports.

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

One centred column on phones. From 640px the column widens; from 980px the page
becomes a two-column grid — brand and hero on the left, the links panel on the
right — sized so it clears a 1280×800 laptop without the page scrolling.

Both grid rows are `auto`, never `1fr`: a fractional row swallows the free space
and leaves `align-content: center` nothing to distribute, which pins the brand to
the top of the window instead of centring the stack.

---

## Editing

**Links** — plain markup in `index.html`, under `<ul class="link-list">`. Each row
is a `<li>` with an inline SVG icon, a title, a sub-label and a chevron. The first
row carries `link--featured` (the 4 px accent rail) and a `link__thumb` preview;
keep both on one row only, or the emphasis stops meaning anything.

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

## The QR codes

`qr/allhere-qr.svg` (vector, for print) and `qr/allhere-qr.png` both encode
`https://allheregeneva.github.io/AllHereLinks/` at error-correction level Q, so
they still scan with a logo covering the centre or with some print wear.

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

### One thing to fix upstream

allhere.org's footer links a **stale App Store id (`6746474674`) and Play package
(`com.allhere.allhere`)** — both 404. The real ones, verified against the iTunes
lookup API and the live Play listing and used here, are `id6765625119` and
`org.allhere.silentmind`. The Lounge site (`silent-mind.html`) already has them
right; only allhere.org is wrong.

---

## Local preview

```bash
python3 -m http.server 8777 --directory .
```

Then open http://localhost:8777. A server is needed because the audio is loaded
over HTTP; opening `index.html` from `file://` works for layout but the shader and
audio may be blocked.
