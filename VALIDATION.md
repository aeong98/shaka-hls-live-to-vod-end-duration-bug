# Validation record — growing live playlist

Date: 2026-09-15

This supersedes the previous all-segments-at-load EVENT experiment. Its successful 5.2.10 seek was not representative of this growing live stream. **Both versions reproduce the failure with the corrected fixture.**

## Environment

- macOS 26.5.2
- Codex in-app Chromium browser; reported user agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36`
- Local Node server, synthetic growing live HLS playlist, MSE playback
- Shaka releases installed unchanged from the public npm registry
- Explicit streaming configuration: `bufferingGoal: 10`, `rebufferingGoal: 2`, `bufferBehind: 10`, `preferNativeHls: false`

The macOS version reported in the user agent is reduced and does not identify the actual OS version.

## Fixture

Each session begins with 75 two-second segments (150 seconds of DVR history). One more segment is published every two seconds. The served playlist omits EXT-X-PLAYLIST-TYPE and retains previously published segments. Media bytes are pre-generated, but future segments are not yet referenced by the playlist.

End broadcast freezes the published segment list and adds ENDLIST. Otherwise the synthetic fixture ends automatically at 90 segments / 180 seconds, 30 wall-clock seconds after session creation.

## Manual ending observations

Both players loaded at 30 seconds and stayed paused. The displayed published length increased from 156 to 166 seconds while both players reported isLive=true and video.duration=Infinity. Both broadcasts were then ended at 84 segments / 168 seconds.

| Observation | 4.15.16 | 5.2.10 |
| --- | --- | --- |
| Before ENDLIST: isLive / isInProgress | true / false | true / false |
| Before ENDLIST: video.duration | Infinity | Infinity |
| Published length observed growing | 156 → 166 seconds | 156 → 166 seconds |
| Final published length | 168 seconds | 168 seconds |
| After ENDLIST: isLive / isInProgress | false / false | false / false |
| Final player.seekRange | 18–168 | 18–168 |
| After ENDLIST: video.duration | Infinity | Infinity |
| Before seek: video.seekable | 0–41.989333 | 0–40.012667 |
| Before seek: video.buffered | 30–41.989333 | 28.084334–40.012667 |
| Requested seek | 120 | 120 |
| Actual time after 2s | 41.989333 (failed) | 40.012667 (failed) |

Browser result timestamps: 2026-09-15T12:01:50.090Z (4.15.16), 2026-09-15T12:01:50.350Z (5.2.10).

The final presentation end is fixed, but video.duration remains Infinity. Shaka's final seek range contains 120 seconds; the browser's seekable range does not. Both seeks are clamped near their pre-seek buffered ends. Buffering resumes near those clamped positions, so the buffered/seekable ends can move again after the failed seek.

The reported seek-range start is Shaka's observed value, not an assertion that all published history remains exposed through its timeline.

## Automated server check

`npm test` passed using an injected clock, without wall-clock sleeps:

- Initial playlist has 75 segments and neither ENDLIST nor a playlist-type tag.
- At 1.999 seconds it is unchanged; at 2 seconds the 76th segment is added.
- Manual end at that point fixes duration to 152 seconds, even after more time or repeated end requests.
- Other sessions keep growing on independent session clocks.
- At 30 seconds the final segment and ENDLIST are published automatically; the playlist remains unchanged afterward.
- All 90 synthetic segments remain accessible; non-public paths return 404; expired sessions return 404.

## Scope

These are observations for this growing synthetic live fixture on the specified browser. Latest main, standalone Chrome, Firefox, Safari/native HLS and embedded devices were not tested. No application patch or production service is used.
