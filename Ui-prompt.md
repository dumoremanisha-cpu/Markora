Create the complete high-fidelity UI system for “Markora,” an original, premium Chrome extension for viewing and working with Markdown documents.

Use the attached Markview reference only as visual inspiration for its calm, dense, developer-focused Markdown reading experience. Do not copy Markview branding, logo, exact layout, text, icons, or assets. Markora must look like its own product.

Product context:
Markora opens local and online Markdown documents in a dedicated browser viewer. It supports Markdown preview, syntax-highlighted code, tables, Mermaid and Graphviz diagrams, KaTeX math, a table of contents, search, folder browsing, bookmarks, annotations, reading progress, document statistics, presentation mode, mind-map mode, raw Markdown mode, and exports.

Design direction:
- Premium developer tool; minimal, quiet, capable, polished.
- Dark theme first, plus a matching light theme.
- Chrome extension / desktop web-app aesthetic, not a marketing website.
- Clean typography with generous readability in the document itself and compact density in controls.
- Restrained blue accent, charcoal/slate neutral palette, subtle surface elevation, 1px soft borders, 6–8px corner radius.
- Use familiar document, folder, search, export, settings, play, mind-map, annotation, theme, and overflow icons.
- Avoid gradients, oversized rounded cards, glassmorphism, excessive shadows, or colorful dashboard visuals.
- Strong accessibility: visible focus styles, high contrast, readable labels, keyboard-friendly controls, clear selected/hover/disabled/loading/error states.
- Design must work well from 1024px desktop width down to a narrow browser window. Side panels collapse into drawers on smaller widths.

Create these connected screens and states:

1. Main Markdown viewer — primary desktop screen
- A slim sticky top toolbar.
- Left side: Markora logo/wordmark, back and forward controls.
- Center/primary actions: file browser, table of contents, find in document, rendered/raw toggle, theme, text direction.
- Secondary actions: presentation mode, mind map, annotations, export dropdown, keyboard shortcuts, settings.
- Use icon-first controls with tooltips; show text labels only where helpful.
- Below toolbar, a 3-column layout:
  - Optional left folder browser.
  - Main Markdown reading canvas.
  - Optional right outline / table-of-contents panel.
- Main content example should show a realistic technical README:
  - document title “Markora Architecture”
  - metadata/source path line
  - headings, paragraphs, callout, task list, table, code block with language and Copy button, Mermaid diagram, math equation, image, blockquote, links.
- Include a thin reading-progress bar at the top edge.
- Add a subtle floating document-stat chip near the lower corner: “1,248 words · 6 min read · 8,420 characters”.
- Make the Markdown canvas the visual focus: comfortable max line width, excellent heading scale, readable code and table styles.

2. Folder browser panel
- Collapsible left panel titled “Files”.
- Folder name, open-folder button, bookmark toggle, file-type filter, search field.
- “Bookmarked folders” section.
- Hierarchical file tree with folders, Markdown files, active-file state, hover state, unreadable/permission-needed state.
- Reconnect-folder banner state for a previously opened folder that needs permission again.
- Design this as a practical developer file explorer, compact and scannable.

3. Table-of-contents panel
- Collapsible right panel titled “On this page”.
- Search/filter field.
- Nested headings with indentation.
- Current section highlighted with a slim accent indicator.
- Include resizable-panel affordance and a mobile drawer version.

4. Search in document
- Compact floating search bar below the toolbar.
- Search input, match count (“3 of 14”), previous/next arrows, case-sensitive toggle, close button.
- Show highlighted matches in the document and a strong current-match state.

5. Annotations experience
- Selected text toolbar offering Highlight, Underline, and Add note.
- Right-side “Annotations” panel with annotation cards: colored mark indicator, excerpt, comment preview, timestamp, edit and delete controls.
- Include empty state: “No annotations yet”.
- Keep it lightweight and reading-focused.

6. Export menu
- Toolbar dropdown for Export.
- Options: Export HTML, Export DOCX, Print / Save as PDF.
- Small icon, description, keyboard hint where appropriate.
- Clearly show hover and focused menu-item states.

7. Empty, loading, error, and drag-drop states
- Empty viewer state with an elegant Markdown/document illustration.
- Heading: “Open a Markdown document”
- Actions: “Open file” and “Open folder”.
- Drag-and-drop zone hint.
- Loading state using a subtle skeleton document preview, not a generic spinner-only screen.
- Error state for inaccessible or invalid file with recovery actions.
- Disabled extension state.

8. Extension popup
- Compact 360px-wide Chrome extension popup.
- Header with Markora identity and theme toggle.
- Primary actions: Open Markdown file, Open folder, Render current page as Markdown.
- Recent documents list.
- Bookmarked folders list.
- Footer links: Settings, Keyboard shortcuts, Help & About.
- Keep it lightweight; this is a launcher, not the full application.

9. Settings page
- Full-page settings interface.
- Left navigation: General, Appearance, Markdown, Navigation, Files, Diagrams, Export, Language & Direction, Privacy, Storage.
- Appearance screen content:
  - Theme segmented control: System / Light / Dark
  - Font family selector
  - Font size and line-height sliders
  - Content width choices
  - Code font selector
- Navigation controls: show TOC, show reading progress, show document stats, sticky tables.
- Markdown controls: tables, task lists, footnotes, raw mode, syntax-highlight theme, line wrap.
- Privacy panel should clearly communicate: “Your documents are processed locally. No account required.”
- Include settings saved feedback and storage quota indicator.
- Show both dark and light theme versions.

10. Onboarding
- Friendly but professional 4-step first-run flow:
  1. Welcome to Markora
  2. Private local-first Markdown reading
  3. Open local files and folders
  4. Try the interactive demo document
- Use a progress indicator, concise copy, back/next actions, skip option, and illustration areas based on Markdown, folders, diagrams, and keyboard shortcuts.

11. Presentation mode
- Fullscreen slide mode generated from Markdown headings.
- Minimal slide chrome: progress line, slide count, previous/next controls, exit button, speaker-notes toggle.
- High-quality typography and diagram support.
- Use a dark cinematic reading surface, but preserve Markora’s restrained style.

12. Mind-map mode
- Fullscreen interactive document structure view.
- Central root topic with connected heading branches.
- Zoom, pan, collapse/expand, fullscreen, and export controls.
- Make it clean, technical, and readable rather than decorative.

Design system requirements:
- Create reusable components and variants for buttons, icon buttons, segmented controls, dropdown menus, tabs, sidebar headers, search fields, tree rows, settings rows, toggles, empty states, banners, toasts, dialogs, and keyboard shortcut chips.
- Establish tokens for background, elevated surface, subtle surface, primary text, secondary text, borders, accent, success, warning, error, focus ring, spacing, and radii.
- Include dark and light color specifications.
- Use realistic content rather than lorem ipsum.
- Clearly distinguish primary, secondary, destructive, selected, hover, focused, disabled, loading, and error states.

Output:
Create a cohesive clickable multi-screen prototype and component system that a frontend engineer can implement in a TypeScript Chrome extension. Prioritize the main viewer screen, folder browser, TOC, popup, settings, onboarding, presentation mode, and mind-map mode.