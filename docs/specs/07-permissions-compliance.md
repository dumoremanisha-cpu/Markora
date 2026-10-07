# 07 — Manifest Permissions & Chrome Web Store Compliance

Source: `projectDetails.md` §42, §52. Cross-references
[`03-architecture.md`](./03-architecture.md) §6 and
[`04-security-privacy.md`](./04-security-privacy.md).

## 1. Principle

Every permission in `manifest.json` must be justified in this document **before**
it is added to the codebase. If a feature can be built with a narrower
permission, a user gesture (e.g. a file/folder picker), or an optional
permission requested at time of use, that approach wins over a broad
always-on permission.

## 2. Anticipated permissions and justification

| Permission | Why it's needed | Narrower alternative considered | Verdict |
|---|---|---|---|
| `storage` | Persist settings, recent documents, folder bookmarks, annotations locally | None — this *is* the narrow option (`chrome.storage.local`, not `sync`) | Required |
| `downloads` | Save HTML/DOCX exports and diagram/mind-map image exports to disk | Using an `<a download>` browser-native save avoids needing this permission for most export paths | Prefer `<a download>`; only request `downloads` if a specific export path genuinely requires the Downloads API (e.g. controlling the save location or filename in a way `<a download>` can't) |
| File URL access (`file:///*` — user-facing toggle, not a manifest permission) | Read local `.md` files directly from disk | None — this is inherently how `file://` access works in Chrome extensions | Required, but **must default to disabled** and clearly instruct the user how to enable it in `chrome://extensions` |
| Host permissions for known raw-Markdown hosts (`raw.githubusercontent.com`, GitLab/Bitbucket/Gitea raw paths) | Detect and fetch Markdown from these known-good sources without a blanket `*://*/*` grant | A content script matching only specific URL patterns, or `activeTab` + explicit user action | Prefer scoped `content_scripts.matches` patterns / `optional_host_permissions` requested contextually, over a permanent broad host permission |
| `activeTab` | Powers exactly one feature: the popup's **"Render this page as Markdown"** action, the on-demand fallback for Markdown served with no recognizable path suffix (`01-functional-requirements.md` §31, `03-architecture.md` §5). Grants access to the one tab the user clicked from, for that click only | N/A — this is already the minimal-footprint option for "act on demand"; the alternative (broad host permissions or `webRequest` sniffing) is what ADR-0001 §2 rejected | Required — and now actually exercised by a shipped feature (previously declared with no implementing feature, which would have failed §4's first checklist line) |
| `scripting` | Inject the existing detection/handoff content script into the tab that `activeTab` just granted access to. MV3 requires this API permission for `chrome.scripting.executeScript`; `activeTab` alone grants the *host* access but not the API | Declaring a broad static content script and gating it at runtime — rejected: that grants passive access to every page, the opposite of the intent | Required, scoped: `scripting` produces no install-time permission warning on its own and can only reach tabs the user has granted via `activeTab` |
| `commands` (keyboard shortcuts) | Register global shortcuts like theme toggle | None needed beyond this | Required only for shortcuts that must work via `chrome.commands`; in-page shortcuts (while the viewer has focus) need no extra permission |

### Recent-documents tracking (worked example of the minimization principle)

