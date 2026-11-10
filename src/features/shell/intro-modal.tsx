"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/store/workspace-store";

/** Intro modal. Opens on every landing, already open under the launch splash, so it is there when the splash fades. Demo behaviour: not remembered between visits. */
export function IntroModal() {
  const { setAiOpen } = useWorkspace();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Opened straight after mount, so it is waiting under the splash rather than appearing after it.
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // The walkthrough checks this to sit beneath the modal overlay while it is open.
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.introOpen = "true";
    return () => {
      delete document.documentElement.dataset.introOpen;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  // "Check it out" opens the sidekick: the Ask Orvo AI chat.
  function checkItOut() {
    close();
    setAiOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent initialFocus={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="flex justify-center px-6 pt-6">
          {/* The animated card carousel from the brand kit (Brand/Modal), at 80% of the card width. */}
          <img src="/intro/card-carousel-960.gif" alt="" className="block w-4/5 rounded-md" />
        </div>
        <DialogHeader className="gap-3 px-6 pt-6 pb-2">
          <div>
            <Badge className="border-0 bg-success/15 text-success hover:bg-success/15">New</Badge>
          </div>
          <DialogTitle className="text-xl leading-7">Meet your new claims sidekick</DialogTitle>
          <DialogDescription className="text-base leading-6">
            Your AI-powered assistant helps you make sense of policies, navigate claims, and make confident decisions faster.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end px-6 pt-4 pb-6">
          <Button size="lg" className="bg-brief text-brief-foreground hover:bg-brief/90" onClick={checkItOut}>
            Check it out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
