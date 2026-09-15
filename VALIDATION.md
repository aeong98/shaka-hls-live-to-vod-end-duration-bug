# Validation record

Date: 2026-09-15

## Environment

- macOS 26.5.2
- Codex in-app Chromium browser; reported user agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36`
- Local Node server, synthetic EVENT HLS fixture, MSE playback
- Shaka releases installed unchanged from the public npm registry
- Explicit streaming configuration: `bufferingGoal: 10`, `rebufferingGoal: 2`, `bufferBehind: 10`, `preferNativeHls: false`

The macOS version reported in the user agent is reduced and does not identify the actual OS version.

## Observations

Both players were loaded at 30 seconds and paused before ENDLIST was added.

| Observation | 4.15.16 | 5.2.10 |
| --- | --- | --- |
| Before ENDLIST: isLive / isInProgress | true / false | false / true |
| Before ENDLIST: video.duration | Infinity | 180 |
| After ENDLIST: isLive / isInProgress | false / false | false / false |
| Final player.seekRange | 0–180 | 0–180 |
| After ENDLIST: video.duration | Infinity | 180 |
| Before seek: video.seekable | 0–41.989333 | 0–180 |
| Before seek: video.buffered | 30–41.989333 | 28.084334–40.012667 |
| Requested seek | 120 | 120 |
| Actual time after 2s | 41.989333 (failed) | 120 (succeeded) |

4.15.16's final range remains available to Shaka while the browser exposes only the buffered end. 5.2.10 treats this EVENT fixture as an in-progress finite-duration presentation from the start. Therefore the version comparison also exercises different timeline classification; it is not evidence that every kind of live HLS transition is fixed in 5.2.10.

## Automated server check

`npm test` passed: isolated sessions; 90 accessible segments; exact ENDLIST-only mutation; non-public paths return 404.

## Scope

Latest main, standalone Chrome, Firefox, Safari/native HLS and embedded devices were not tested. There is no production media, service dependency or application patch in this reproduction.