The naive way to populate "recent documents" for remote URLs would be a
`history` or broad `webNavigation` permission watching every page the user
visits. That's unjustifiably broad for a Markdown viewer. Per the observed
behavior of the parity target (confirmed via
`UI/Screenshot 2026-09-08 100240.png`, which shows the note *"Only URLs pasted
in the browser address bar are saved here"*), the required approach is:

- Only record a remote document in "recent documents" when the user explicitly
  navigates to it via the address bar (an omnibox-triggered navigation the
  extension is already involved in rendering) — not via passive, permission-
  hungry monitoring of all tab activity.
- Local files are tracked separately (they're already scoped to the file-URL
  permission the user granted) and shown in their own group in the UI.

This is the same `activeTab`/explicit-action pattern used elsewhere in this
table — a feature is scoped to only the interactions the user directly
initiates, not asked to remember everything.

### Amendments recorded against the table above

**1. `file:///*` host permission (ADR-0006).**
[`../adr/0006-viewer-surface-and-content-acquisition.md`](../adr/0006-viewer-surface-and-content-acquisition.md)
decides that the viewer is an extension page and that local auto-refresh
(F23, ADR-0001 Flow A) therefore re-reads the local file *from the viewer*.
That requires `"file:///*"` in `host_permissions` — inert unless the user has
enabled the "Allow access to file URLs" toggle already described in the table
above, which remains the real gate. The same ADR confirms that **no http(s)
host permission is required for any v1 feature**, because remote documents are
never re-fetched: the content script hands over text the browser already
loaded.

**2. `unlimitedStorage` (ADR-0004), proposed, not yet in the table.**
[`../adr/0004-storage-schema-and-quota.md`](../adr/0004-storage-schema-and-quota.md)
proposes adding **`unlimitedStorage` to `optional_permissions`** — never
statically declared, requested at runtime via `chrome.permissions.request()`
only after local storage usage crosses a warning threshold, with disclosure.
That ADR is Accepted and the implementation plan's permission matrix already
carries the row; this table is deliberately left unchanged until the
corresponding phase lands, so the amendment is recorded here as a pointer
rather than silently merged. It still owes the §3 four-question checklist at
the point it is actually added to `manifest.json`.

**3. PlantUML remote rendering (ADR-0002) — no permission added.**
Phase 3-B shipped the opt-in remote-diagram-rendering path for PlantUML (F14,
[`../adr/0002-diagram-rendering-strategy.md`](../adr/0002-diagram-rendering-strategy.md),
PlantUML section). It calls `fetch()` from the viewer extension page directly
to a user-configured server URL (`Settings.plantumlServerUrl`), and only when
the user has explicitly enabled `Settings.plantumlEnabled` — off by default.
Applying §3's four-question checklist:

1. **Why** — required because PlantUML has no viable offline, client-side
   renderer (the feasibility finding recorded in ADR-0002).
2. **Can it be avoided** — no; this is the documented v1 limitation, and the
   feature is opt-in precisely because of it.
3. **Narrower alternative** — a static `host_permissions` entry, or an
   `optional_host_permissions` entry requested at time of use, was considered
   and rejected. `fetch()` from an extension page to an arbitrary external
   origin does not require any `host_permissions` declaration at all: that
   permission exists to bypass a target server's own CORS response headers,
   not to make the request in the first place. A plain, uncredentialed
   cross-origin GET behaves exactly like a fetch from any ordinary webpage,
   gated by the target server's own CORS policy. Since the server URL is
   user-configurable and not known at build time, no manifest permission was
   added.
4. **Chrome Web Store scrutiny** — none expected beyond what the PlantUML
   opt-in disclosure itself already requires (shown in Settings → Privacy
   before the toggle can be enabled), since no new permission is being
   requested.

Net effect: **no change to `manifest.json`'s `permissions`,
`host_permissions`, or `optional_host_permissions`** for this feature.
Verified against `dist/manifest.json` after a production build. `PRIVACY.md`
(new this phase) and `SECURITY.md`'s Phase 3-B section document the same
fetch-isolation guarantee — the PlantUML adapter
(`src/viewer/diagrams/plantuml/`) is the only module in the product that ever
calls `fetch()`.

**4. Self-hosted Gitea raw Markdown (F88) — design note, nothing added.**
The §2 table's third row groups "GitLab/Bitbucket/Gitea raw paths" together,
but only the first two were shippable as static patterns.
[`../adr/0001-file-access-and-detection.md`](../adr/0001-file-access-and-detection.md)
§2 anticipated this with "`*/raw/*` for self-hosted Gitea patterns **where
identifiable**" — and at implementation time they were not identifiable:
`manifest.config.ts` enumerates `raw.githubusercontent.com`, `*.gitlab.io`,
`gitlab.com/*/-/raw/*` and `bitbucket.org/*/raw/*`, and records in a comment
that self-hosted Gitea has no fixed host. A bare `*://*/raw/*` pattern would
match every site on the internet with a `/raw/` path segment, which is a
blanket host grant wearing a disguise. Applying §3's checklist:

1. **Why** — to give self-hosted Gitea instances the same
   curated-host treatment as GitHub/GitLab/Bitbucket: auto-render of raw
   Markdown URLs whose path does not end in a Markdown suffix.
2. **Can it be avoided** — **largely yes, and it already is.** Gitea's raw
   URLs normally preserve the filename, so they end in `.md`/`.markdown`
   and are caught by the generic suffix patterns that already ship (F01/F04,
   and the audit's own #112 "Completed" finding). The residual gap is
   suffix-less raw URLs on an instance the user runs, which the popup's
   "Render this page as Markdown" action (`activeTab` + `scripting`, F04)
   already covers on demand without any new permission.
3. **Narrower alternative** — yes, and it is the only acceptable one:
   **`optional_host_permissions`, requested per instance at time of use**
   via `chrome.permissions.request()` when the user explicitly points
   Markora at their own Gitea origin (e.g. "Add this Gitea instance" from
   the popup while on that host), with the origin recorded in settings and
   revocable from the settings page. This matches the §1 preference order
   and ADR-0004's `unlimitedStorage` precedent (optional, contextual,
   disclosed) and is the exact opposite of a static broad match.
4. **Chrome Web Store scrutiny** — a static `*://*/raw/*` entry would very
   likely be flagged as broader than a Markdown viewer's single purpose and
   would trigger the "why do you need access to every site?" review path. A
   runtime-requested, user-named single origin carries no install-time
   warning and is self-evidently proportionate.

**Conclusion: no manifest change now.** F88 is recorded in the feature matrix
as *not scheduled* — the generic path already serves the common case, so the
optional-permission flow is only worth building if real demand appears. If it
is built, it is the §3-answered `optional_host_permissions` design above and
nothing broader; a static host pattern for Gitea is **rejected**, not
deferred. `manifest.json`'s `permissions`, `host_permissions` and
`optional_host_permissions` are unchanged by this note.

No permission for: browsing history, cookies, tabs (beyond `activeTab`),
bookmarks (Chrome's), geolocation, notifications-as-a-default, or any
analytics/telemetry SDK permission.

## 3. Decision checklist (apply to every permission before adding it)

1. **Why** is this permission needed — name the specific feature.
2. **Can it be avoided** entirely with a different implementation approach?
3. **Is there a narrower permission or API** (optional permissions, `activeTab`,
   a user-gesture-triggered picker) that covers the same need?
4. **Would Chrome Web Store review likely flag this** as broader than the
   extension's stated purpose justifies?

Document the answer to all four for any permission added during implementation,
in this file, before merging.

## 4. Chrome Web Store preparation checklist

- [ ] Manifest permissions list matches exactly what's justified in §2, no more.
- [ ] Privacy policy present and accurate (reflects
      [`04-security-privacy.md`](./04-security-privacy.md) — no data collection
      claims that aren't true).
- [ ] Store listing description accurately describes functionality without
      referencing or implying any relationship to MarkView.
- [ ] Icons/screenshots/branding are 100% original (see independence rules in
      [`00-overview.md`](./00-overview.md) §3).
- [ ] Single-purpose description is clear and matches the extension's actual
      behavior (Markdown viewing/rendering).
- [ ] No remote code execution (all JS ships inside the extension package; no
      `eval`/remote script loading) — required by MV3 policy in any case.
- [ ] File-URL access is off by default with clear, in-product instructions for
      enabling it.
- [ ] Optional/opt-in network feature (PlantUML remote rendering, if shipped) is
      clearly disclosed in both the settings UI and the store listing.

## 5. Browser compatibility note

Primary target is Google Chrome; the manifest and APIs used should also work
unmodified on Chromium-based browsers (Edge, Brave, Opera, Vivaldi) per
[`03-architecture.md`](./03-architecture.md) §7. Avoid Chrome-only APIs unless
a permission/API has no cross-Chromium equivalent — document any such exception
here if one becomes necessary during implementation.
