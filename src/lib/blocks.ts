/**
 * Class strings taken from the installed Studio and shadcn-space blocks, so every badge and tab list shares one look.
 * badge-12 (src/components/shadcn-space/badge): the pill. tabs-26 (src/components/shadcn-studio/tabs): the underline tabs.
 */
export const PILL = "h-auto gap-1.5 rounded-full px-3 py-1 text-sm font-normal";

/**
 * tabs-26 with two changes. The list has no fixed height and the tab has its own vertical padding, so there is room between the
 * text and the line. The active line sits 1px low (not the demo's 0.5px), so it covers the list's gray border exactly instead of
 * floating half a pixel above it.
 */
export const TABS_LIST = "group-data-horizontal/tabs:h-auto gap-0 rounded-none border-b p-0";

export const TABS_TRIGGER =
  "not-data-active:hover:group-data-horizontal/tabs:after:bg-muted-foreground/30 h-auto border-0 py-2.5 text-sm group-data-horizontal/tabs:after:-bottom-px not-data-active:hover:group-data-horizontal/tabs:after:opacity-100";
