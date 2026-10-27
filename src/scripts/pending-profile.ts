// Names typed on /create-account wait here (this tab only) until the new member is signed in,
// then account-menu.ts saves them to Wix. Scoped by email so a failed signup followed by signing
// in to another account can't rename that account. Never logged or sent anywhere but Wix.
import { refreshMember } from '../wix/members/member-store';
import { updateMemberName, type MemberName } from '../wix/members/profile';
import type { CurrentMember } from '../wix/members/types';

const KEY = 'kix:pending-name';

interface PendingName extends MemberName {
  email: string;
}

function read(): PendingName | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return value && typeof value.email === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function savePendingName(email: string, name: MemberName) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ email: email.toLowerCase(), ...name }));
  } catch {
    /* storage blocked: the member sets their name on /account instead */
  }
}

export function clearPendingName() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

let applying = false;

/** Saves a waiting name for this member. On failure it stays for the next page load. */
export async function applyPendingName(member: CurrentMember): Promise<void> {
  const pending = read();
  if (!pending || applying) return;
  if (pending.email !== member.loginEmail.toLowerCase()) {
    clearPendingName();
    return;
  }
  applying = true;
  try {
    await updateMemberName(member.id, { firstName: pending.firstName, lastName: pending.lastName });
    clearPendingName();
    await refreshMember();
  } catch {
    /* kept for a retry on the next page */
  } finally {
    applying = false;
  }
}
