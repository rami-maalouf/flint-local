#!/bin/zsh
# full-resolution raw captures for the app-store-screenshots editor, in both
# appearances, from the same store flows goldie replays. unlike goldie's own
# pin, the status bar shows a full white battery (apple's marketing look)
# instead of the green charging one.
#   goldie/capture-raw.sh [light|dark ...]
# when the global argent and the one goldie bundles both run a tool-server,
# launches can fail to reach native devtools; point ARGENT_CLI at goldie's:
#   ARGENT_CLI="node <bunx goldie cache>/node_modules/@swmansion/argent/dist/cli.js"
set -eu
cd "$(dirname "$0")/.."
argent_cli=${ARGENT_CLI:-argent}
udid=$(xcrun simctl list devices booted -j | jq -r '[.devices[][] | select(.name == "iPhone 17 Pro Max")][0].udid')
out=goldie/out/captures
pin() {
  xcrun simctl status_bar "$udid" override --time 9:41 --batteryState discharging --batteryLevel 100 \
    --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --dataNetwork wifi --operatorName ''
}
for appearance in ${@:-light dark}; do
  xcrun simctl ui "$udid" appearance "$appearance"
  mkdir -p "$out/$appearance"
  for flow in store-01-grid store-02-half-streak store-03-stack store-04-coins store-05-today ${=EXTRA_FLOWS:-}; do
    eval "$argent_cli flow run $flow --device $udid" | grep -E '^(PASS|FAIL)'
    pin; sleep 1.2; pin; sleep 0.6
    env -u ARGENT_SCREENSHOT_SCALE ${=argent_cli} run screenshot --udid "$udid" --scale 1 --out "$out/$appearance/$flow.png" > /dev/null
    sips -g pixelWidth -g pixelHeight "$out/$appearance/$flow.png" | tail -2 | tr '\n' ' '; echo
  done
done
