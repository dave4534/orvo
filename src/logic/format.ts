import type { Claim, Person, Status } from "@/data/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatUsd = (value: number) => usd.format(value);

/** "Thu 12 Nov, 22:10". Timestamps in the data are local company time with no offset. */
export function formatSubmitted(ts: string): string {
  const d = new Date(ts);
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")}`;
}

/** Name for display. The dataset stores nicknames in quotes, for example Dmitri "Dima" Volkov. */
export function displayName(person: Pick<Person, "name">): string {
  return person.name.replace(/\s*"[^"]*"\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function initials(name: string): string {
  const words = name.split(" ").filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

/** Status label for a row. PRD 6.6. */
export const STATUS_LABEL: Record<Status, string> = {
  waiting_on_noa: "Needs review",
  waiting_on_employee: "Waiting on employee",
  waiting_on_finance: "Waiting on Finance",
  approved_by_agent: "Approved automatically",
  declined_by_agent: "Declined automatically",
  approved_by_noa: "Approved",
  declined_by_noa: "Declined",
};

/** "Corrected" when the manager reversed or changed an agent decision (PRD 6.6). */
export const claimStatusLabel = (claim: Pick<Claim, "status" | "noa">) =>
  claim.noa?.overrode_agent && (claim.status === "approved_by_noa" || claim.status === "declined_by_noa")
    ? "Corrected"
    : STATUS_LABEL[claim.status];
