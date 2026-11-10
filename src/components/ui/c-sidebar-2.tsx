"use client"

import type { ReactNode } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// From the reUI c-sidebar-2 block (installed with `shadcn add @reui/c-sidebar-2`):
// a brand header, a labelled rail of icon buttons, and an account footer. The demo
// data is replaced by props; the structure and classes are the block's.

export interface RailItem {
  id: string
  label: string
  icon: ReactNode
  badge?: number
  isActive?: boolean
  onSelect?: () => void
}

/** A labelled rail of icon buttons that collapses to icons with tooltips. */
export function RailNav({ label, items }: { label?: string; items: RailItem[] }) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                isActive={item.isActive}
                tooltip={item.label}
                aria-current={item.isActive ? "page" : undefined}
                onClick={item.isActive ? undefined : item.onSelect}
              >
                {item.icon}
                <span>{item.label}</span>
              </SidebarMenuButton>
              {item.badge ? <SidebarMenuBadge className="right-3">{item.badge}</SidebarMenuBadge> : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** The block's brand header: a 32px tile with a name and a line under it. Only the tile is left when the rail collapses. */
export function BrandButton({ name, subtitle, onSelect }: { name: string; subtitle: string; onSelect?: () => void }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={name} onClick={onSelect}>
          <span aria-hidden className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg" />
          <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-sidebar-foreground/70 truncate text-xs">{subtitle}</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/** The block's account footer: an avatar with a name and a role. Only the avatar is left when the rail collapses. */
export function AccountButton({ name, role, initials }: { name: string; role: string; initials: string }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={name}>
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-sidebar-foreground/70 truncate text-xs">{role}</span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
