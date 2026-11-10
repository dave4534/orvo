"use client"

import type { ReactNode } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// From the reUI c-sidebar-2 block (installed with `shadcn add @reui/c-sidebar-2`).
// The block's demo data, brand header and account footer are left out: the app's
// top bar already carries the logo and the signed-in name.

export interface RailItem {
  id: string
  label: string
  icon: ReactNode
  badge?: number
  isActive?: boolean
  onSelect?: () => void
}

/** A rail of icon buttons that collapses to icons with tooltips. */
export function RailNav({ label, items }: { label?: string; items: RailItem[] }) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                size="lg"
                isActive={item.isActive}
                tooltip={item.label}
                aria-current={item.isActive ? "page" : undefined}
                onClick={item.isActive ? undefined : item.onSelect}
              >
                {item.icon}
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </SidebarMenuButton>
              {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
