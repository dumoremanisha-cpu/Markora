// First-run onboarding (F45). Opened as its own tab by the background
// service worker's chrome.runtime.onInstalled('install') handler. No
// account creation at any step — Finish just marks onboardingCompleted and
// seeds lastSeenWhatsNewVersion to the version just installed (so the
// "What's New" panel never fires redundantly right after onboarding).
import { t } from '../backend/i18n';
import { initI18nRuntime } from '../backend/utils/i18nRuntime';
import { getAppliedTheme, initTheme } from '../backend/utils/theme';
import { getSettings, setSettings } from '../backend/storage';
import type { Settings } from '../backend/storage';
import { createHandoff } from '../backend/storage/handoff';
import { renderMarkdown } from '../backend/viewer/markdown';
import { GLOBAL_SHORTCUT, IN_PAGE_SHORTCUTS } from '../backend/utils/shortcutDefinitions';
import demoMarkdown from '../backend/assets/demo/demo.md?raw';
import {
  iconCheck,
  iconDocument,
  iconFolder,
  iconKeyboard,
  iconMindMap,
  iconPlay,
  iconShield,
} from '../frontend/components/icons';

const app = document.getElementById('app');
if (!app) throw new Error('onboarding: #app not found');

type StepId =
  'welcome' | 'privacy' | 'fileAccess' | 'sample' | 'mermaid' | 'math' | 'shortcuts' | 'finish';

const STEP_ORDER: StepId[] = [
  'welcome',
  'privacy',
  'fileAccess',
  'sample',
  'mermaid',
  'math',
  'shortcuts',
  'finish',
];

interface StepContent {
  el: HTMLElement;
  /** Only mermaid/math steps need this — DOM must exist before hydrating a live diagram/math render. */
  afterInsert?: () => Promise<void>;
}

const STEP_ICONS: Record<StepId, () => SVGSVGElement> = {
  welcome: iconDocument,
  privacy: iconShield,
  fileAccess: iconFolder,
  sample: iconPlay,
  mermaid: iconMindMap,
  math: iconCheck,
  shortcuts: iconKeyboard,
  finish: iconCheck,
};

function stepIcon(id: StepId): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'markora-onboarding__step-icon';
  wrapper.append(STEP_ICONS[id]());
  return wrapper;
}

function textStep(id: StepId, titleKey: string, bodyText: string): StepContent {
  const el = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = t(titleKey);
  const body = document.createElement('p');
  body.textContent = bodyText;
  el.append(stepIcon(id), title, body);
  return { el };
}

function buildFileAccessStep(): StepContent {
  const el = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = t('onboarding.step.fileAccess.title');
  const intro = document.createElement('p');
  intro.textContent = t('popup.setup.fileAccess.intro');
  const stepsList = document.createElement('ol');
  for (const key of [
    'popup.setup.fileAccess.step1',
    'popup.setup.fileAccess.step2',
    'popup.setup.fileAccess.step3',
    'popup.setup.fileAccess.step4',
  ]) {
    const li = document.createElement('li');
    li.textContent = t(key);
    stepsList.appendChild(li);
  }
  const openSettingsButton = document.createElement('button');
  openSettingsButton.type = 'button';
  openSettingsButton.textContent = t('popup.setup.fileAccess.openSettingsButton');
  openSettingsButton.addEventListener('click', () => {
    void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });
  const hint = document.createElement('p');
  hint.className = 'markora-popup__hint';
  hint.textContent = t('onboarding.step.fileAccess.body');
  el.append(stepIcon('fileAccess'), title, intro, stepsList, openSettingsButton, hint);
  return { el };
}

async function openSampleDocument(): Promise<void> {
  const token = await createHandoff('markora-demo.md', demoMarkdown, {
    addressBarEntered: false,
  });
  const url = `${chrome.runtime.getURL('src/viewer/index.html')}?h=${token}`;
  await chrome.tabs.create({ url });
}

function buildSampleStep(): StepContent {
  const el = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = t('onboarding.step.sample.title');
  const body = document.createElement('p');
  body.textContent = t('onboarding.step.sample.body');
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.textContent = t('onboarding.step.sample.openButton');
  openButton.addEventListener('click', () => void openSampleDocument());
  el.append(stepIcon('sample'), title, body, openButton);
  return { el };
}

function buildMermaidStep(): StepContent {
  const el = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = t('onboarding.step.mermaid.title');
  const body = document.createElement('p');
  body.textContent = t('onboarding.step.mermaid.body');
  const example = document.createElement('div');
  example.className = 'markora-onboarding__example';
  el.append(stepIcon('mermaid'), title, body, example);
  return {
    el,
    afterInsert: async () => {
      const { html } = renderMarkdown(
        '```mermaid\ngraph TD\n  A[Open a file] --> B[Markora renders it]\n```',
      );
      example.innerHTML = html;
      const { renderDiagramsIn } = await import('../backend/viewer/mermaid');
      await renderDiagramsIn(example, getAppliedTheme());
    },
  };
}

