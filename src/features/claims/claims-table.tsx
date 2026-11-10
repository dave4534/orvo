import {
  AppWindow,
  BedDouble,
  Car,
  ChevronDown,
  ChevronRight,
  Laptop,
  Plane,
  Presentation,
  Receipt,
  Sparkle,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dataset } from "@/data";
import type { Category } from "@/data/types";
import { basisFor } from "@/logic/basis";
import { formatDuration, timeToDecision, waitingFor } from "@/logic/wait";
import { employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatSubmitted, formatUsd, initials } from "@/logic/format";
import { photoFor } from "@/logic/photos";
import { isWaitOver, type LocalClaim } from "@/logic/local";
import { useClaims } from "@/store/claims-store";
import type { Section } from "@/logic/sections";
import type { TabId } from "@/logic/claims";
import { PILL } from "@/lib/blocks";
import { cn } from "@/lib/utils";

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
  tab: TabId;
  sections: Section[];
  expanded: Set<string>;
  onToggleSection: (id: string) => void;
  selectedIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onReview: (id: string) => void;
};

function statusStyle(claim: LocalClaim, now: Date): string {
  if (claim.status === "waiting_on_noa" || isWaitOver(claim, now)) return "border-warning-border bg-warning text-warning-foreground";
  if (claim.status === "approved_by_agent" || claim.status === "approved_by_noa") return "border-success-border bg-card text-success";
  return "bg-card text-muted-foreground";
}

/** Column header per tab. Open claims show how long they have waited; decided claims show how long the decision took. */
const TIME_HEADER: Record<TabId, string> = {
  needs_review: "Waiting",
  waiting: "Waiting",
  done: "Time to decision",
  all: "Submitted",
};

/** The time cell. The plain value shows in the row, and hovering it shows the exact time. */
function TimeCell({ tab, claim }: { tab: TabId; claim: LocalClaim }) {
  const { now } = useClaims();
  const value =
    tab === "done"
      ? timeToDecision(claim) ?? ""
      : tab === "all"
        ? `${formatDuration(now.getTime() - new Date(claim.submitted_at).getTime())} ago`
        : waitingFor(claim, now);
  const exact = tab === "done" && claim.noa ? `Decided ${formatSubmitted(claim.noa.decided_at)}` : `Submitted ${formatSubmitted(claim.submitted_at)}`;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="cursor-default tabular-nums" />}>{value}</TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}

/** Why a decided claim was decided. Shown on Done and All only, since open claims have no decision yet. */
function BasisPill({ claim }: { claim: LocalClaim }) {
  const basis = basisFor(claim);
  if (!basis) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant="outline" tabIndex={0} className={cn(PILL, "bg-card text-muted-foreground")}>
            {basis.label}
            <Sparkle aria-hidden data-icon="inline-end" />
          </Badge>
        }
      />
      <TooltipContent>{basis.tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ClaimsTable({ tab, sections, expanded, onToggleSection, selectedIds, activeId, onToggle, onToggleAll, onReview }: Props) {
  const visible = sections.flatMap((s) => (s.collapsible && !expanded.has(s.id) ? [] : s.claims));
  const allSelected = visible.length > 0 && visible.every((c) => selectedIds.has(c.id));
  const someSelected = !allSelected && visible.some((c) => selectedIds.has(c.id));
  // The Basis column exists only when at least one visible claim has a decision to explain.
  const showBasis = visible.some((c) => basisFor(c) !== null);
  const colCount = showBasis ? 8 : 7;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table className="table-fixed">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-12 pl-5">
              <Checkbox
                aria-label="Select all visible claims"
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => onToggleAll(checked)}
              />
            </TableHead>
            <TableHead className={showBasis ? "w-[20%]" : "w-[24%]"}>Claim</TableHead>
            <TableHead className={showBasis ? "w-[15%]" : "w-[19%]"}>Category</TableHead>
            <TableHead className={showBasis ? "w-[15%]" : "w-[19%]"}>{TIME_HEADER[tab]}</TableHead>
            <TableHead className={showBasis ? "w-[10%] text-right" : "w-[12%] text-right"}>Amount</TableHead>
            <TableHead className={showBasis ? "w-[17%]" : "w-[18%]"}>Status</TableHead>
            {showBasis ? <TableHead className="w-[17%]">Basis</TableHead> : null}
            <TableHead className="w-28 pr-5">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((section) => {
            const collapsed = Boolean(section.collapsible) && !expanded.has(section.id);
            return (
              <SectionRows
                key={section.id}
                tab={tab}
                section={section}
                collapsed={collapsed}
                showBasis={showBasis}
                colCount={colCount}
                onToggleSection={onToggleSection}
                selectedIds={selectedIds}
                activeId={activeId}
                onToggle={onToggle}
                onReview={onReview}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SectionRows({
  tab,
  section,
  collapsed,
  showBasis,
  colCount,
  onToggleSection,
  selectedIds,
  activeId,
  onToggle,
  onReview,
}: {
  tab: TabId;
  section: Section;
  collapsed: boolean;
  showBasis: boolean;
  colCount: number;
  onToggleSection: (id: string) => void;
  selectedIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string, checked: boolean) => void;
  onReview: (id: string) => void;
}) {
  const { now } = useClaims();
  return (
    <>
      {section.label ? (
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={colCount} className="px-5 py-2 text-xs font-semibold tracking-wide text-muted-foreground">
            {section.collapsible ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-7 px-2 text-xs font-semibold tracking-wide text-muted-foreground"
                aria-expanded={!collapsed}
                onClick={() => onToggleSection(section.id)}
              >
                {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                {section.label}, {section.claims.length} {collapsed ? "HIDDEN" : "SHOWN"}
              </Button>
            ) : (
              section.label
            )}
          </TableCell>
        </TableRow>
      ) : null}
      {collapsed
        ? null
        : section.claims.map((claim) => {
            const name = employeeName(claim);
            const Icon = CATEGORY_ICON[claim.category];
            const active = activeId === claim.id;
            return (
              <TableRow
                key={claim.id}
                data-state={active ? "selected" : undefined}
                className={cn("h-[72px] cursor-pointer", active && "bg-info shadow-[inset_3px_0_0_var(--primary)]")}
                onClick={() => onReview(claim.id)}
              >
                <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select claim ${claim.id} from ${name}`}
                    checked={selectedIds.has(claim.id)}
                    onCheckedChange={(checked) => onToggle(claim.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={photoFor(claim.employee_id)} alt="" />
                      <AvatarFallback>{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{claim.id}</span>
                      <span className="truncate text-xs text-muted-foreground">{name}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{dataset.enums.category[claim.category]}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <TimeCell tab={tab} claim={claim} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatUsd(claim.amount.usd_claimed)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className={cn(PILL, statusStyle(claim, now))}>
                      {isWaitOver(claim, now) ? "Needs review" : claimStatusLabel(claim)}
                    </Badge>
                    {claim.local?.spot_checked ? <Badge variant="outline" className={cn(PILL, "bg-card text-muted-foreground")}>Reviewed</Badge> : null}
                  </div>
                </TableCell>
                {showBasis ? (
                  <TableCell>
                    <BasisPill claim={claim} />
                  </TableCell>
                ) : null}
                <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" onClick={() => onReview(claim.id)} aria-label={`Review claim ${claim.id} from ${name}`}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
    </>
  );
}
