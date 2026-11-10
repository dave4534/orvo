"use client";

import type { ReactNode } from "react";
import { Stars01 } from "@untitledui/icons";

import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useWorkspace } from "@/store/workspace-store";

function TopBar() {
  const { aiOpen, setAiOpen, goHome } = useWorkspace();
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <Button
        color="tertiary"
        size="lg"
        aria-label="Orvo home, go to Expenses"
        onPress={goHome}
        className="-ml-2 gap-2.5 px-2 text-lg font-semibold tracking-tight"
      >
        <span aria-hidden className="size-6 rounded-md bg-brand-solid" />
        Orvo
      </Button>
      <div className="flex items-center gap-4">
        <Tooltip title="Ask Orvo AI">
          <Button
            color="secondary"
            size="lg"
            iconLeading={Stars01}
            aria-label="Ask Orvo AI"
            aria-pressed={aiOpen}
            className={cx(aiOpen && "border-brand bg-brand-primary text-brand-secondary hover:bg-brand-primary hover:text-brand-secondary")}
            onPress={() => setAiOpen(!aiOpen)}
          />
        </Tooltip>
        <div className="flex items-center gap-3">
          <span className="text-sm text-tertiary">Noa Levi</span>
          <Avatar size="md" initials="NL" />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="[--header-height:4rem]">
      <SidebarProvider className="flex min-h-svh flex-col">
        <TopBar />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset className="min-w-0 bg-background">{children}</SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
