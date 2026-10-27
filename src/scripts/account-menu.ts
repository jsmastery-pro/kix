// Header account control. Visitors keep the person icon (a link to sign in). Once the shared
// member store reads a member, the icon becomes their avatar and opens a menu (disclosure
// pattern). Also saves a name typed at signup once the new member is signed in.
import { getMemberState, subscribeMember } from '../wix/members/member-store';
import type { CurrentMember } from '../wix/members/types';
import { applyPendingName } from './pending-profile';

/** The member's photo, or the first letter of their name (also when the photo fails to load). */
export function renderAvatar(target: HTMLElement, member: CurrentMember) {
  const showInitial = () => target.replaceChildren(document.createTextNode(member.displayName.trim().charAt(0)));
  if (!member.photoUrl) {
    showInitial();
    return;
  }
  const current = target.querySelector('img');
  if (current?.getAttribute('src') === member.photoUrl && current.complete && current.naturalWidth > 0) return;
  const image = document.createElement('img');
  image.alt = '';
  image.referrerPolicy = 'no-referrer'; // Google profile photos refuse requests that send a referrer.
  image.addEventListener('error', showInitial);
  image.src = member.photoUrl;
  target.replaceChildren(image);
}

export function initAccountMenu(root: HTMLElement) {
  const signIn = root.querySelector<HTMLElement>('[data-account-signin]');
  const button = root.querySelector<HTMLButtonElement>('[data-account-button]');
  const panel = root.querySelector<HTMLElement>('[data-account-panel]');
  const avatar = root.querySelector<HTMLElement>('[data-avatar]');
  const name = root.querySelector<HTMLElement>('[data-account-name]');
  const email = root.querySelector<HTMLElement>('[data-account-email]');
  if (!signIn || !button || !panel) return;

  const setOpen = (open: boolean) => {
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };

  const render = () => {
    const { member, loading } = getMemberState();
    // While a read is in flight the control keeps what it shows: no flash for visitors or members.
    if (loading) return;
    if (!member) {
      setOpen(false);
      button.hidden = true;
      signIn.hidden = false;
      return;
    }
    if (avatar) renderAvatar(avatar, member);
    if (name) name.textContent = member.displayName;
    if (email) {
      email.textContent = member.loginEmail;
      email.hidden = !member.loginEmail;
    }
    button.setAttribute('aria-label', `Account menu for ${member.displayName}`);
    signIn.hidden = true;
    button.hidden = false;
    void applyPendingName(member);
  };

  subscribeMember(render);
  render();

  button.addEventListener('click', () => setOpen(panel.hidden));
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    setOpen(false);
    button.focus();
  });
  root.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null;
    if (next && !root.contains(next)) setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !root.contains(event.target as Node)) setOpen(false);
  });
}
