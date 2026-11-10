"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/store/workspace-store";

// Set once the first-visit intro has been seen. Per viewer, in this browser only.
const SEEN_KEY = "melio-prototype:intro-seen";
// Set by the splash loader when its dissolve has finished (see splash-loader.tsx).
export const SPLASH_DONE_EVENT = "orvo:splash-done";

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "true");
  } catch {
    // Storage is blocked: the intro shows again next time, which is fine.
  }
}

/** First-visit intro. It opens once the launch splash has dissolved, and only the first time in this browser. */
export function IntroModal() {
  const { setAiOpen } = useWorkspace();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alreadySeen()) return;
    const show = () => setOpen(true);
    if (document.documentElement.dataset.splashDone === "true") show();
    window.addEventListener(SPLASH_DONE_EVENT, show);
    return () => window.removeEventListener(SPLASH_DONE_EVENT, show);
  }, []);

  function close() {
    markSeen();
    setOpen(false);
  }

  // "Check it out" opens the sidekick: the Ask Orvo AI chat.
  function checkItOut() {
    close();
    setAiOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="relative aspect-[960/500] w-full overflow-hidden bg-muted">
          {/* The animated card carousel from the brand kit (Brand/Modal). */}
          <img src="/intro/card-carousel-960.gif" alt="" className="size-full object-cover" />
        </div>
        <DialogHeader className="gap-3 px-6 pt-6 pb-2">
          <div>
            <Badge variant="secondary">New</Badge>
          </div>
          <DialogTitle className="text-xl leading-7">Meet your new claims sidekick</DialogTitle>
          <DialogDescription className="text-base leading-6">
            Your AI-powered assistant helps you make sense of policies, navigate claims, and make confident decisions faster.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end px-6 pt-4 pb-6">
          <Button variant="ghost" size="lg" onClick={checkItOut}>
            Check it out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
