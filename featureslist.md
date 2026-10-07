## Complete Feature List

### Core Markdown

1. Markdown file rendering — **[Completed]**
2. CommonMark — **[Completed]**
3. GitHub Flavored Markdown — **[Completed]**
4. Headings H1–H6 — **[Completed]**
5. Bold / italic / strikethrough — **[Completed]**
6. Ordered / unordered lists — **[Completed]**
7. Nested lists — **[Completed]**
8. Blockquotes — **[Completed]**
9. Tables — **[Completed]**
10. Task lists / checkboxes — **[Completed]**
11. Horizontal rules — **[Completed]**
12. Links — **[Completed]**
13. Images — **[Completed]**
14. Inline code — **[Completed]**
15. Fenced code blocks — **[Completed]**
16. Syntax highlighting — **[Completed]** (highlight.js pipeline with 15+ selectable themes)
17. YAML frontmatter — **[Completed]**
18. Footnotes — **[Completed]**
19. Heading anchors — **[Completed]**
20. Raw Markdown view — **[Completed]** (toolbar toggle wired in `src/viewer/index.ts`)

### Advanced Rendering

21. KaTeX mathematical equations — **[Completed]**
22. Inline math — **[Completed]**
23. Display math — **[Completed]**
24. Mermaid diagrams — **[Completed]** (strict security mode)
25. Mermaid fullscreen — **[Completed]** (shared diagramChrome shell)
26. Mermaid zoom/pan — **[Completed]**
27. PlantUML — **[Completed]** (off by default, explicit opt-in per privacy rules)
28. Graphviz — **[Completed]** (WASM renderer)
29. Advanced diagram export — **[Completed]** (SVG/PNG download per diagram)
30. Diagram fullscreen viewer — **[Completed]**
31. Image lightbox — **[Completed]**
32. Image gallery navigation — **[Completed]** (prev/next + counter)
33. Image zoom/pan — **[Completed]**
34. Lazy-loaded images — **[Completed]**

### Reading Experience

35. Automatic Table of Contents — **[Completed]**
36. Sticky table headers — **[Completed]** (`registerStickyTables` plugin)
37. Smooth TOC scrolling — **[Completed]** (`scrollIntoView({behavior:'smooth'})`)
38. Reading progress bar — **[Completed]**
39. Word count — **[Completed]**
40. Character count — **[Completed]**
41. Reading-time estimation — **[Completed]**
42. External-link indicators — **[Completed]**
43. Back-to-top — **[Pending]** (no back-to-top control found anywhere in viewer/toolbar code)
44. Custom font size — **[Completed]**
45. Custom font family — **[Completed]**
46. Custom content width — **[Completed]**
47. Custom line height — **[Completed]**
48. Zen / distraction-free mode — **[Pending]** (no zen/focus/immersive mode found in source)

### File & Project Management

