"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** How long an action can be undone. Matches the toast's own timeout. */
export const UNDO_MS = 10_000;

type Props = { id: string | number; message: string; onUndo: () => void };

/**
 * A sonner toast whose Undo button drains as the time runs out: a tint covers the button at the start
 * and shrinks from right to left until the toast closes. Hovering the toast pauses the drain.
 * Composed from sonner (toast.custom) and the stock Button.
 */
export function UndoToast({ id, message, onUndo }: Props) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const a = el.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: UNDO_MS, easing: "linear", fill: "forwards" });
    anim.current = a;
    return () => a.cancel();
  }, []);

  return (
    <div
      className="flex w-[356px] max-w-full items-center justify-between gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      onMouseEnter={() => anim.current?.pause()}
      onMouseLeave={() => anim.current?.play()}
    >
      <span>{message}</span>
      <Button
        variant="outline"
        size="sm"
        className="relative shrink-0 overflow-hidden"
        onClick={() => {
          onUndo();
          toast.dismiss(id);
        }}
      >
        <span aria-hidden ref={fillRef} className="absolute inset-0 origin-left bg-foreground/10" />
        <span className="relative">Undo</span>
      </Button>
    </div>
  );
}
