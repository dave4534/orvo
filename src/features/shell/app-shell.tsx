"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useWorkspace } from "@/store/workspace-store";

function TopBar() {
  const { aiOpen, setAiOpen, goHome } = useWorkspace();
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <Button
        variant="ghost"
        aria-label="Orvo home, go to Expenses"
        onClick={goHome}
        className="-ml-2 h-10 gap-2.5 px-2 text-lg font-semibold tracking-tight"
      >
        <span aria-hidden className="size-6 rounded-md bg-primary" />
        Orvo
      </Button>
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Ask Orvo AI"
                aria-pressed={aiOpen}
                className={cn(aiOpen && "border-primary bg-info text-primary hover:bg-info hover:text-primary")}
                onClick={() => setAiOpen(!aiOpen)}
              >
                <Sparkles />
              </Button>
            }
          />
          <TooltipContent>Ask Orvo AI</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Noa Levi</span>
          <Avatar>
            <AvatarFallback>NL</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="[--header-height:4rem]">
      <SidebarProvider className="flex min-h-svh flex-col" style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
        <TopBar />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset className="min-w-0 bg-background">{children}</SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
