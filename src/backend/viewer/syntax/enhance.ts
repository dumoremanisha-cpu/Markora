// Enhance stage (code-conventions.md §4): copy-to-clipboard wiring for
// fenced code blocks. A single delegated listener bound once to the
// persistent content container — it survives re-renders (a new document
// replacing `container.innerHTML`) without needing to be rebound each time.
import { t } from '../../i18n';
import { showToast } from '../../../frontend/components/notifications';

export function wireCodeBlockCopy(container: HTMLElement): void {
  container.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.markora-code-block__copy-btn');
    if (!button) return;
    const codeEl = button.closest('.markora-code-block')?.querySelector('code');
    const text = codeEl?.textContent ?? '';
    void navigator.clipboard
      .writeText(text)
      .then(() => showToast(t('viewer.code.copySuccess'), 'success'))
      .catch(() => showToast(t('viewer.code.copyError'), 'error'));
  });
}
