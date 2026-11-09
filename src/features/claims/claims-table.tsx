import {
  AppWindow,
  BedDouble,
  Car,
  Laptop,
  Plane,
  Presentation,
  Receipt,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataset } from "@/data";
import type { Category, Claim } from "@/data/types";
import { personById } from "@/logic/claims";
import { claimStatusLabel, displayName, formatSubmitted, formatUsd, initials } from "@/logic/format";

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  meals: Utensils,
  travel_air: Plane,
  travel_ground: Car,
  lodging: BedDouble,
  conference_training: Presentation,
  entertainment: Ticket,
  software: AppWindow,
  equipment: Laptop,
  other: Receipt,
};

type Props = {
  claims: Claim[];
  selectedIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onReview: (id: string) => void;
};

function StatusBadge({ claim }: { claim: Claim }) {
  const needsReview = claim.status === "waiting_on_noa";
  return (
    <Badge
      variant="outline"
      className={
        needsReview ? "border-warning-border bg-warning text-warning-foreground" : "bg-card text-muted-foreground"
      }
    >
      {claimStatusLabel(claim)}
    </Badge>
  );
}

export function ClaimsTable({ claims, selectedIds, activeId, onToggle, onToggleAll, onReview }: Props) {
  const allSelected = claims.length > 0 && claims.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && claims.some((c) => selectedIds.has(c.id));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table className="table-fixed">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-12 pl-5">
              <Checkbox
                aria-label="Select all claims"
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => onToggleAll(checked)}
              />
            </TableHead>
            <TableHead className="w-[24%]">Employee</TableHead>
            <TableHead className="w-[19%]">Submitted</TableHead>
            <TableHead className="w-[19%]">Category</TableHead>
            <TableHead className="w-[12%] text-right">Amount</TableHead>
            <TableHead className="w-[16%]">Status</TableHead>
            <TableHead className="w-28 pr-5">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {claims.map((claim) => {
            const person = personById(claim.employee_id);
            const name = person ? displayName(person) : claim.employee_id;
            const Icon = CATEGORY_ICON[claim.category];
            return (
              <TableRow key={claim.id} data-state={activeId === claim.id ? "selected" : undefined} className="h-[72px]">
                <TableCell className="pl-5">
                  <Checkbox
                    aria-label={`Select claim ${claim.id} from ${name}`}
                    checked={selectedIds.has(claim.id)}
                    onCheckedChange={(checked) => onToggle(claim.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">{name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatSubmitted(claim.submitted_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{dataset.enums.category[claim.category]}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatUsd(claim.amount.usd_claimed)}</TableCell>
                <TableCell>
                  <StatusBadge claim={claim} />
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button variant="outline" onClick={() => onReview(claim.id)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
