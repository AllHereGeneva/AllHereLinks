# All Here — QR landing page

A single-page "start here" for QR codes: an instant guided meditation behind the
app's play button, the world map of meditators, and the links to get to know us.

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
| `assets/shader.js` — animated atmosphere | `src/shaders/glsl.ts` (`FRAG_SPACE` + `COMMON`), driven the way `src/components/AtmosphereBackground.tsx` drives it |
| `.play` in `assets/links.css` — ring, halo, ripple, breath, sway | `src/components/CircleButton.tsx` |
| Colour / type / spacing tokens at the top of `assets/links.css` | `src/theme/index.ts` |
| "Your journey to the Silent Mind", "Instant meditation", pill labels | `app/(tabs)/index.tsx` + `src/content/copy.json` |
| `assets/audio/inner_*.mp3` | `assets/audio/Inner/` (re-encoded, see below) |
| `assets/img/allhere-logo.png` | `assets/images/allhere-logo.png` |

If any of those change in the app, they have to be copied over by hand — there's
no shared package.

### Two deliberate deviations

- **The pills are a selector, not two launchers.** In the app each pill starts
  its own track. Here a single play button plays whichever length is selected,
  so the pills carry a visible pressed state (`aria-pressed`) that the app's
  don't have.
- **A scrim sits behind the link list** (`.links::before`). The shader's
  milky-way band is bright enough in places that 15 px labels over it get
  tiring; the app solves the same problem by stacking two flat dark overlays
  over its video background (`VideoBackground.tsx`).

---

## Editing

**Links** — plain markup in `index.html`, under `<ul class="link-list">`. Each row
is a `<li>` with an inline SVG icon, a title, a sub-label and a chevron. The
first row carries `link--featured` (the 4 px accent rail); keep that on one row
only.

**The meditations** — the two `<button class="pill">` elements carry everything in
data attributes: `data-src`, `data-title`, `data-duration`. Add a third pill and
it works with no JS change.

Source audio is `AllHereApp/assets/audio/Inner/*.mp3`, which ships at 256 kbps
stereo. Re-encode before committing — 96 kbps is transparent for voice and cuts
the 1-minute file from 1.8 MB to 720 KB, which matters when the page is reached
by scanning a code on mobile data:

```bash
ffmpeg -i inner_1min.mp3 -codec:a libmp3lame -b:a 96k -ar 44100 assets/audio/inner_1min.mp3
```

**The atmosphere** — `assets/shader.js` holds one fragment shader in `FRAG`. To
change theme, paste another `FRAG_*` body from the app's `src/shaders/glsl.ts`;
the uniforms (`uTime`, `uRes`) are identical, so it's a straight copy.
`FRAG_EARTH_TOPDOWN` ("lake" — ripples on still water, the theme a first-time app
user lands on) is the calmer alternative to the current `FRAG_SPACE`.

The shader keeps the app's perf guardrails: one frame in three (~20 fps), the
drawing buffer capped at 1.5× CSS pixels, and no frames submitted while the tab
is hidden. If WebGL is unavailable the CSS gradient on `body` shows through
instead — the same fallback the app uses.

> Do not put `overflow`, `filter` or `contain` on `<html>` or `<body>`: any of
> them makes the element a containing block for `position: fixed` descendants,
> which detaches the atmosphere canvas from the viewport and scrolls it off the
> page.

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
directory on the web server. Two things are absolute rather than relative and
have to be updated:

1. `og:url` and `og:image` in `index.html` — link-preview crawlers don't resolve
   relative paths.
2. The URL baked into the QR codes (above). **Anything already printed keeps
   pointing at the GitHub Pages URL**, so leave a redirect from
   `allheregeneva.github.io/AllHereLinks/` to the new home rather than deleting
   this repo.

Everything else (fonts from Google Fonts, the world map link, the store links)
works unchanged.

---

## Local preview

```bash
python3 -m http.server 8777 --directory .
```

Then open http://localhost:8777. A server is needed because the audio is loaded
over HTTP; opening `index.html` from `file://` works for layout but the shader
and audio may be blocked.
