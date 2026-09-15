# HLS live-to-VOD transition: forward DVR seek snaps back while video.duration remains Infinity (4.15.16)

Draft only. Use the upstream bug-report form and fill in all required confirmations yourself.

## Versions and environment

- Shaka 4.15.16: reproduced with the unmodified npm release.
- Shaka 5.2.10: comparison results in VALIDATION.md; this EVENT fixture has a finite duration from initial load in that version.
- Latest main: not tested.
- Custom minimal app, macOS 26.5.2, in-app Chromium reporting Chrome/152.0.0.0.
- No DRM / FairPlay: not applicable.

## Reproduction

Repository: https://github.com/aeong98/shaka-hls-live-to-vod-end-duration-bug

Hosted reproduction page: [fill after Render deployment]

1. Open the reproduction page using the default Shaka 4.15.16 version.
2. Click Start / reset. It loads a 180-second synthetic HLS EVENT playlist at 30s and pauses with about 10s of buffer ahead.
3. Click End broadcast. The same session's playlist gains EXT-X-ENDLIST, without changing or removing segments.
4. Wait for VOD transition detected. The player is not reloaded.
5. Click Seek to 120s, which is inside player.seekRange() but outside video.buffered.
6. Inspect the event log or click Copy diagnostics.

The page exposes a session-specific playable manifest URI. Sessions expire after one hour or a server restart; start a new session if needed. The fixture exposes all generated segments immediately and isolates the ENDLIST transition, rather than simulating real-time segment growth.

Configuration:

```js
player.configure({
  streaming: {
    bufferingGoal: 10,
    rebufferingGoal: 2,
    bufferBehind: 10,
    preferNativeHls: false,
  },
});
```

## Expected

Seeking to an available, unbuffered target inside the final presentation range should reach the requested target after the broadcast ends, including while the MSE duration remains Infinity.

## Actual

With 4.15.16, after ENDLIST is processed:

- player.isLive() and player.isInProgress() are false.
- player.seekRange() is 0–180 seconds.
- video.duration remains Infinity.
- video.seekable ends at 41.989333s, matching the buffered end.
- Requesting video.currentTime = 120 is immediately clamped to 41.989333s.

See VALIDATION.md for the observed comparison and environment limits.

## Suspected cause

The v4.15.16 HLS parser finalizes the internal presentation duration on ENDLIST, while the media-source duration can remain Infinity. StreamingEngine's live-seekable-range timer clears the live seekable range once the presentation is no longer live. The browser then exposes a shorter seekable range based on buffered content.

Related upstream context:

- https://github.com/shaka-project/shaka-player/issues/9051
- https://github.com/shaka-project/shaka-player/pull/9054
- https://github.com/shaka-project/shaka-player/pull/9153

Would keeping the final HLS seekable range while the internal duration is finite but the MSE duration remains Infinity be appropriate for the 4.15 branch?

## Before submitting

- Add the deployed page URL and attach fresh copied diagnostics if needed.
- Confirm the FAQ/duplicate-search checkboxes after reviewing them.
- State whether you intend to submit a PR.
- Do not claim this reproduces on main or on every browser.
