"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VAPOR = [
  { left: "10%", size: 9, delay: 0, duration: 0.9, travel: -32 },
  { left: "26%", size: 6, delay: 0.05, duration: 1.05, travel: -46 },
  { left: "44%", size: 11, delay: 0.02, duration: 0.85, travel: -28 },
  { left: "60%", size: 7, delay: 0.09, duration: 1.1, travel: -50 },
  { left: "76%", size: 9, delay: 0.03, duration: 0.95, travel: -38 },
  { left: "90%", size: 6, delay: 0.07, duration: 1, travel: -42 },
];

type Props = {
  icon: ReactNode;
  tone?: "info" | "destructive";
  title: string;
  children?: ReactNode;
  /** Buttons shown at the right of the text. */
  actions?: ReactNode;
  /** When set, a dismiss button shows and the banner evaporates before this is called. */
  onDismiss?: () => void;
  className?: string;
};

/**
 * Alert banner with the layout and the evaporate-on-dismiss motion of shadcn-space alert-08
 * (src/components/shadcn-space/alert/alert-08.tsx): an icon chip, title and text, and a dismiss button.
 * Composed from the stock Alert and Button. Colors come from the project tokens.
 */
export function StatusBanner({ icon, tone = "info", title, children, actions, onDismiss, className }: Props) {
  const [visible, setVisible] = useState(true);
  const reduce = useReducedMotion();
  const destructive = tone === "destructive";

  return (
    <AnimatePresence onExitComplete={onDismiss}>
      {visible && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.03, y: -8, filter: "blur(6px)", transition: { duration: 0.6, ease: "easeOut" } }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className={cn("relative", className)}
        >
          {reduce
            ? null
            : VAPOR.map((dot, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0 }}
                  exit={{
                    opacity: [0, 0.8, 0],
                    y: dot.travel,
                    scale: [0.4, 1, 1.4],
                    filter: ["blur(0px)", "blur(1px)", "blur(3px)"],
                    transition: { duration: dot.duration, delay: dot.delay, ease: "easeOut" },
                  }}
                  className={cn("pointer-events-none absolute bottom-2 rounded-full", destructive ? "bg-destructive/60" : "bg-info-foreground/40")}
                  style={{ left: dot.left, width: dot.size, height: dot.size }}
                />
              ))}

          <Alert
            variant={destructive ? "destructive" : "default"}
            className={cn("relative flex items-start gap-3 overflow-hidden rounded-xl border-border/60 bg-card py-3.5 pl-4", onDismiss ? "pr-10" : "pr-4")}
          >
            <div
              aria-hidden
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4",
                destructive ? "bg-destructive/10 text-destructive" : "bg-info text-info-foreground",
              )}
            >
              {icon}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <AlertTitle className="text-sm font-medium tracking-tight">{title}</AlertTitle>
              {children ? <AlertDescription className={cn("text-sm", destructive ? "text-destructive/90" : "text-muted-foreground")}>{children}</AlertDescription> : null}
            </div>

            {actions ? <div className="flex shrink-0 items-center gap-2 self-center">{actions}</div> : null}

            {onDismiss ? (
              <Button variant="ghost" size="icon-xs" onClick={() => setVisible(false)} className="absolute top-3 right-3 shrink-0 rounded-full text-muted-foreground/60 hover:text-foreground">
                <X aria-hidden />
                <span className="sr-only">Dismiss</span>
              </Button>
            ) : null}
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
