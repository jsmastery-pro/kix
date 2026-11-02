// /account: the name form and the password reset card. The page is server-rendered for a member;
// this script saves changes through the kit's member layer and keeps the page in step with the
// shared member store (a name saved after signup can land while the page is open).
import { getMemberState, refreshMember, subscribeMember } from '../wix/members/member-store';
import { updateMemberName } from '../wix/members/profile';
import { renderAvatar } from './account-menu';
import { createFormControls, firstNameRule, lastNameRule } from './form-controls';
import { resetEmail, resetFailure } from './password-reset';
import { logPasswordResetRequested, resetIdentity, track } from './analytics';

export function initAccount(root: HTMLElement) {
  const memberId = root.dataset.memberId ?? '';
  const loginEmail = root.dataset.loginEmail ?? '';
  const avatar = root.querySelector<HTMLElement>('[data-avatar]');
  const nameForm = root.querySelector<HTMLFormElement>('[data-account-name-form]');
  const resetForm = root.querySelector<HTMLFormElement>('[data-account-reset-form]');
  const signOutForm = root.querySelector<HTMLFormElement>('form[action*="/api/auth/logout"]');

  signOutForm?.addEventListener('submit', () => resetIdentity());

  if (nameForm) {
    const controls = createFormControls(nameForm, { 'account-first-name': firstNameRule, 'account-last-name': lastNameRule });

    // A late save (pending name from signup) fills fields the member hasn't typed in.
    subscribeMember(() => {
      const { member } = getMemberState();
      if (!member || member.id !== memberId) return;
      const first = controls.input('account-first-name');
      const last = controls.input('account-last-name');
      if (first && !controls.typed(first.id) && member.firstName) first.value = member.firstName;
      if (last && !controls.typed(last.id) && member.lastName) last.value = member.lastName;
      if (avatar) renderAvatar(avatar, member);
    });

    nameForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (controls.isBusy()) return;
      controls.hideAlert();
      if (!controls.validateAll()) return;
      controls.setBusy(true);
      try {
        const member = await updateMemberName(memberId, {
          firstName: controls.value('account-first-name').trim(),
          lastName: controls.value('account-last-name').trim(),
        });
        if (avatar) renderAvatar(avatar, member);
        track('profile_name_saved', { source: 'account' });
        controls.showAlert({ tone: 'info', text: 'Saved.' }, true);
        void refreshMember(); // The header menu shows the new name.
      } catch {
        controls.showAlert({ tone: 'error', text: "We couldn't save your name. Try again." }, true);
      } finally {
        controls.setBusy(false);
      }
    });
  }

  if (resetForm) {
    const controls = createFormControls(resetForm, {});
    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (controls.isBusy()) return;
      controls.hideAlert();
      controls.setBusy(true);
      const outcome = await resetEmail(loginEmail);
      controls.setBusy(false);
      if (outcome !== 'sent') {
        controls.showAlert(resetFailure(outcome), true);
        return;
      }
      logPasswordResetRequested('account');
      track('password_reset_requested', { source: 'account', outcome });
      // One email per visit: each send counts toward Wix's 200-a-day limit.
      resetForm.querySelector<HTMLElement>('button[type="submit"]')?.setAttribute('hidden', '');
      controls.showAlert({ tone: 'info', text: 'Check your email for the link.' }, true);
    });
  }
}
