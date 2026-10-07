// MV3 service worker: messaging, file-open orchestration, permission
// helpers, chrome.commands handling. No business logic here (code-conventions.md §3).
// Handles exactly the two message types ADR-0006 §7 allows from content
// scripts — 'handoff/create' and 'detection/ping' — nothing wider.
import { createHandoff, sweepExpiredHandoffs } from '../storage/handoff';
import { getSettings, setSettings } from '../storage';
import { THEME_CYCLE } from '../storage/schema';

// TTL sweep at service-worker start-up (ADR-0006 §2).
void sweepExpiredHandoffs();

// Phase 10 (F45) — first-run onboarding, opened once on a fresh install
// only (never on an update/reload). chrome.tabs.create needs no permission
// beyond what's already declared (07-permissions-compliance.md).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  void chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
});

// The one chrome.commands global shortcut (manifest.config.ts, Phase 2-B
// task 9) — flips the persisted theme; every open viewer/popup picks up the
// change via the existing storage.onChanged subscription in utils/theme.ts,
// no messaging needed (code-conventions.md §3: background stays routing-only).
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-theme') return;
  void (async () => {
    const settings = await getSettings();
    const next =
      THEME_CYCLE[(THEME_CYCLE.indexOf(settings.theme) + 1) % THEME_CYCLE.length] ?? 'system';
    await setSettings({ theme: next });
  })();
});

interface HandoffCreateMessage {
  type: 'handoff/create';
  url: string;
  text: string;
  hints: { addressBarEntered: boolean };
}

interface DetectionPingMessage {
  type: 'detection/ping';
}

/** Phase 4 task 14 (ADR-0004 quota strategy) — `chrome.permissions.request()` needs a user gesture, and per `03-architecture.md` §8 "permission helpers" is a legitimate background responsibility; the caller (Settings → Maintenance) only reaches this after the user explicitly consents to a shown prompt, never speculatively. */
interface RequestUnlimitedStorageMessage {
  type: 'permissions/requestUnlimitedStorage';
}

type IncomingMessage = HandoffCreateMessage | DetectionPingMessage | RequestUnlimitedStorageMessage;

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  if (message?.type === 'handoff/create') {
    createHandoff(message.url, message.text, message.hints)
      .then((token) => sendResponse({ token }))
      .catch(() => sendResponse(undefined));
    return true;
  }
  if (message?.type === 'detection/ping') {
    getSettings()
      .then((settings) => sendResponse({ enabled: settings.extensionEnabled }))
      .catch(() => sendResponse({ enabled: false }));
    return true;
  }
  if (message?.type === 'permissions/requestUnlimitedStorage') {
    chrome.permissions
      .request({ permissions: ['unlimitedStorage'] })
      .then((granted) => sendResponse({ granted }))
      .catch(() => sendResponse({ granted: false }));
    return true;
  }
  return undefined;
});
