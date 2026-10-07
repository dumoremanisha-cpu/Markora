# ADR-0007: Internationalization Architecture

- Status: Accepted
- Date: 2026-09-08
- Related: `docs/specs/01-functional-requirements.md` §28, §31, §32;
  `docs/specs/05-ux-i18n-accessibility.md` §5, §6;
  `docs/specs/07-permissions-compliance.md` §4;
  `docs/specs/08-glossary-references.md` §3; feature matrix F37, F36, F44, F81

## Context

`01-functional-requirements.md` §28 and `05-ux-i18n-accessibility.md` §5 both
require that **no user-facing string is hardcoded, starting from the first
line of UI code**, that 19 locales ship, that a new locale is a file rather
than a code change, and that the language selector includes an **"Auto"**
option — with changes applying **live, without a reload** (F81).

Chrome offers a built-in mechanism, `chrome.i18n` + `_locales/`, and it is the
obvious first answer. It cannot satisfy this spec on its own:

- `chrome.i18n.getMessage()` resolves against the **browser UI locale**, fixed
  at browser start. There is no API to switch locale at runtime, so an
  in-product language selector (let alone live switching) is impossible with
  it.
- Conversely, `_locales/` is the **only** mechanism that can localize the
  manifest's `name`, `description` and `action.default_title` — i.e. the
  strings the Chrome Web Store listing and the browser's own UI display.
  A custom runtime catalog cannot reach them.

So neither mechanism alone works, and this had to be decided before Phase 1
rather than discovered during it: the implementation plan as originally
drafted deferred all i18n to Phase 8 and explicitly planned to *retrofit*
hardcoded English strings from Phases 1–7 — a direct contradiction of the two
spec sections above, and a guaranteed wide-blast-radius rework pass.

## Decision

### 1. Hybrid: `_locales` for Chrome-owned metadata, a runtime catalog for the UI

| String class | Mechanism | Switchable at runtime? |
|---|---|---|
| Manifest `name`, `description`, `action.default_title`, and any other manifest-declared string | `_locales/<locale>/messages.json` + `__MSG_key__` substitution, `default_locale: "en"` | No — follows browser UI locale (acceptable; these are Chrome-chrome, not app UI) |
| Every string rendered by Markora's own UI (viewer, toolbar, popup, options, onboarding, error/notification text, GitHub-alert titles per F44) | Custom catalog: `src/i18n/locales/<locale>.json`, loaded at runtime | **Yes** — instantly, per F81 |

The `_locales` surface is deliberately tiny (a handful of keys) so the
duplication between the two systems stays trivial. A build-time check asserts
that every key in `_locales/en/messages.json` has a matching entry in the
English runtime catalog, so the two can never drift into saying different
things about the product.

### 2. Runtime catalog format and API

- One flat JSON file per locale, bundled in the extension package and loaded
  with `fetch(chrome.runtime.getURL('i18n/<locale>.json'))` — **never** from a
  network origin (`04-security-privacy.md` §1's local-only guarantee applies
  to translations exactly as it does to fonts).
- Keys are namespaced `area.component.element`, e.g.
  `settings.appearance.fontSize.label`, `alert.warning.title`,
  `notification.export.complete`. English catalog is the canonical key list.
- A single `t(key, params?)` accessor with named placeholder interpolation
  (`"Exported {count} images"`), plus a minimal plural-select helper. No ICU
  MessageFormat dependency — the string set is UI chrome, not prose, and a
  full ICU runtime is not worth the bundle cost.
- Placeholder values are always inserted as **text nodes / escaped text**,
  never as HTML, so a translated string can never introduce markup.
- **Missing key behaviour:** fall back to the English catalog entry; if the key
  is absent there too, render the key's last segment and log a development
  warning. Never render an empty string, and never render the raw dotted key
  in production UI.
- Only English is bundled in the initial chunk; other locales are lazy-loaded
  on selection (relevant to the bundle-size concern noted in the audit —
  19 catalogs must not all load at start-up).

### 3. Locale resolution, including "Auto"

The stored setting is `language: "auto" | <locale-tag>` (ADR-0004 `Settings`).

```
resolve(setting):
  requested = setting === "auto"
      ? [chrome.i18n.getUILanguage(), ...navigator.languages]
      : [setting]
  for tag in requested:
      exact match  -> use it            (e.g. "pt-BR")
      base match   -> use base          ("pt-PT" -> "pt", "zh-HK" -> "zh-TW" via explicit alias map)
  fallback -> "en"
```

