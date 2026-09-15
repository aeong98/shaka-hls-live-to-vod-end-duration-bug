# Shaka HLS live-to-VOD forward seek reproduction

A standalone reproduction of forward DVR seeks snapping back after an HLS broadcast ends in **unmodified Shaka Player 4.15.16**. Includes a **5.2.10** comparison page.

All media is generated locally from FFmpeg test patterns and a sine wave. No production code, media, service URLs, credentials, DRM, analytics or account integration is included.

## Run locally

Requires Node.js 22 or newer. FFmpeg is only needed to regenerate media; the generated 180-second stream is included.

```sh
npm ci
npm start
```

Open http://localhost:3000. To compare 5.2.10, use the link at the top of the page (`/?version=5`). Both packages are pinned and served locally; no runtime CDN requests are needed.

## Reproduce

1. Click **Start / reset**. The player loads at 30 seconds and stays paused. Allow the buffer to settle (about 10 seconds ahead).
2. Click **End broadcast**. The server appends `#EXT-X-ENDLIST` to that session's playlist, keeping all segments accessible.
3. Wait for **VOD transition detected**. The page checks both `isLive()` and `isInProgress()` because EVENT classification differs between Shaka versions, then waits for the seekable-range timer.
4. Click **Seek to 120s**. Compare the requested target and actual position in the event log.
5. Use **Copy diagnostics** to capture the browser user agent, configuration, session manifest URI and observations. If clipboard access is unavailable, copy the displayed environment and event log.

Expected: seeking to 120s succeeds because it is inside the final 180-second presentation.

The test deliberately keeps the playhead away from the final segments. It does not reload the player, force duration, patch Shaka or override MediaSource APIs.

## Observed results

See [VALIDATION.md](VALIDATION.md) for the tested environment and version comparison. These observations are specific to this synthetic fixture; they do not establish behavior on every browser or stream.

## Fixture and server

- 180 seconds of 320×180 H.264 video with AAC sine-wave audio, in 90 two-second MPEG-TS segments.
- An EVENT playlist exposes all pre-generated segments immediately. This isolates the ENDLIST transition; it does **not** simulate real-time segment growth.
- A random session ID isolates each visitor's end-broadcast action.
- Sessions expire after one hour or server restart. Click Start to create a new one.
- The in-memory session limit is 1,000. A single server instance is intended; no database is required.
- Only allowlisted frontend files, the two Shaka bundles and synthetic segments are served. The repository root, configuration and arbitrary paths are not served.
- HLS responses allow cross-origin playback for testing in external players. Anyone possessing a session URL can end that disposable test session.

Regenerate synthetic media:

```sh
npm run generate-media
```

## Validation

```sh
npm test
```

The server test checks independent sessions, exact ENDLIST-only transition, all 90 segment responses, and rejection of non-public file paths. Browser playback is checked separately as described above.

## Render deployment

[Deploy to Render](https://render.com/deploy?repo=https://github.com/aeong98/shaka-hls-live-to-vod-end-duration-bug)

Connect this repository to Render using the included `render.yaml`. It selects a **free Node web service**, runs `npm ci`, starts with `npm start`, and checks `/health`. The server listens on Render's `PORT` at `0.0.0.0`.

Use one instance because sessions live in process memory. Free-service restarts or idle suspension can invalidate sessions; start a new session after a restart. See [Render's Blueprint reference](https://render.com/docs/blueprint-spec) and [free service documentation](https://render.com/docs/free).

Share the deployed page URL in an upstream report. The manifest field displays a real, session-specific playable URI after Start. A session URI is temporary; the reproduction page is the durable entry point.

## Upstream report

[ISSUE_DRAFT.md](ISSUE_DRAFT.md) contains a draft to adapt to the [Shaka bug-report form](https://github.com/shaka-project/shaka-player/issues/new?template=bug.yaml). Replace deployment placeholders and verify required form fields before submitting. No upstream issue is submitted automatically.

## Third-party software

Shaka Player is distributed under Apache-2.0; npm packages retain upstream license notices. The repository contains original reproduction code and FFmpeg-generated synthetic media, not a vendored or modified Shaka distribution.
