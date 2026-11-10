import type { FC } from "react";
import { Browser, Car01, ChevronDown, ChevronRight, Laptop01, Plane, PresentationChart01, Receipt, Ticket01 } from "@untitledui/icons";
import { BedDouble, Utensils } from "lucide-react";
import { Cell as AriaCell, Row as AriaRow, type Selection } from "react-aria-components";

import { Table, TableCard } from "@/components/application/table/table";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { dataset } from "@/data";
import type { Category } from "@/data/types";
import { employeeName } from "@/logic/comparison";
import { claimStatusLabel, formatSubmitted, formatUsd, initials } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import type { Section } from "@/logic/sections";
import { cx } from "@/utils/cx";

type IconType = FC<{ className?: string; "aria-hidden"?: boolean }>;

const CATEGORY_ICON: Record<Category, IconType> = {
  meals: Utensils,
  travel_air: Plane,
  travel_ground: Car01,
  lodging: BedDouble,
  conference_training: PresentationChart01,
  entertainment: Ticket01,
  software: Browser,
  equipment: Laptop01,
  other: Receipt,
};

type Props = {
  sections: Section[];
  expanded: Set<string>;
  onToggleSection: (id: string) => void;
  selectedIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onReview: (id: string) => void;
};

function statusColor(claim: LocalClaim): "warning" | "success" | "gray" {
  if (claim.status === "waiting_on_noa") return "warning";
  if (claim.status === "approved_by_agent" || claim.status === "approved_by_noa") return "success";
  return "gray";
}

export function ClaimsTable({ sections, expanded, onToggleSection, selectedIds, activeId, onToggle, onToggleAll, onReview }: Props) {
  // Selection is controlled by the parent. Diff the new key set against it and report the change.
  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      onToggleAll(true);
      return;
    }
    const next = new Set([...keys].map(String));
    const added = [...next].filter((id) => !selectedIds.has(id));
    const removed = [...selectedIds].filter((id) => !next.has(id));
    if (removed.length > 1 && added.length === 0) {
      onToggleAll(false);
      return;
    }
    added.forEach((id) => onToggle(id, true));
    removed.forEach((id) => onToggle(id, false));
  };

  const sectionIds = sections.filter((section) => section.label).map((section) => sectionKey(section.id));

  return (
    <TableCard.Root className="rounded-xl">
      <Table
        aria-label="Claims"
        className="table-fixed"
        selectionMode="multiple"
        selectionBehavior="toggle"
        selectedKeys={selectedIds}
        onSelectionChange={handleSelectionChange}
        disabledKeys={sectionIds}
        disabledBehavior="selection"
      >
        <Table.Header>
          <Table.Head id="employee" isRowHeader label="Employee" className="w-[24%]" />
          <Table.Head id="submitted" label="Submitted" className="w-[19%]" />
          <Table.Head id="category" label="Category" className="w-[19%]" />
          <Table.Head id="amount" className="w-[12%]">
            <span className="w-full text-right text-xs font-semibold whitespace-nowrap text-quaternary">Amount</span>
          </Table.Head>
          <Table.Head id="status" label="Status" className="w-[18%]" />
          <Table.Head id="actions" className="w-28 pr-5">
            <span className="sr-only">Actions</span>
          </Table.Head>
        </Table.Header>
        <Table.Body>
          {sections.map((section) => {
            const collapsed = Boolean(section.collapsible) && !expanded.has(section.id);
            return (
              <SectionRows key={section.id} section={section} collapsed={collapsed} onToggleSection={onToggleSection} activeId={activeId} onReview={onReview} />
            );
          })}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}

const sectionKey = (id: string) => `section:${id}`;

function SectionRows({
  section,
  collapsed,
  onToggleSection,
  activeId,
  onReview,
}: {
  section: Section;
  collapsed: boolean;
  onToggleSection: (id: string) => void;
  activeId: string | null;
  onReview: (id: string) => void;
}) {
  return (
    <>
      {section.label ? (
        <AriaRow id={sectionKey(section.id)} className="bg-secondary">
          <AriaCell colSpan={7} className="px-5 py-2 text-xs font-semibold tracking-wide text-tertiary">
            {section.collapsible ? (
              <Button
                color="tertiary"
                size="sm"
                className="-ml-2 h-7 px-2 text-xs font-semibold tracking-wide"
                aria-expanded={!collapsed}
                onPress={() => onToggleSection(section.id)}
                iconLeading={collapsed ? ChevronRight : ChevronDown}
              >
                {section.label}, {section.claims.length} {collapsed ? "HIDDEN" : "SHOWN"}
              </Button>
            ) : (
              section.label
            )}
          </AriaCell>
        </AriaRow>
      ) : null}
      {collapsed
        ? null
        : section.claims.map((claim) => {
            const name = employeeName(claim);
            const Icon = CATEGORY_ICON[claim.category];
            const active = activeId === claim.id;
            return (
              <Table.Row
                key={claim.id}
                id={claim.id}
                data-state={active ? "selected" : undefined}
                highlightSelectedRow={false}
                aria-label={`Select claim ${claim.id} from ${name}`}
                className={cx("h-[72px] cursor-pointer", active && "bg-brand-primary shadow-[inset_3px_0_0_var(--color-bg-brand-solid)]")}
                onAction={() => onReview(claim.id)}
              >
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" initials={initials(name)} />
                    <span className="truncate font-medium text-primary">{name}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>{formatSubmitted(claim.submitted_at)}</Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden className="size-4 shrink-0 text-fg-quaternary" />
                    <span className="truncate">{dataset.enums.category[claim.category]}</span>
                  </div>
                </Table.Cell>
                <Table.Cell className="text-right font-medium tabular-nums text-primary">{formatUsd(claim.amount.usd_claimed)}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1">
                    <Badge type="pill-color" size="sm" color={statusColor(claim)}>
                      {claimStatusLabel(claim)}
                    </Badge>
                    {claim.local?.spot_checked ? (
                      <Badge type="pill-color" size="sm" color="gray">
                        Reviewed
                      </Badge>
                    ) : null}
                  </div>
                </Table.Cell>
                <Table.Cell className="pr-5 text-right">
                  <Button color="secondary" size="sm" onPress={() => onReview(claim.id)} aria-label={`Review claim ${claim.id} from ${name}`}>
                    Review
                  </Button>
                </Table.Cell>
              </Table.Row>
            );
          })}
    </>
  );
}
