# HLS live-to-VOD transition: forward DVR seek snaps back while video.duration remains Infinity (4.15.16 and 5.2.10)

Draft only. Use the upstream bug-report form and fill in all required confirmations yourself.

## Versions and environment

- Shaka 4.15.16: reproduced with the unmodified npm release.
- Shaka 5.2.10: reproduced with the unmodified npm release and the same growing live fixture.
- Latest main: not tested.
- Custom minimal app, macOS 26.5.2, in-app Chromium reporting Chrome/152.0.0.0.
- No DRM / FairPlay: not applicable.

## Reproduction

Repository: https://github.com/aeong98/shaka-hls-live-to-vod-end-duration-bug

Hosted reproduction page: https://shaka-hls-live-to-vod-end-duration-bug.onrender.com/

1. Open the reproduction page using the default Shaka 4.15.16 version.
2. Click Start / reset. It joins a synthetic live HLS stream with 150s of DVR history at 30s and pauses with about 10s of buffer ahead. The served playlist has no EXT-X-PLAYLIST-TYPE tag.
3. Observe the playlist grow by one 2s segment every 2s. Click End broadcast before the fixture automatically ends after 30s of wall-clock time. The same session freezes its published segment count and adds EXT-X-ENDLIST.
4. Wait for VOD transition detected. The player is not reloaded.
5. Click Seek to 120s, which is inside player.seekRange() but outside video.buffered.
6. Inspect the event log or click Copy diagnostics.

The page exposes a session-specific playable manifest URI. Sessions expire after one hour or a server restart; start a new session if needed. Only the currently published segments are referenced in each playlist. The final length is determined by the end-broadcast time (or the 180s fixture limit). Media bytes are synthetic and pre-generated.

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

With both 4.15.16 and 5.2.10, after ENDLIST is processed:

- player.isLive() and player.isInProgress() are false.
- Both broadcasts ended at 168s, and player.seekRange() was 18–168s.
- video.duration remains Infinity.
- video.seekable ends at 41.989333s (4.15.16) or 40.012667s (5.2.10), matching the respective buffered ends.
- Requesting video.currentTime = 120 is clamped to 41.989333s (4.15.16) or 40.012667s (5.2.10).

See VALIDATION.md for the observed comparison and environment limits.

## Suspected cause

The v4.15.16 HLS parser finalizes the internal presentation duration on ENDLIST, while the media-source duration can remain Infinity. StreamingEngine's live-seekable-range timer clears the live seekable range once the presentation is no longer live. The browser then exposes a shorter seekable range based on buffered content.

Related upstream context:

- https://github.com/shaka-project/shaka-player/issues/9051
- https://github.com/shaka-project/shaka-player/pull/9054
- https://github.com/shaka-project/shaka-player/pull/9153

Would keeping the final HLS seekable range while the internal duration is finite but the MSE duration remains Infinity be an appropriate approach for the affected branches?

## Before submitting

- Attach fresh copied diagnostics if needed. The free host may take 50 seconds or longer to wake from inactivity.
- Confirm the FAQ/duplicate-search checkboxes after reviewing them.
- State whether you intend to submit a PR.
- Do not claim this reproduces on main or on every browser.
