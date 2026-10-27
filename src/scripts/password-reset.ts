// Sends Wix's password reset email (forgot password page and the account page). The member sets
// a new password on Wix's page and lands on /login?reset=done. The copy never says whether the
// email has an account.
import { WIX_CLIENT_ID } from 'astro:env/client';
import { sendPasswordReset, type ResetOutcome } from '../wix/members/recovery';
import { createFormControls, emailRule, NETWORK_ERROR, type Message } from './form-controls';

export function resetEmail(email: string): Promise<ResetOutcome> {
  return sendPasswordReset(email, { url: new URL('/login?reset=done', location.origin).href, clientId: WIX_CLIENT_ID });
}

export function resetFailure(outcome: Exclude<ResetOutcome, 'sent'>): Message {
  return outcome === 'rate-limited' ? { tone: 'error', text: 'Too many requests. Try again later.' } : NETWORK_ERROR;
}

/** /forgot-password: one email field. On send, the fields hide and the confirmation stays. */
export function initForgotPassword(form: HTMLFormElement) {
  const controls = createFormControls(form, { 'reset-email': emailRule });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (controls.isBusy()) return;
    controls.hideAlert();
    if (!controls.validateAll()) return;
    const email = controls.value('reset-email').trim();
    controls.setBusy(true);
    const outcome = await resetEmail(email);
    controls.setBusy(false);
    if (outcome !== 'sent') {
      controls.showAlert(resetFailure(outcome), true);
      return;
    }
    form.querySelectorAll<HTMLElement>('[data-reset-hide]').forEach((element) => { element.hidden = true; });
    controls.showAlert({ tone: 'info', text: `If there's a Kix account for ${email}, a reset link is on its way. It works for 3 hours.` }, true);
  });
}
