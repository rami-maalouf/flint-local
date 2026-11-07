# Brand

Updated November 7, 2026. This page is the same in Flint Local and Flint; only the palette each app uses differs.

## The mark

The mark is a flame. A habit is a small fire you keep lit: each day you check in feeds it, and one missed day is not the end of it. The flame has a tall middle tongue, a flick on each side (the "crown"), and an inner flame low in its body.

It is drawn as a 2D outline, then puffed up into glossy toy plastic that glows in its own colours. The outline stays exactly as drawn; the surface rises with a round edge and a soft dome. There is no face, no sparkle and no lettering.

| App | Palette | Outer flame, bottom to tips | Inner flame |
| --- | --- | --- | --- |
| Flint Local | Aurora | turquoise `#22d3c5`, blue `#3b82ff`, indigo `#4338ff` | lime `#b6ef4a` to `#f4ffd0` |
| Flint (account sync) | Violet | cyan `#4ad6ff`, violet `#6a5cff`, purple `#8b3dff` | ice `#b8f7ff` to white |

The app icon sits on a navy studio (`#22355c` to `#050912`). The app itself stays monochrome: black, white and system Liquid Glass. The flame's colours belong to the mark, not to the interface.

## Assets

| Asset | Usage |
| --- | --- |
| `assets/images/icon.png` | The app icon: the flame on the navy studio, 1024 by 1024, opaque |
| `assets/images/icon-development.png` | Development builds: the same flame on amber, so they never pass for the release |
| `assets/images/alternate-icons/midnight.png`, `paper.png` | The in-app icon choices: the flame on black, and on light paper. Their names are stored settings; keep them |
| `assets/images/splash-icon.png` | The launch flame, on transparency, over white in light mode and black in dark mode |
| `assets/images/android-icon-*.png` | Android's adaptive icon: the flame, the navy studio, and a white silhouette for themed icons |
| `assets/images/favicon.png` | The web favicon |
| `website/src/img/*` | Flint Local only: the site's icon cuts, mark, share image and still |

All of them come from one script:

```bash
cd brand && bun install && bun run render
```

`brand/flame.js` holds the outline, the palettes and the 3D build; `brand/page.js` draws one picture; `brand/render.mjs` screenshots each picture at twice its size with headless Brave or Chrome (or `BRAND_BROWSER`), scales it down with macOS `sips`, and flattens the icons with `ffmpeg`. The app's name in `app.json` picks the palette. Change the art in `brand/flame.js`, never in the PNGs, and keep `brand/` identical in both repositories.

## Launch

The launch flame stays up until home has its habits to show (`src/platform/launch-screen.ts`), then fades over 350 ms. It never stays longer than four seconds.

## Names

The apps are Flint Local and Flint. A rename changes only what people see: bundle IDs, App Groups, URL schemes, EAS projects, database names and the backup format stay as they are, so installed apps update in place. A new icon reaches installed apps and App Store Connect only with a new native build.
