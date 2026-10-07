// Shared message contract between the popup's "Active Document" card
// (`new_ui/extension_popup.png`, popup Quick Controls) and the viewer tab it
// asks for real state — single source of truth for both sides so they can't
// drift, same pattern as `shortcutDefinitions.ts`. The popup queries an
// already-open viewer tab directly via `chrome.tabs.sendMessage`; this never
// goes through the background service worker (code-conventions.md §3 keeps
// business logic out of it, and this is page-to-page state, not routing).
export const GET_ACTIVE_DOCUMENT_MESSAGE = 'popup/getActiveDocument';

/**
 * Popup's "Open Full Settings" action (`new_ui/fullsetting.png`), sent via
 * `chrome.tabs.sendMessage` to a specific already-open viewer tab (found via
 * `GET_ACTIVE_DOCUMENT_MESSAGE`'s `tabId`) once the popup has focused it —
 * asks that tab to open its own in-page Preferences dialog (the exact
 * floating-dialog-over-the-document surface the mockup shows) instead of
 * falling back to the separate `chrome.runtime.openOptionsPage()` tab, which
 * is a plain full-page layout that never matches the mockup. Only used when
 * a viewer tab already exists; with none open there is no document for the
 * dialog to float over, so the options page remains the fallback.
 */
export const OPEN_PREFERENCES_MESSAGE = 'popup/openPreferences';

export interface ActiveDocumentInfo {
  open: boolean;
  /** Present only when `open` is true. */
  sourceLabel?: string;
  byteSize?: number;
  /** True when the document has a live auto-refresh source (file handle or watched file: URL) — "Synced Local" in the mockup. */
  synced?: boolean;
  /**
   * The responding viewer tab's own identity, from `chrome.tabs.getCurrent()`
   * inside the viewer itself. This project deliberately never requests the
   * `tabs` permission (permissions.md rule 4), which means
   * `chrome.tabs.query({ url })` silently returns nothing for tabs the
   * extension can't already see — a real, confirmed bug this bridge fixes:
   * the only permission-free way to learn a tab's id/window is to ask the
   * tab to report its own via a `chrome.runtime.sendMessage` broadcast
   * (which every extension page receives, no permission needed), never a
   * targeted `chrome.tabs.sendMessage` requiring a pre-discovered tab id.
   */
  tabId?: number;
  windowId?: number;
}
