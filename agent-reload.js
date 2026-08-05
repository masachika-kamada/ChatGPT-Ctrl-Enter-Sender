const EXTENSION = 'chatgpt-sender';
const PORT = 18792;
const BASE_URL = `http://127.0.0.1:${PORT}/v1/extension-reload`;
const ALARM = 'agent-extension-reload';
let checkInFlight = false;

async function readBuild() {
  const response = await fetch(`${chrome.runtime.getURL('agent-build.json')}?t=${Date.now()}`, {
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`agent-build.json: ${response.status}`);
  return response.json();
}

async function sendAck(phase, command, buildId) {
  const manifest = chrome.runtime.getManifest();
  const response = await fetch(`${BASE_URL}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      extension: EXTENSION,
      requestId: command.requestId,
      phase,
      version: manifest.version,
      buildId,
      extensionId: chrome.runtime.id
    })
  });
  if (!response.ok) throw new Error(`reload ack failed: ${response.status}`);
}

async function checkForReload() {
  if (checkInFlight) return;
  checkInFlight = true;
  try {
    const response = await fetch(`${BASE_URL}?extension=${encodeURIComponent(EXTENSION)}`, {
      cache: 'no-store'
    });
    if (!response.ok) return;
    const command = await response.json();
    if (command.command !== 'reload' && command.command !== 'verify_loaded') return;

    const manifest = chrome.runtime.getManifest();
    const build = await readBuild();
    if (command.expectedVersion !== manifest.version || command.expectedBuildId !== build.buildId) return;

    if (command.command === 'verify_loaded') {
      await sendAck('loaded', command, build.buildId);
      return;
    }

    await sendAck('reloading', command, build.buildId);
    chrome.runtime.reload();
  } catch (_error) {
    // The loopback development server is normally absent during regular use.
  } finally {
    checkInFlight = false;
  }
}

chrome.alarms.create(ALARM, { delayInMinutes: 0.5, periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void checkForReload();
});
chrome.runtime.onStartup.addListener(() => void checkForReload());
chrome.runtime.onInstalled.addListener(() => void checkForReload());
void checkForReload();
setTimeout(() => void checkForReload(), 5000);
setTimeout(() => void checkForReload(), 10000);
