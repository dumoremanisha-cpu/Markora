// Content script: detection + handoff only. Never a fetcher of remote
// content, never a second rendering implementation (code-conventions.md §3).
// Sends exactly two message types to the background service worker —
// 'detection/ping' and 'handoff/create' — nothing wider (ADR-0006 §7).
import {
  isMatchedFileUrl,
  isMatchedRemoteUrl,
  looksLikeOnDemandCandidate,
  looksLikeRawTextDocument,
} from './detect';

declare global {
  interface Window {
    /** Set by the popup (via an inline chrome.scripting.executeScript call) immediately before injecting this file on demand — see popup/index.ts's renderActiveTabAsMarkdown(). Never set for the passive, manifest-declared injection. */
    __markoraOnDemandRender?: boolean;
  }
}

function computeAddressBarEntered(): boolean {
  const navEntry = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  return document.referrer === '' && navEntry?.type === 'navigate';
}

function readDocumentText(): string {
  const pre = document.querySelector('pre');
  return pre ? pre.innerText : document.body.innerText;
}

async function main(): Promise<void> {
  const onDemand = window.__markoraOnDemandRender === true;

  // The on-demand gate is only a safety net here — the popup already ran
  // the same predicate (via a separate, message-free probe injection)
  // before ever injecting this file, and only proceeds when it passed. No
  // new message type is introduced for the decline case: ADR-0006 §7 fixes
  // this content script's message contract to exactly 'detection/ping' and
  // 'handoff/create', so an on-demand decline is communicated to the popup
  // structurally (the probe's own return value), never over chrome.runtime.
  if (onDemand) {
    if (!looksLikeOnDemandCandidate(document)) return;
  } else {
    const url = new URL(location.href);
    const matched = isMatchedFileUrl(url) || isMatchedRemoteUrl(url);
    if (!matched) return;
    if (!looksLikeRawTextDocument(document)) return;
  }

  const pingResponse = (await chrome.runtime
    .sendMessage({ type: 'detection/ping' })
    .catch(() => undefined)) as { enabled: boolean } | undefined;
  if (!pingResponse?.enabled) return;

  const text = readDocumentText();
  const hints = { addressBarEntered: computeAddressBarEntered() };

  const handoffResponse = (await chrome.runtime
    .sendMessage({ type: 'handoff/create', url: location.href, text, hints })
    .catch(() => undefined)) as { token: string } | undefined;
  if (!handoffResponse?.token) return;

  const urlWithoutHash = location.href.slice(0, location.href.length - location.hash.length);
  const dest =
    chrome.runtime.getURL('src/viewer/index.html') +
    '?src=' +
    encodeURIComponent(urlWithoutHash) +
    '&h=' +
    handoffResponse.token +
    location.hash;
  location.replace(dest);
}

void main();
