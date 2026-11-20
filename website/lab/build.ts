// builds the lab into lab/dist, apart from the site: bun run lab/build.ts
import { cp, rm } from "node:fs/promises";
const here = new URL(".", import.meta.url).pathname;
await rm(`${here}dist`, { recursive: true, force: true });
const result = await Bun.build({ entrypoints: [`${here}index.html`], outdir: `${here}dist`, minify: true, external: ["/fonts/*"] });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await cp(`${here}../src/public`, `${here}dist`, { recursive: true });
console.log("built the lab");
