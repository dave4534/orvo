import { dataset } from "@/data";
import type { LocalClaim } from "./local";

/** Where the user is in the app. Sent with each chat message so answers can refer to "this claim". */
export type ChatUi = {
  tab: string;
  openClaimId: string | null;
  detailsOpen: boolean;
  detailsTab: string;
  search: string;
};

/** The parts of a claim the user can change during a session. The rest comes from the dataset. */
export type ClaimOverlay = Pick<LocalClaim, "id" | "status" | "awaiting" | "approval_chain" | "noa" | "events" | "local">;

export type ChatContext = { ui: ChatUi; overlay: ClaimOverlay[] };

const pickChanging = (c: LocalClaim) => ({
  status: c.status,
  awaiting: c.awaiting,
  approval_chain: c.approval_chain,
  noa: c.noa,
  events: c.events,
  local: c.local,
});

const originals = new Map(dataset.claims.map((c) => [c.id, JSON.stringify(pickChanging(c as unknown as LocalClaim))]));

/** Client side: only claims that differ from the dataset are sent, so the request stays small. */
export function buildChatContext(claims: LocalClaim[], ui: ChatUi): ChatContext {
  const overlay = claims
    .filter((c) => JSON.stringify(pickChanging(c)) !== originals.get(c.id))
    .map((c) => ({ id: c.id, ...pickChanging(c) }));
  return { ui, overlay };
}

/** Server side: lays the session's changes over the dataset. Only the known fields are taken. */
export function mergeOverlay(base: LocalClaim[], overlay: ClaimOverlay[]): LocalClaim[] {
  const byId = new Map(overlay.map((o) => [o.id, o]));
  return base.map((c) => {
    const o = byId.get(c.id);
    return o ? { ...c, ...pickChanging(o as unknown as LocalClaim) } : c;
  });
}
