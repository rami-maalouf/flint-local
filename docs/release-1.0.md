# Release 1.0 plan

Updated November 20, 2026. This page is the plan for the first App Store release of Flint Local. It records what the 1.0 build contains, what the App Store Connect record needs, and what is still open. It is not evidence that the app is released.

## Identity

The release keeps every installed identity, so existing installs update in place and keep their data.

| Item | Value |
| --- | --- |
| App Store name | Flint: habit tracker |
| Home Screen name | Flint (`CFBundleDisplayName`, the widget and every visible string). `expo.name` stays Flint Local: it names the generated Xcode project and picks the aurora palette in `brand/` |
| Bundle ID | `studio.orbitlabs.habitsystem` |
| App Group | `group.studio.orbitlabs.habitsystem` |
| iCloud container and zone | `iCloud.studio.orbitlabs.habitsystem`, zone `habit-system` |
| Version | 1.0.0 (`app.json`); EAS sets the build number (`appVersionSource: remote`) |
| Devices | iPhone only (`ios.supportsTablet: false`); the widget extension follows the app |
| Minimum iOS | 18.6 |
| Price | Free, with an optional one-time donation |
| Donation product | `studio.orbitlabs.habitsystem.tip.developer.support`, non-consumable, US base price $1.99 |
| Apple team | `3V2UU7RRK9` |
| EAS project | `07481ea0-9f44-4f24-ad3c-fd889569cade` |

## What 1.0 contains

- The flame brand: the aurora flame app icon, the Midnight and Paper icon choices, and the launch flame (`docs/brand.md`).
- Half streaks on Home and in habit progress: one missed day keeps the half streak, two in a row reset it. Home cards show a filled flame for the streak and an outlined flame for the half streak.
- iCloud sync through the private CloudKit database. It is off by default. The person turns it on in Settings > iCloud Sync, after a confirmation that names their own private iCloud account. With sync off, the app makes no CloudKit call.
- The tip jar: Settings > Support Flint. The price comes from StoreKit and is never written in the app. A donation unlocks nothing. After a purchase the screen thanks the person, and Restore Purchase brings the thank-you back through the Apple Account. Sample mode disables the screen.

## iCloud sync acceptance

On 2026-11-20 the owner reported that sync works on physical devices ("owner verified on physical devices") and chose to ship it in 1.0. The repository holds no device evidence for that report. T19's formal two-target acceptance and Checkpoint C stay as `checkpoints.md` records them.

The `production` build profile signs with the CloudKit **Production** environment (`RIPPLES_CLOUDKIT_ENVIRONMENT=Production`). Development and preview builds use the Development environment. Before the release, deploy the CloudKit schema from Development to Production in the CloudKit Console, then check sync once on a TestFlight build, which uses Production. Without the deployed schema, sync in the store build fails.

## App Store Connect

The owner creates the record and the parent agent runs builds and submissions. The record needs:

1. A new app for bundle ID `studio.orbitlabs.habitsystem`, named "Flint: habit tracker". App names are unique on the App Store. An earlier preparation of the full-stack Flint app (`studio.orbitlabs.habitsystem.fullstack`) used the same title with App Store Connect app ID `6832284268` in a local checkpoint. If that record exists and holds the name, rename or remove it first.
2. The in-app purchase: non-consumable, product ID `studio.orbitlabs.habitsystem.tip.developer.support`, US base price $1.99, with a review screenshot of Settings > Support Flint. Submit it with version 1.0.0.
3. An active Paid Apps Agreement with tax and banking details. StoreKit returns no product without it, and the screen then shows "Donations are unavailable right now".
4. The listing in `store.config.json` (push it with `bunx eas-cli metadata:push`). The first version cannot carry release notes, so the file has none.
5. `eas.json` `submit.production` has no `ascAppId` yet. Add it after the record exists.
6. Release: the owner chose an automatic release after approval (`automaticRelease: true`) and Health & Fitness as the primary category (`categories` in `store.config.json`).

Reviewer notes (keep private details in App Store Connect): no account is needed; iCloud sync is optional in Settings > iCloud Sync; the donation is in Settings > Support Flint and unlocks nothing; Settings > Utilities > Try a sample opens a full sample without touching real data.

## Network requests of the Release app

Use this list for the App Privacy questionnaire. The app has no analytics, advertising, crash reporting, or account server.

| Request | When | What it carries |
| --- | --- | --- |
| CloudKit private database (Apple) | Only while iCloud sync is on: zone setup, upload of changed records, fetch of changes | The person's habits, check-ins, notes, stacks, coins, rewards and settings, in their own private iCloud database. The developer cannot read it. |
| CloudKit account status (Apple) | When Settings > iCloud Sync is open, and in each sync pass | The iCloud account status only |
| EAS Update (`u.expo.dev`, Expo) | On every launch (`checkOnLaunch: ALWAYS`), while `expo-updates` is on | Platform, runtime version 1.0.0, the channel, the current and embedded update IDs, and `EAS-Client-ID`: a random ID that `expo-updates` creates on the device. No habit data. |
| StoreKit (Apple) | When Settings > Support Flint is open, on purchase, on restore, and through `Transaction.updates` | Product lookup, the purchase and its verified transaction. Apple processes the payment; the app keeps no receipt. |
| In-app browser (Safari view) | Only when the person taps an external Settings link | The page request. All release links are empty today (see below). |

Reminders and missed-day alerts are local notifications. The app never asks for a push token, although the `aps-environment` entitlement is present.

## Open before submission

- **In-app links.** Every value in `src/features/settings/release-links.ts` is `null`. In the Release build, Privacy Policy, Terms Of Use, Rate, feedback and More products show "Missing release link". Apple expects the privacy policy to be reachable inside the app. Proposed values: privacy `https://flint.orbitlabs.studio/privacy`, feedback `https://flint.orbitlabs.studio/support`, terms Apple's standard EULA, rate `https://apps.apple.com/app/id<app id>?action=write-review` once the record exists.
- **Website.** `website/src/privacy.html`, `support.html` and the home page now describe the app that ships: no account or server, optional private iCloud sync, the donation, and EAS Update. The site is not deployed from this branch; deploy it (`website/deploy.sh`) before submission so the listing's privacy and support URLs show this text.
- **EAS Update channel.** The store build listens on the `production` channel with runtime version 1.0.0. An update already published there for 1.0.0 replaces the build's JavaScript after the first launch. Check the channel before release.

## Validation

```bash
bun run validate        # lint, typecheck, jest with coverage
bun run test:native     # plugin config and swift package tests
bun run test:storekit   # hosted storekit tests; needs xcodegen and an iOS 26.1 or 27 iPhone simulator
```
