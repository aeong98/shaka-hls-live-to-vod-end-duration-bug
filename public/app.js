/* Standalone repro using unmodified public Shaka releases. */
const $ = (id) => document.getElementById(id);
const video = $('video');
const entries = [];
let player, session, ending = false, transitioned = false, busy = false, generation = 0, broadcast, polling = false;
const ranges = (r) => Array.from({ length: r.length }, (_, i) => [r.start(i), r.end(i)]);
const stringify = (v) => JSON.stringify(v, (_, x) => typeof x === 'number' && !Number.isFinite(x) ? String(x) : x, 2);
function snapshot() {
  return { version: window.shaka?.Player.version, isLive: player?.isLive(), isInProgress: player?.isInProgress(),
    broadcast, duration: video.duration, currentTime: video.currentTime,
    seekRange: player?.seekRange(), seekable: ranges(video.seekable), buffered: ranges(video.buffered),
    paused: video.paused, readyState: video.readyState };
}
function record(event, detail = {}) {
  entries.push({ event, time: new Date().toISOString(), ...snapshot(), ...detail });
  if (entries.length > 150) entries.shift();
  $('log').textContent = stringify(entries);
}
function fail(e) { $('status').textContent = `Error: ${e.message || e.code || e}`; record('error', { message: String(e) }); }
async function api(path) {
  const response = await fetch(path, { method: 'POST' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}
$('start').onclick = async () => {
  if (busy) return;
  generation++;
  busy = true; $('start').disabled = true; $('end').disabled = true; $('seek').disabled = true;
  try {
    ending = false; transitioned = false; broadcast = undefined;
    if (player) { await player.destroy(); player = undefined; }
    entries.length = 0;
    session = await api('/api/sessions');
    $('manifest').value = new URL(session.manifest, location.origin).href;
    player = new shaka.Player();
    await player.attach(video);
    if (!player.configure({ streaming: { bufferingGoal: 10, rebufferingGoal: 2,
      bufferBehind: 10, preferNativeHls: false } })) throw new Error('Invalid player configuration');
    player.addEventListener('error', (e) => fail(e.detail));
    await player.load(session.manifest, 30);
    video.pause();
    record('loaded');
    $('environment').textContent = stringify({ userAgent: navigator.userAgent, configuration: player.getNonDefaultConfiguration() });
    $('status').textContent = `Shaka ${shaka.Player.version}: live session ready. Watch the playlist grow, then end broadcast.`;
    $('end').disabled = false;
  } catch (e) { fail(e); } finally { busy = false; $('start').disabled = false; }
};
$('end').onclick = async () => {
  try {
    broadcast = await api(`/session/${session.id}/end`);
    ending = true; $('end').disabled = true;
    record('ENDLIST requested');
    $('status').textContent = 'Waiting for Shaka to process ENDLIST…';
  } catch (e) { fail(e); }
};
$('seek').onclick = () => {
  const range = player.seekRange();
  if (120 <= range.start || 120 >= range.end || ranges(video.buffered).some(([start, end]) => start <= 120 && end >= 120)) {
    $('status').textContent = 'Test precondition not met: 120s must be inside the final range and outside the buffer. Start a new session.';
    return;
  }
  record('seek requested', { target: 120 });
  const currentGeneration = generation;
  video.currentTime = 120;
  setTimeout(() => {
    if (currentGeneration !== generation) return;
    record('seek result after 2s', { target: 120 });
    $('status').textContent = Math.abs(video.currentTime - 120) < 2
      ? 'Seek reached 120s in this environment. Inspect the transition log for range changes.'
      : `Seek did not reach 120s; actual time: ${video.currentTime.toFixed(3)}s. Copy diagnostics.`;
  }, 2000);
};
$('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(stringify({ userAgent: navigator.userAgent,
      manifest: $('manifest').value, configuration: player?.getNonDefaultConfiguration(), entries }));
    $('status').textContent = 'Diagnostics copied.';
  } catch { $('status').textContent = 'Clipboard unavailable. Select and copy the event log below.'; }
};
for (const event of ['seeking', 'seeked', 'durationchange', 'ended']) video.addEventListener(event, () => record(event));
setInterval(() => {
  $('state').textContent = stringify(snapshot());
  if (ending && player && !player.isLive() && !player.isInProgress() && !transitioned) {
    transitioned = true;
    const currentGeneration = generation;
    // Allow the live seekable range timer to run before enabling the test.
    setTimeout(() => {
      if (!ending || currentGeneration !== generation) return;
      record('VOD transition settled'); $('seek').disabled = false;
      $('status').textContent = 'VOD transition detected. Seek to 120s now.';
    }, 2500);
  }
}, 500);
setInterval(async () => {
  if (!session || busy || polling) return;
  polling = true;
  const currentGeneration = generation;
  try {
    const response = await fetch(`/session/${session.id}/state`);
    if (!response.ok) throw new Error('Session expired; click Start');
    const next = await response.json();
    if (currentGeneration !== generation) return;
    const changed = next.count !== broadcast?.count || next.ended !== broadcast?.ended;
    broadcast = next;
    if (changed) record('playlist publication');
    if (next.ended) { ending = true; $('end').disabled = true; }
  } catch (e) { if (currentGeneration === generation) fail(e); }
  finally { polling = false; }
}, 1000);
$('start').disabled = true;
const script = document.createElement('script');
script.src = new URLSearchParams(location.search).get('version') === '5' ? '/shaka-5.js' : '/shaka-4.js';
script.onload = () => { shaka.polyfill.installAll(); $('start').disabled = !shaka.Player.isBrowserSupported(); $('status').textContent = `Ready: Shaka ${shaka.Player.version}`; };
script.onerror = () => fail(new Error('Unable to load Shaka; run npm ci'));
document.head.append(script);
