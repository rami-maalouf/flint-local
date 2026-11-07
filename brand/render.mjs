// renders every picture of the flame this app uses, from brand/flame.js:
//
//   cd brand && bun install && bun run render
//
// the app's name in app.json picks the palette: flint local is aurora, flint is violet. it
// bundles page.js, screenshots each picture with headless brave or chrome at twice its size,
// scales it down with macOS `sips`, and flattens the app icons to opaque rgb with ffmpeg.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname);
const root = join(here, "..");
const images = join(root, "assets", "images");
const website = join(root, "website", "src", "img");
const work = join(here, ".render");

const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo.name;
const palette = { "Flint Local": "aurora", Flint: "violet" }[app];
if (!palette) throw new Error(`no flame palette for the app named ${app}`);

const BROWSERS = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const browser = process.env.BRAND_BROWSER ?? BROWSERS.find((b) => existsSync(b));
if (!browser) throw new Error("needs brave, chrome or chromium, or BRAND_BROWSER");

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const built = await Bun.build({ entrypoints: [join(here, "page.js")], outdir: work, format: "iife", minify: true });
if (!built.success) throw new Error(built.logs.join("\n"));
writeFileSync(join(work, "page.html"), `<!doctype html><html><body style="margin:0;background:transparent"><script src="page.js"></script></body></html>`);

const sips = (...args) => execFileSync("sips", args, { stdio: "ignore" });
const flatten = (from, to) => execFileSync("ffmpeg", ["-v", "error", "-y", "-i", from, "-pix_fmt", "rgb24", to]);

// one screenshot at twice the final size, scaled down for clean edges
function shoot(name, { width, height = width, studio = "none", fill = 0.7, flame = "flame" }) {
  const big = join(work, `${name}-2x.png`);
  const url = `file://${join(work, "page.html")}?width=${width * 2}&height=${height * 2}&studio=${studio}&fill=${fill}&palette=${palette}&flame=${flame}`;
  execFileSync(browser, [
    "--headless=new",
    "--hide-scrollbars",
    "--use-angle=metal",
    "--default-background-color=00000000",
    `--window-size=${width * 2},${height * 2}`,
    "--virtual-time-budget=30000",
    `--screenshot=${big}`,
    url,
  ], { stdio: "ignore" });
  const out = join(work, `${name}.png`);
  sips("-z", String(height), String(width), big, "--out", out);
  return out;
}

const icon = (studio) => shoot(`icon-${studio}`, { width: 1024, studio, fill: 0.7 });
mkdirSync(join(images, "alternate-icons"), { recursive: true });
flatten(icon("navy"), join(images, "icon.png"));
flatten(icon("amber"), join(images, "icon-development.png"));
flatten(icon("midnight"), join(images, "alternate-icons", "midnight.png"));
flatten(icon("paper"), join(images, "alternate-icons", "paper.png"));

// the launch mark: the flame alone, over the app's own white or black
const mark = shoot("mark", { width: 1024, fill: 0.86 });
sips("-s", "format", "png", mark, "--out", join(images, "splash-icon.png"));

// android's adaptive icon: the flame inside the safe circle, over the navy studio
sips("-s", "format", "png", shoot("android-foreground", { width: 512, fill: 0.52 }), "--out", join(images, "android-icon-foreground.png"));
sips("-s", "format", "png", shoot("android-background", { width: 512, studio: "navy", flame: "none" }), "--out", join(images, "android-icon-background.png"));

// android's themed icon is a plain silhouette: the outer flame, filled white
const { OUTER } = await import("./flame.js");
const silhouette = join(work, "monochrome.svg");
writeFileSync(silhouette, `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="-160 -160 832 832"><path d="${OUTER}" fill="#ffffff"/></svg>`);
sips("-s", "format", "png", silhouette, "--out", join(images, "android-icon-monochrome.png"));

sips("-Z", "48", join(images, "icon.png"), "--out", join(images, "favicon.png"));

// the website's cuts, when this repository has one
if (existsSync(join(root, "website"))) {
  mkdirSync(website, { recursive: true });
  sips("-Z", "180", join(images, "icon.png"), "--out", join(website, "icon-180.png"));
  sips("-Z", "64", join(images, "icon.png"), "--out", join(website, "icon-64.png"));
  sips("-Z", "256", mark, "--out", join(website, "mark.png"));
  const share = shoot("share", { width: 1200, height: 630, studio: "navy", fill: 0.72 });
  sips("-s", "format", "jpeg", "-s", "formatOptions", "86", share, "--out", join(website, "share.jpg"));
  // without webgl, the site shows this still in place of the live flame
  sips("-Z", "720", mark, "--out", join(website, "flame-still.png"));
}

rmSync(work, { recursive: true, force: true });
console.log(`rendered the ${palette} flame for ${app}`);
