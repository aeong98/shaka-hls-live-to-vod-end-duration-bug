#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/media
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=size=320x180:rate=24' \
  -f lavfi -i 'sine=frequency=440:sample_rate=48000' \
  -t 180 -map_metadata -1 -c:v libx264 -preset fast -crf 32 -pix_fmt yuv420p \
  -g 48 -keyint_min 48 -sc_threshold 0 -c:a aac -b:a 32k \
  -f hls -hls_time 2 -hls_playlist_type event -hls_flags independent_segments \
  -hls_segment_filename 'public/media/segment_%03d.ts' public/media/base.m3u8
