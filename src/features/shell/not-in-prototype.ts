import { toast } from "sonner";

/** Non-blocking message for navigation that is out of scope (PRD FR-NAV-2). */
export function notInPrototype(feature: string) {
  toast(`${feature} is not in this prototype`, {
    description: "Only Expenses is wired up here.",
  });
}
