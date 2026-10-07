// Full options page (F41), reachable via chrome.runtime.openOptionsPage()
// (popup's Settings action, and as a stable fallback entry point). The
// actual section content (General/Appearance/Markdown/... through
// About/Shortcuts) is built by the shared, storage-backed builders in
// frontend/components/preferencesModal/sections.ts — the same ones used by
// the in-viewer floating "Preferences" dialog — so this page and that
// dialog can never disagree about what a setting does, only about how its
// container looks.
import { t } from '../backend/i18n';
import { initI18nRuntime } from '../backend/utils/i18nRuntime';
import { getSettings } from '../backend/storage';
import {
  buildSections,
  NAV_GROUPS,
  SECTION_ICONS,
  SECTION_LABEL_KEYS,
  SECTION_ORDER,
} from '../frontend/components/preferencesModal/sections';
import type { SectionId } from '../frontend/components/preferencesModal/sections';

const app = document.getElementById('app');
if (!app) throw new Error('settings: #app not found');

// F37/F81 live language switching: rebuild the whole page from scratch on a
// language change (like a popup re-open would), keeping only which nav
// section was selected — the settings page holds no other state worth
// preserving across a locale swap.
let currentSection: SectionId = 'general';

async function renderApp(): Promise<void> {
  const settings = await getSettings();
  const sections = buildSections(settings, () => void renderApp());

  app!.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'markora-settings';

  const nav = document.createElement('div');
  nav.className = 'markora-settings__nav';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-orientation', 'vertical');

  const main = document.createElement('div');
  main.className = 'markora-settings__main';

  const heading = document.createElement('h1');
  heading.textContent = t('settings.pageTitle');

  const buttons: Partial<Record<SectionId, HTMLButtonElement>> = {};
  const select = (id: SectionId): void => {
    currentSection = id;
    for (const sectionId of SECTION_ORDER) {
      const panel = sections[sectionId];
      const button = buttons[sectionId];
      panel.hidden = sectionId !== id;
      button?.setAttribute('aria-selected', String(sectionId === id));
    }
  };

  for (const group of NAV_GROUPS) {
    if (group.labelKey) {
      const label = document.createElement('p');
      label.className = 'markora-settings__nav-group-label';
      label.textContent = t(group.labelKey);
      nav.appendChild(label);
    }
    for (const id of group.sections) {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.className = 'markora-settings__nav-item';
      button.append(SECTION_ICONS[id](), document.createTextNode(t(SECTION_LABEL_KEYS[id])));
      button.addEventListener('click', () => select(id));
      buttons[id] = button;
      nav.appendChild(button);
      main.appendChild(sections[id]);
    }
  }

  select(currentSection);

  shell.append(nav, main);
  const page = document.createElement('main');
  page.append(heading, shell);
  app!.append(page);
}

async function bootstrap(): Promise<void> {
  await initI18nRuntime(() => void renderApp());
  await renderApp();
}

void bootstrap();
