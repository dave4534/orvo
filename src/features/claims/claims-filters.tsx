import { ChevronDown, SearchLg } from "@untitledui/icons";

import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
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

const RANGE_ITEMS = RANGES.map((r) => ({ id: r.id, label: r.label }));

type Selection = "all" | Set<string | number>;

function keysOf(selection: Selection, all: string[]): string[] {
  return selection === "all" ? all : [...selection].map(String);
}

export function ClaimsFilters({ filters, onChange, onReset, canReset, showStatus }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-full max-w-sm min-w-56 flex-1">
        <Input
          type="search"
          aria-label="Search claims"
          placeholder="Search claims"
          icon={SearchLg}
          value={filters.query}
          onChange={(value) => onChange({ ...filters, query: value })}
        />
      </div>

      <div className="flex items-center gap-2 text-md text-tertiary">
        <span>Date range:</span>
        <Select
          aria-label="Date range"
          className="w-44"
          items={RANGE_ITEMS}
          selectedKey={filters.range}
          onSelectionChange={(key) => onChange({ ...filters, range: String(key) as RangeId })}
        >
          {(item) => <Select.Item id={item.id} label={item.label} />}
        </Select>
      </div>

      <Dropdown.Root>
        <Button color="secondary" size="md" iconTrailing={ChevronDown}>
          Employee{filters.employees.length > 0 ? ` (${filters.employees.length})` : ""}
        </Button>
        <Dropdown.Popover className="w-52" placement="bottom left">
          <Dropdown.Menu
            selectionMode="multiple"
            selectedKeys={new Set<string>(filters.employees)}
            onSelectionChange={(sel) => onChange({ ...filters, employees: keysOf(sel, teamMembers.map((p) => p.id)) as PersonId[] })}
          >
            {teamMembers.map((p) => (
              <Dropdown.Item key={p.id} id={p.id} label={displayName(p)} selectionIndicator="checkbox" />
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>

      {showStatus ? (
        <Dropdown.Root>
          <Button color="secondary" size="md" iconTrailing={ChevronDown}>
            Status{filters.statuses.length > 0 ? ` (${filters.statuses.length})` : ""}
          </Button>
          <Dropdown.Popover className="w-56" placement="bottom left">
            <Dropdown.Menu
              selectionMode="multiple"
              selectedKeys={new Set<string>(filters.statuses)}
              onSelectionChange={(sel) => onChange({ ...filters, statuses: keysOf(sel, [...STATUS_FILTER_OPTIONS]) as Status[] })}
            >
              {STATUS_FILTER_OPTIONS.map((s: Status) => (
                <Dropdown.Item key={s} id={s} label={STATUS_LABEL[s]} selectionIndicator="checkbox" />
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      ) : null}

      <Button color="tertiary" size="md" onPress={onReset} isDisabled={!canReset}>
        Reset
      </Button>
    </div>
  );
}
