// /account's Saved Designs card (plan 12): the list renders on the server; this script deletes a
// design after an inline confirm (no browser dialog) and reports a failed server read to PostHog,
// which can't run on the server.
import { DesignError, deleteDesign } from '../wix/models/designs';
import { captureError, track } from './analytics';

export function initSavedDesigns(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-designs-status]');
  if (root.hasAttribute('data-designs-error')) captureError(new Error('saved designs read failed on the server'), 'design_list');

  for (const row of root.querySelectorAll<HTMLElement>('[data-design-row]')) {
    const id = row.dataset.designId ?? '';
    const productId = row.dataset.productId ?? '';
    const actions = row.querySelector<HTMLElement>('[data-design-actions]')!;
    const confirm = row.querySelector<HTMLElement>('[data-design-confirm]')!;
    const ask = row.querySelector<HTMLButtonElement>('[data-design-delete]')!;
    const yes = row.querySelector<HTMLButtonElement>('[data-design-yes]')!;
    const keep = row.querySelector<HTMLButtonElement>('[data-design-keep]')!;
    const error = row.querySelector<HTMLElement>('[data-design-error]')!;

    const showConfirm = (open: boolean) => {
      actions.hidden = open;
      confirm.hidden = !open;
      (open ? keep : ask).focus();
    };
    ask.addEventListener('click', () => {
      error.textContent = '';
      showConfirm(true);
    });
    keep.addEventListener('click', () => showConfirm(false));
    yes.addEventListener('click', async () => {
      if (yes.getAttribute('aria-busy') === 'true') return;
      yes.setAttribute('aria-busy', 'true');
      yes.textContent = 'Deleting…';
      try {
        await deleteDesign(id);
        track('design_deleted', { product_id: productId });
        const list = row.parentElement;
        const next = (row.nextElementSibling ?? row.previousElementSibling)?.querySelector<HTMLElement>('a');
        row.remove();
        if (list && list.children.length === 0) {
          list.remove();
          root.querySelector<HTMLElement>('[data-designs-empty]')?.removeAttribute('hidden');
        }
        if (status) status.textContent = 'Design deleted.';
        (next ?? root.querySelector<HTMLElement>('[data-designs-empty] a'))?.focus();
      } catch (failure) {
        captureError(failure, 'design_delete');
        error.textContent = failure instanceof DesignError && failure.reason === 'network' ? "We couldn't reach the store. Try again." : "We couldn't delete this design. Try again.";
        yes.removeAttribute('aria-busy');
        yes.textContent = 'Delete';
        showConfirm(false);
      }
    });
  }
}
