import { resolve } from "node:path";

import type { GoldieConfig } from "goldie";

// store screenshots and the app preview for the app store app "Flint: habit
// tracker", which is this repository (flint local, bundle studio.orbitlabs.habitsystem).
// ported from the full-stack flint repository, where the first store set was made.
// the steps around a capture:
//   1. build the release simulator app (ios/ is generated and ignored):
//        bunx expo prebuild --platform ios --clean
//        set EXUpdatesEnabled to false in ios/FlintLocal/Supporting/Expo.plist, so the
//        capture shows this commit's bundle and never an over-the-air update
//        xcodebuild -workspace ios/FlintLocal.xcworkspace -scheme FlintLocal -configuration Release \
//          -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
//          -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build
//   2. sign it ad hoc with only the app group entitlement, so the database lives
//      in the app group container (it survives goldie's reinstall):
//        codesign --force --sign - --entitlements goldie/seed/simulator.entitlements \
//          ios/build/Build/Products/Release-iphonesimulator/FlintLocal.app/PlugIns/ExpoWidgetsTarget.appex
//        codesign --force --sign - --entitlements goldie/seed/simulator.entitlements \
//          ios/build/Build/Products/Release-iphonesimulator/FlintLocal.app
//   3. an "iPhone 17 Pro Max" simulator on iOS 26.5. goldie picks the newest
//      runtime with that device, and an expo sdk 57 app built with the iOS 27 sdk
//      stops at launch on iOS 27, so keep that device on iOS 26 only.
// every screenshot flow starts with goldie/seed/install-store-data.mjs, which
// writes fifteen months of habits that end today; nothing is typed by hand.
const APP_ROOT = resolve(import.meta.dirname, "..");

const config: GoldieConfig = {
  appRoot: APP_ROOT,
  appPath: `${APP_ROOT}/ios/build/Build/Products/Release-iphonesimulator/FlintLocal.app`,
  bundleId: "studio.orbitlabs.habitsystem",

  devices: ["iphone-6.9"],
  locales: ["en-US"],
  // light: at store and search-result size the light screens stand out from the
  // navy studio, and the small grey text that carries streak counts stays
  // legible. the first goldie pass was dark (git history, passes/ in the editor)
  appearance: "light",

  frame: { variant: "17-pro-silver" },

  theme: {
    // docs/brand.md: the navy studio the flame sits on
    background: "linear-gradient(165deg, #22355C 0%, #101B36 48%, #050912 100%)",
    headlineColor: "#FFFFFF",
    subheadColor: "#C3CEEA",
    fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    copyHeightRatio: 0.24,
    deviceWidthRatio: 0.84,
    template: ["hero", "classic", "classic", "classic", "classic"],
    layout: "classic",
  },

  store: {
    name: "Flint: habit tracker",
    subtitle: { "en-US": "Keep small habits lit" },
    developer: "Rami Maalouf",
    category: "Health & Fitness",
    rating: 5,
    ratingCount: "New",
    ageRating: "4+",
    price: "Free",
    description: {
      "en-US":
        "A habit is a small fire you keep lit. Flint gives every habit a board you check with one tap, and shows each day you showed up as a streak and a year of color.\n\nMiss a day and the half streak keeps going: one missed day is not the end of it, two in a row is. Stack habits that follow each other into a routine, earn coins for your check-ins, and spend them on rewards you choose.\n\nWidgets, reminders, a journal for each habit, and optional iCloud sync across your devices.",
    },
  },

  // the final store set comes from the app-store-screenshots editor
  // (life-os/design/app-store/flint), fed by goldie/capture-raw.sh; these
  // scenes keep the same order and copy so goldie's own render stays a
  // faithful draft, and goldie still records the app preview.
  scenes: [
    {
      kind: "screenshot",
      id: "grid",
      flow: "store-01-grid",
      headline: { "en-US": "Keep your\nhabits lit" },
      subhead: { "en-US": "Every day you show up, in color." },
    },
    {
      kind: "screenshot",
      id: "half-streak",
      flow: "store-02-half-streak",
      headline: { "en-US": "Missed a day?\nKeep going." },
      subhead: { "en-US": "One missed day keeps your half streak.\nTwo in a row resets it." },
    },
    {
      kind: "screenshot",
      id: "today",
      flow: "store-05-today",
      headline: { "en-US": "One tap.\nDone for today." },
      subhead: { "en-US": "Check in from home.\nYour streak and half streak keep count." },
    },
    {
      kind: "screenshot",
      id: "stack",
      flow: "store-03-stack",
      headline: { "en-US": "Stack habits\ninto a routine" },
      subhead: { "en-US": "Stretch, then water, then a page.\nSee every morning you finished." },
    },
    {
      kind: "screenshot",
      id: "coins",
      flow: "store-04-coins",
      headline: { "en-US": "Pay yourself\nin rewards" },
      subhead: { "en-US": "Each check-in earns a coin.\nSpend them on treats you choose." },
    },
    {
      kind: "preview",
      id: "preview",
      segments: [
        { id: "check", flow: "store-preview-01-check" },
        { id: "grid", flow: "store-preview-02-grid" },
        { id: "streak", flow: "store-preview-03-streak" },
        { id: "coins", flow: "store-preview-04-coins", holdSeconds: 1 },
      ],
    },
  ],
};

export default config;
