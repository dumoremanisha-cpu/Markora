// External help/feedback/store destinations (F57/F58). Deliberately left
// unset (`''`) until Markora actually has a public issue tracker and a live
// Chrome Web Store listing to point to — wiring a placeholder or invented
// URL here would render a real-looking outbound link that goes nowhere (or
// worse, somewhere unintended), which is worse than the feature being
// visibly present-but-inert. Fill these in as part of the real Chrome Web
// Store submission (docs/specs/07-permissions-compliance.md §4), never
// speculatively — see "Known limitations" in RELEASE.md. Until set, the
// popup/settings UI still renders the buttons (so the feature itself is
// built and reviewable, matching F57/F58's requirement) but disables them.
export const FEATURE_REQUEST_URL = '';
export const REPORT_ISSUE_URL = '';
export const RATE_EXTENSION_URL = '';
