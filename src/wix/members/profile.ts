// Kix addition to the kit's members data layer (the kit says extend by adding files): a member
// renames themselves. The built-in signup route takes credentials only, so the names typed on
// /create-account are saved here after the session exists (plan 05).
// A logged-in member may update their own record without elevation — Velo's updateMember: "Only
// logged-in members can call this function without elevated permissions".
// docs: https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/update-member.md
import { membersApi } from "./client";
import { imgSrc } from "../media";
import { memberId, toCurrentMember, type Raw } from "./members-core";
import type { CurrentMember } from "./types";

export interface MemberName {
  firstName: string;
  lastName: string;
}

/**
 * Saves the member's first and last name, and sets the nickname to "First Last" because the
 * kit's displayName prefers a nickname, which Wix may have set at signup. Throws on failure.
 */
export async function updateMemberName(id: string, { firstName, lastName }: MemberName): Promise<CurrentMember> {
  const nickname = [firstName, lastName].filter(Boolean).join(" ");
  const raw = (await membersApi.updateMember(id, { contact: { firstName, lastName }, profile: { nickname } })) as Raw;
  if (!memberId(raw)) throw new Error("Wix did not return the updated member.");
  return toCurrentMember(raw, imgSrc);
}