Chinese needs an explicit alias map (`zh`, `zh-CN`, `zh-Hans` →
Simplified; `zh-TW`, `zh-HK`, `zh-Hant` → Traditional) because base-tag
truncation gives the wrong answer for Traditional users. "Auto" appears in
both the popup quick-settings and the options page, per
`01-functional-requirements.md` §28/§31.

### 4. Live switching (F81) and direction

- Changing the language: load the new catalog → swap the active catalog →
  dispatch an internal `i18n:changed` event. Every UI surface subscribes and
  re-renders its own strings; no page reload, no viewer re-parse of the
  document (the Markdown pipeline is entirely unaffected by UI language).
- Switching to an RTL locale (Arabic, Persian, Urdu, Hebrew) sets
  `dir="rtl"` on the **application chrome root** only. **Document content
  direction remains per-block and independent of UI language**, per
  `05-ux-i18n-accessibility.md` §6 — an English UI reading an Arabic document
  and an Arabic UI reading an English document must both be correct.
- Settings changed in the options page propagate to every open viewer tab and
  the popup via a `chrome.storage.onChanged` subscription (the same mechanism
  every other live-applied setting uses).

### 5. Phasing (this is the part that resolves the plan conflict)

- **Phase 1** ships the i18n *system*: `src/i18n/` loader, `t()`, the key
  convention, the English catalog, `_locales/en/messages.json` with the
  manifest substitutions, and the lint rule below. Every phase from 1 onward
  writes `t('…')` from its first commit.
- **Phase 8** ships the other 18 locales, the "Auto" resolution logic, live
  switching, the Chinese alias map, and the RTL surface sweep.

There is **no retrofit pass**: Phases 1–7 add keys to the English catalog as
they build UI, and Phase 8 translates a complete, already-extracted key set
instead of hunting for string literals across the codebase.

### 6. Enforcement

An ESLint rule (`no-literal-user-strings` or equivalent: forbid non-empty
string literals reaching DOM text/`textContent`/`aria-label`/`title`/`alt`
sinks in UI modules) is configured in **Phase 1** and enforced from then on.
Phase 8's "raw-string-literal audit" therefore becomes a confirmation that a
rule already in force was never violated, rather than a discovery exercise.

## Consequences

- Two catalogs exist (one tiny `_locales` set, one full runtime set). Accepted:
  it is the only combination that gets both a localized store listing and
  runtime language switching, and a build check keeps them consistent.
- Phase 1 grows slightly (loader + `t()` + English catalog + lint rule —
  small, mechanical work), and Phase 8 shrinks by an entire retrofit pass.
  Net effort is lower and the risk of a missed string is far lower.
- Every phase's definition of done now implicitly includes "strings are in the
  catalog," enforced by lint rather than by review discipline.
- Translation quality for machine-assisted locales remains a documented v1
  limitation (unchanged from the plan's Phase 8 note) — this ADR changes
  *when* strings are extracted, not how they are translated.
- `chrome.i18n.getUILanguage()` is used only as an input to "Auto" resolution,
  so no Chrome-only behaviour is relied on beyond what every Chromium browser
  implements identically (F53).

## Alternatives considered

- **`chrome.i18n` / `_locales` only**: rejected — cannot switch language at
  runtime, so the required in-product language selector (F37, screenshot-
  confirmed in `08-glossary-references.md` §4) and live-apply (F81) are both
  impossible. Would also force a browser restart to change language.
- **Custom runtime catalog only**: rejected — leaves the manifest name and
  description (and therefore the Chrome Web Store listing and the browser's
  extension UI) English-only for all 19 target audiences.
- **A third-party i18n framework (i18next or similar)**: rejected — the
  feature set actually needed here is "load a JSON map, interpolate named
  placeholders, swap at runtime, fall back to English." A framework adds
  bundle weight and an update surface for behaviour implementable in well
  under 200 lines, in a product whose stack is deliberately dependency-light
  (`03-architecture.md` §1).
- **Deferring all i18n to Phase 8 with a retrofit** (the plan's original
  shape): rejected — it contradicts `01-functional-requirements.md` §28 and
  `05-ux-i18n-accessibility.md` §5 verbatim, and converts a mechanical
  Phase-1 setup into a codebase-wide sweep with no mechanical guarantee of
  completeness.
