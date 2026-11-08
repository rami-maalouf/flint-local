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
| `api/waitlist.ts` | The waitlist form's endpoint, `POST /api/waitlist`: a Vercel edge function, copied into `dist/api/` by the build. |

```sh
bun install
bun run preview    # build, then serve dist/ on a local port
bun run build      # dist/, ready for any static host
./deploy.sh        # build and publish to Vercel (project "flint")
```

Bun's dev server can't resolve the fonts' absolute paths, so preview the built site.

## The waitlist

The hero and the close each hold the same form: pick iPhone, Android or both, and leave an email. `api/waitlist.ts` writes it to the shared Orbit Labs waitlist in Notion (the "Twilight waitlist" data source, also used by Twilight, Ignite, Serendipity and Eloq) with `App` set to `flint` and `Platform` set to `iOS`, `Android` or both. A second signup with the same email adds any new platform to the existing Flint row instead of adding a row. A hidden field catches simple bots.

The Vercel project `flint` needs two production variables: `NOTION_API_KEY` (the integration with access to that data source) and `NOTION_WAITLIST_DATASOURCE_ID`. The function calls the Notion API with `fetch`, so the static deploy needs no packages.

## Claims

The site describes Flint as it ships to TestFlight from `rami-maalouf/flint` (bundle `studio.orbitlabs.habitsystem.fullstack`): an optional account with sync to Flint's server, and AI assistants through MCP at `habits.ramimaalouf.com/mcp`. Keep each claim true to that app. The App Store listing, the TestFlight beta information and the app's Settings link to `/privacy` here; change it with care. When the App Store listing is live, add the store link next to the waitlist.