function buildMathStep(): StepContent {
  const el = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = t('onboarding.step.math.title');
  const body = document.createElement('p');
  body.textContent = t('onboarding.step.math.body');
  const example = document.createElement('div');
  example.className = 'markora-onboarding__example';
  el.append(stepIcon('math'), title, body, example);
  return {
    el,
    afterInsert: async () => {
      const { html } = renderMarkdown(
        'Inline: $E = mc^2$\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$',
      );
      example.innerHTML = html;
      const { renderMathIn } = await import('../backend/viewer/math');
      await renderMathIn(example);
    },
  };
}

function buildShortcutsStep(settings: Settings): StepContent {
  const el = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = t('onboarding.step.shortcuts.title');
  const body = document.createElement('p');
  body.textContent = t('onboarding.step.shortcuts.body');
  const list = document.createElement('dl');
  for (const def of IN_PAGE_SHORTCUTS) {
    const dt = document.createElement('dt');
    dt.textContent = t(def.labelKey);
    const dd = document.createElement('dd');
    const kbd = document.createElement('kbd');
    kbd.textContent = settings.shortcuts[def.id];
    dd.appendChild(kbd);
    list.append(dt, dd);
  }
  const dt = document.createElement('dt');
  dt.textContent = t(GLOBAL_SHORTCUT.labelKey);
  const dd = document.createElement('dd');
  const kbd = document.createElement('kbd');
  kbd.textContent = GLOBAL_SHORTCUT.defaultCombo;
  dd.appendChild(kbd);
  list.append(dt, dd);
  el.append(stepIcon('shortcuts'), title, body, list);
  return { el };
}

function buildStep(id: StepId, settings: Settings): StepContent {
  switch (id) {
    case 'welcome':
      return textStep(
        'welcome',
        'onboarding.step.welcome.title',
        t('onboarding.step.welcome.body'),
      );
    case 'privacy':
      return textStep(
        'privacy',
        'onboarding.step.privacy.title',
        t('settings.privacy.localOnlyExplanation'),
      );
    case 'fileAccess':
      return buildFileAccessStep();
    case 'sample':
      return buildSampleStep();
    case 'mermaid':
      return buildMermaidStep();
    case 'math':
      return buildMathStep();
    case 'shortcuts':
      return buildShortcutsStep(settings);
    case 'finish':
      return textStep('finish', 'onboarding.step.finish.title', t('onboarding.step.finish.body'));
  }
}

async function completeOnboarding(): Promise<void> {
  const currentVersion = chrome.runtime.getManifest().version;
  await setSettings({ onboardingCompleted: true, lastSeenWhatsNewVersion: currentVersion });
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await chrome.tabs.remove(tab.id);
  } else {
    window.close();
  }
}

let currentStepIndex = 0;

async function renderApp(): Promise<void> {
  const settings = await getSettings();
  app!.replaceChildren();

  const shell = document.createElement('main');
  shell.className = 'markora-onboarding';

  const progress = document.createElement('p');
  progress.className = 'markora-onboarding__progress';
  progress.textContent = t('onboarding.progress', {
    current: currentStepIndex + 1,
    total: STEP_ORDER.length,
  });

  // Visual step indicator alongside the text above (kept for screen-reader
  // clarity — this row is purely decorative, aria-hidden).
  const dots = document.createElement('div');
  dots.className = 'markora-onboarding__dots';
  dots.setAttribute('aria-hidden', 'true');
  STEP_ORDER.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'markora-onboarding__dot';
    if (i === currentStepIndex) dot.classList.add('markora-onboarding__dot--active');
    else if (i < currentStepIndex) dot.classList.add('markora-onboarding__dot--done');
    dots.appendChild(dot);
  });

  const stepContainer = document.createElement('div');
  stepContainer.className = 'markora-onboarding__step';

  const nav = document.createElement('div');
  nav.className = 'markora-onboarding__nav';

  const skipButton = document.createElement('button');
  skipButton.type = 'button';
  skipButton.textContent = t('onboarding.nav.skip');
  skipButton.addEventListener('click', () => void completeOnboarding());

  const navEnd = document.createElement('div');
  navEnd.className = 'markora-onboarding__nav-end';

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.textContent = t('onboarding.nav.back');
  backButton.disabled = currentStepIndex === 0;
  backButton.addEventListener('click', () => {
    currentStepIndex = Math.max(0, currentStepIndex - 1);
    void renderApp();
  });

  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = t(isLastStep ? 'onboarding.nav.finish' : 'onboarding.nav.next');
  nextButton.addEventListener('click', () => {
    if (isLastStep) {
      void completeOnboarding();
      return;
    }
    currentStepIndex = Math.min(STEP_ORDER.length - 1, currentStepIndex + 1);
    void renderApp();
  });

  navEnd.append(backButton, nextButton);
  nav.append(skipButton, navEnd);
  if (isLastStep) skipButton.hidden = true;

  shell.append(dots, progress, stepContainer, nav);
  app!.appendChild(shell);

  const step = buildStep(STEP_ORDER[currentStepIndex]!, settings);
  stepContainer.appendChild(step.el);
  if (step.afterInsert) await step.afterInsert();
}

async function bootstrap(): Promise<void> {
  await initI18nRuntime(() => void renderApp());
  await initTheme();
  await renderApp();
}

void bootstrap();
