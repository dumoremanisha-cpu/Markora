// Ambient types for markdown-it plugins with no @types package (checked at
// Phase 2-A time: neither ships its own .d.ts nor has a DefinitelyTyped
// package).
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';

  interface TaskListsOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  function taskLists(md: MarkdownIt, options?: TaskListsOptions): void;
  export default taskLists;
}

declare module 'markdown-it-deflist' {
  import type MarkdownIt from 'markdown-it';

  function deflist(md: MarkdownIt): void;
  export default deflist;
}
