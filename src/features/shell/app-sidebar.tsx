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
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useClaims } from "@/store/claims-store";
import { notInPrototype } from "./not-in-prototype";

type NavItem = { label: string; icon: LucideIcon; active?: boolean };

const MAIN: NavItem[] = [
  { label: "Home", icon: House },
  { label: "Expenses", icon: Receipt, active: true },
  { label: "Reports", icon: ChartColumn },
  { label: "Insights", icon: Lightbulb },
  { label: "Policies", icon: ShieldCheck },
  { label: "Team", icon: Users },
];

const FOOTER: NavItem[] = [
  { label: "Settings", icon: Settings },
  { label: "Support", icon: LifeBuoy },
];


function NavItems({ items, needsReview }: { items: NavItem[]; needsReview: number }) {
  return (
    <SidebarMenu>
      {items.map(({ label, icon: Icon, active }) => (
        <SidebarMenuItem key={label}>
          <SidebarMenuButton
            size="lg"
            isActive={active}
            tooltip={label}
            aria-current={active ? "page" : undefined}
            onClick={active ? undefined : () => notInPrototype(label)}
          >
            <Icon />
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
          </SidebarMenuButton>
          {active && needsReview > 0 ? <SidebarMenuBadge>{needsReview}</SidebarMenuBadge> : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const { claims } = useClaims();
  // Badge on Expenses: claims waiting on Noa, unfiltered (PRD FR-NAV-3).
  const needsReview = claims.filter((c) => c.status === "waiting_on_noa").length;

  return (
    <Sidebar
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      aria-label="Main navigation"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={MAIN} needsReview={needsReview} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavItems items={FOOTER} needsReview={needsReview} />
      </SidebarFooter>
    </Sidebar>
  );
}