49. Open individual `.md` — **[Completed]**
50. Drag & drop Markdown — **[Completed]**
51. `.markdown` support — **[Completed]**
52. `.mkd` support — **[Completed]**
53. `.mdx` support — **[Completed]** (safe-degradation transform per ADR-0008, never executes JSX by design)
54. `.txt → Markdown` rendering — **[Completed]** (`llms.txt` detection path)
55. Local folder browser — **[Completed]**
56. Recursive folder navigation — **[Completed]** (`scanFolder` depth-first walk)
57. Folder bookmarks — **[Completed]**
58. Recent documents — **[Completed]**
59. Project/file search — **[Completed]**
60. Full-text folder search — **[Completed]** (`searchFolder` content snippets)
61. Filename search — **[Completed]**
62. File modification tracking — **[Completed]** (`lastModified` comparison drives auto-refresh)
63. Live auto-refresh — **[Completed]** (concurrency-hardened polling, Flow A file:// diff + Flow B FSAA lastModified)
64. Multiple project workspaces — **[Completed]**

### Annotations

65. Text highlighting — **[Completed]**
66. Underline text — **[Completed]**
67. Add comments — **[Completed]**
68. Persistent annotations — **[Completed]** (IndexedDB via typed storage wrapper, reanchoring on reload)
69. Annotation sidebar — **[Completed]** (redesigned to match `new_ui/annotations.png`)
70. Navigate between annotations — **[Completed]** (click sidebar item → smooth-scroll to mark)
71. Annotations in print — **[Completed]**
72. Annotations in exports — **[Completed]** (HTML + DOCX both support `includeAnnotations`)

### Presentation

73. Presentation Mode — **[Completed]**
74. Convert headings to slides — **[Completed]**
75. Presentation themes — **[Completed]** (bg/text/heading/accent color + font + bg image)
76. Slide navigation — **[Completed]**
77. Keyboard navigation — **[Completed]**
78. Touch navigation — **[Completed]** (swipe + edge-tap zones)
79. Speaker notes — **[Completed]**
80. Auto-play — **[Completed]**
81. Presentation fullscreen — **[Completed]**

### Mind Map

82. Mind Map generation — **[Completed]**
83. Heading-based hierarchy — **[Completed]**
84. Interactive mind map — **[Completed]**
85. Mind map zoom — **[Completed]**
86. Mind map pan — **[Completed]**
87. Expand/collapse nodes — **[Completed]**
88. SVG mind-map export — **[Completed]**
89. PNG mind-map export — **[Completed]**
90. JPEG mind-map export — **[Completed]**

### Export

91. Copy Markdown — **[Completed]**
92. Copy rendered content — **[Pending]** (code comment in `src/viewer/index.ts` explicitly notes rich/HTML clipboard copy is unimplemented future work; only raw Markdown copy exists)
93. HTML export — **[Completed]**
94. Standalone HTML export — **[Completed]** (self-contained doc with tree-shaken CSS + embedded images)
95. DOCX export — **[Completed]**
96. PDF export — **[Partial]** (no direct PDF encoder; delivered via browser print-to-PDF, same as #97)
97. Print-optimized PDF — **[Completed]**
98. Diagram-preserving export — **[Partial]** (HTML/print preserve live rendered diagram SVGs via DOM clone; DOCX export degrades Mermaid/Graphviz blocks to plain code-text paragraphs, not images)
99. Math-preserving export — **[Completed]** (HTML keeps live KaTeX DOM; DOCX rasterizes LaTeX to PNG)
100. Annotation-preserving export — **[Completed]**

### Internationalization

101. English UI — **[Completed]**
102. Multiple UI languages — **[Completed]** (19 locales, full key coverage enforced by test)
103. RTL document support — **[Completed]**
104. Automatic RTL detection — **[Completed]** (`rtlAuto` markdown-it plugin, per-block `dir="auto"`)
105. Manual text direction — **[Completed]** (auto/ltr/rtl cycle control)
106. RTL export support — **[Completed]** (`dir`/`lang` passed into exported HTML document)

### Web / Repository Support

107. Local `file:///` Markdown — **[Completed]**
108. GitHub raw Markdown — **[Completed]**
109. GitLab raw Markdown — **[Completed]**
110. Bitbucket raw Markdown — **[Completed]**
111. Gitea raw Markdown — **[Pending]** (no Gitea host pattern in `detect.ts` or `manifest.json` content-script matches)
112. Remote `.md` URLs — **[Completed]** (generic suffix/llms.txt matching beyond the curated hosts)

### Customization

113. Light theme — **[Completed]**
114. Dark theme — **[Completed]**
115. System theme — **[Completed]**
116. Multiple reading themes — **[Pending]** (only light/dark/system exist; no sepia/paper/high-contrast reading theme variants found)
117. Custom CSS — **[Pending]** (no user custom-CSS injection feature found anywhere in settings/preferences)
118. Custom code theme — **[Completed]** (15 selectable syntax-highlight themes)
119. Layout customization — **[Completed]** (adjustable TOC sidebar width, content width mode)

### Security / Privacy

120. Local processing — **[Completed]**
121. No account required — **[Completed]**
122. No cloud upload — **[Completed]** (only disclosed opt-in PlantUML network call)
123. Content sanitization — **[Completed]** (DOMPurify on every HTML-producing path)
124. Permission controls — **[Completed]** (PlantUML opt-in toggle, block-remote-images toggle, runtime `unlimitedStorage` request)
125. Secure diagram rendering — **[Completed]** (Mermaid `securityLevel: 'strict'` + DOMPurify pass on output)

**Summary: 117 Completed, 2 Partial, 6 Pending (of 125)**
