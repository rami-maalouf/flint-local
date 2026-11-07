# Flint's website

The one-page site for Flint at [flint.orbitlabs.studio](https://flint.orbitlabs.studio): what the app does, in a few lines, around the app icon's own flame. The flame is live: the last fourteen days sit under it, they light one by one, one is missed, and the flame grows. Tap a day to check it in or out. One missed day dims the flame; two in a row burn it down to an ember. That is the app's never-miss-twice rule, shown without a word.

It is plain HTML, CSS and one module, bundled by [Bun](https://bun.sh) into static files. The words and layout load first; the 3D flame is a separate file that loads after the page has painted, draws only while it is on screen, and holds still for readers who ask for reduced motion. Without WebGL, a still of the flame stands in.

| File | What it is |
|---|---|
| `src/index.html` | The page: the hero with the flame and its days, why Flint, how it works, the close. |
| `src/privacy.html`, `src/support.html` | Privacy and support, at `/privacy` and `/support`. |
| `src/styles.css` | The look: a night studio and the flame's turquoise, blue, indigo and lime. |
| `src/main.js` | Entrances, the frosted bar, the fourteen days and the flame's level, and the deferred load of the scene. |
| `src/scene.js` | The live flame, built from `../brand/flame.js`: flicker, the cursor's lean, and growth with the days. |
| `src/img/` | The icon cuts, the mark, the still and the share image, all rendered by `../brand` (`bun run render`). |
| `src/public/fonts/` | Sora, Geist and Geist Mono (SIL OFL). |
| `build.ts` | Bundles the pages into `dist/` and adds the fixed-address files. |

```sh
bun install
bun run preview    # build, then serve dist/ on a local port
bun run build      # dist/, ready for any static host
./deploy.sh        # build and publish to Vercel (project "flint")
```

Bun's dev server can't resolve the fonts' absolute paths, so preview the built site.

Keep each claim true to the app: `README.md` and the product specs are the source. When the App Store listing is live, replace "Coming soon to the App Store" with the store link in the hero and the close.
