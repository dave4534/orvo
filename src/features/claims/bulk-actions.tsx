import { Button } from "@/components/ui/button";
import type { BulkAction, BulkActionId } from "@/logic/bulk";

type Props = {
  actions: BulkAction[];
  onRun: (id: BulkActionId) => void;
};

/** Buttons for the selected claims, shown beside the filters. Only the actions every selected claim can take appear. */
export function BulkActions({ actions, onRun }: Props) {
  if (actions.length === 0) return null;
  return (
    <div role="group" aria-label="Actions for the selected claims" className="flex items-center gap-2">
      {actions.map((a) => (
        <Button key={a.id} variant="outline" className={a.destructive ? "h-10 text-destructive" : "h-10"} onClick={() => onRun(a.id)}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}
