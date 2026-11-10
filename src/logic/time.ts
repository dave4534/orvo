/** Small date helpers for the policy logic. Dataset timestamps are local company time with no offset. Pure. */
export const DAY_MS = 86_400_000;

export const isoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY_MS);

/** Monday to Friday. Used for the Finance response window. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return d;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** "Mon 30 Nov". */
export const formatDay = (value: Date | string): string => dayFormat.format(new Date(value)).replace(",", "");
