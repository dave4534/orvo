import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PersonId, Status } from "@/data/types";
import {
  RANGES,
  STATUS_FILTER_OPTIONS,
  teamMembers,
  type ClaimFilters,
  type RangeId,
} from "@/logic/claims";
import { displayName, STATUS_LABEL } from "@/logic/format";

type Props = {
  filters: ClaimFilters;
  onChange: (next: ClaimFilters) => void;
  onReset: () => void;
  canReset: boolean;
  showStatus: boolean;
};

const RANGE_ITEMS = RANGES.map((r) => ({ value: r.id, label: r.label }));

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ClaimsFilters({ filters, onChange, onReset, canReset, showStatus }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-sm min-w-56 flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search claims"
          placeholder="Search claims"
          className="h-10 bg-card pl-9"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
      </div>

      <Select
        value={filters.range}
        items={RANGE_ITEMS}
        onValueChange={(value) => onChange({ ...filters, range: value as RangeId })}
      >
        <SelectTrigger aria-label="Date range" className="h-10 bg-card px-3">
          <span className="text-muted-foreground">Date range:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGES.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="h-10 bg-card px-3">
              Employee{filters.employees.length > 0 ? ` (${filters.employees.length})` : ""}
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
        <DropdownMenuContent className="min-w-52">
          {teamMembers.map((p) => (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={filters.employees.includes(p.id as PersonId)}
              onCheckedChange={() => onChange({ ...filters, employees: toggle(filters.employees, p.id as PersonId) })}
            >
              {displayName(p)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {showStatus ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="h-10 bg-card px-3">
                Status{filters.statuses.length > 0 ? ` (${filters.statuses.length})` : ""}
                <ChevronDown data-icon="inline-end" />
              </Button>
            }
          />
          <DropdownMenuContent className="min-w-56">
            {STATUS_FILTER_OPTIONS.map((s: Status) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.statuses.includes(s)}
                onCheckedChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}
              >
                {STATUS_LABEL[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Button variant="ghost" className="h-10" onClick={onReset} disabled={!canReset}>
        Reset
      </Button>
    </div>
  );
}
