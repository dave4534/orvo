"use client";

import {
  ChartColumn,
  House,
  LifeBuoy,
  Lightbulb,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { RailNav, type RailItem } from "@/components/ui/c-sidebar-2";
import { Sidebar, SidebarContent, SidebarFooter, SidebarRail } from "@/components/ui/sidebar";
import { useClaims } from "@/store/claims-store";

const MAIN = [
  { id: "home", label: "Home", icon: House },
  { id: "expenses", label: "Expenses", icon: Receipt, active: true },
  { id: "reports", label: "Reports", icon: ChartColumn },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "team", label: "Team", icon: Users },
] as const;

const FOOTER = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "support", label: "Support", icon: LifeBuoy },
] as const;

export function AppSidebar() {
  const { claims } = useClaims();
  // Badge on Expenses: claims waiting on Noa, unfiltered (PRD FR-NAV-3).
  const needsReview = claims.filter((c) => c.status === "waiting_on_noa").length;

  const toRail = (items: readonly { id: string; label: string; icon: typeof House; active?: boolean }[]): RailItem[] =>
    items.map(({ id, label, icon: Icon, active }) => ({
      id,
      label,
      icon: <Icon />,
      isActive: active,
      badge: active && needsReview > 0 ? needsReview : undefined,
    }));

  return (
    <Sidebar
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      aria-label="Main navigation"
    >
      <SidebarContent role="navigation" aria-label="Primary" className="pt-3">
        <RailNav items={toRail(MAIN)} />
      </SidebarContent>

      <SidebarFooter>
        <RailNav items={toRail(FOOTER)} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
