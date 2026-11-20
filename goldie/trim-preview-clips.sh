#!/bin/sh
# run after `goldie capture`, before `goldie preview`.
# goldie pins the status bar again as each preview clip starts, and iOS redraws
# it for about a second (the real clock, a wifi icon that comes and goes). every
# preview flow opens with a still wait, so cutting that wait off loses nothing.
set -eu
raw="$(dirname "$0")/out/raw/iphone-6.9"
trim() {
  clip="$raw/preview-$1.mp4"
  ffmpeg -loglevel error -y -ss "$2" -i "$clip" -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p -an "$clip.trimmed.mp4"
  mv "$clip.trimmed.mp4" "$clip"
  printf '%s trimmed %ss, now %ss\n' "$1" "$2" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$clip")"
}
trim check 1.6
trim grid 1.1
trim streak 1.1
trim coins 1.1
