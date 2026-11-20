// argent `script:` step: replaces flint's database on the booted simulator with
// fresh store data (goldie/seed/seed-store-data.ts), dated to end today.
// the app group container survives goldie's reinstall, so every later flow in
// the same capture sees the same habits. the app is terminated first so it
// never holds the old file open; the next `launch:` step opens the new one.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_ID = "studio.orbitlabs.habitsystem";
const GROUP_ID = `group.${BUNDLE_ID}`;
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "../..");

const devices = JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "booted", "-j"]).toString()).devices;
const booted = Object.values(devices).flat().filter((device) => device.state === "Booted");
const device = booted.find((d) => d.name.includes("Pro Max")) ?? booted[0];
if (!device) throw new Error("no booted simulator");

const groups = join(device.dataPath, "Containers/Shared/AppGroup");
const group = readdirSync(groups)
  .map((name) => join(groups, name))
  .find((dir) => {
    const meta = join(dir, ".com.apple.mobile_container_manager.metadata.plist");
    return existsSync(meta) && execFileSync("plutil", ["-extract", "MCMMetadataIdentifier", "raw", meta]).toString().trim() === GROUP_ID;
  });
if (!group) throw new Error(`no ${GROUP_ID} container on ${device.udid}; launch flint once first`);

try {
  execFileSync("xcrun", ["simctl", "terminate", device.udid, BUNDLE_ID], { stdio: "ignore" });
} catch {
  // not running
}
for (const suffix of ["", "-wal", "-shm"]) rmSync(join(group, `ripples.db${suffix}`), { force: true });
const summary = execFileSync("bun", ["goldie/seed/seed-store-data.ts", join(group, "ripples.db")], { cwd: appRoot }).toString();
globalThis.output = { device: device.udid, ...JSON.parse(summary.trim().split("\n").at(-1)) };
