"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { notInPrototype } from "./not-in-prototype";

function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span aria-hidden className="size-6 rounded-md bg-primary" />
        Orvo
      </div>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="lg" onClick={() => notInPrototype("Ask Orvo AI")}>
          <Sparkles data-icon="inline-start" />
          Ask Orvo AI
        </Button>
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
