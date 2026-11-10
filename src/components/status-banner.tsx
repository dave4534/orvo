"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  icon: ReactNode;
  tone?: "info" | "destructive";
  title: string;
  children?: ReactNode;
  /** Buttons shown at the right of the text. */
  actions?: ReactNode;
  /** Size of the title. Defaults to text-sm. */
  titleClassName?: string;
  /** Fades and slides in on mount. On by default. */
  animateIn?: boolean;
  /** Draws the icon on its own, with no tinted circle behind it. */
  plainIcon?: boolean;
  /** When set, a dismiss button shows and the banner evaporates before this is called. */
  onDismiss?: () => void;
  className?: string;
};

/**
 * Alert banner: an icon chip, title and text, and an optional dismiss button. Dismissing removes it at once.
 * Composed from the stock Alert and Button. Colors come from the project tokens.
 */
export function StatusBanner({ icon, tone = "info", title, children, actions, plainIcon = false, titleClassName = "text-sm", animateIn = true, onDismiss, className }: Props) {
  const [visible, setVisible] = useState(true);
  const reduce = useReducedMotion();
  const destructive = tone === "destructive";

  return (
    <>
      {visible && (
        <motion.div
          initial={reduce || !animateIn ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className={cn("relative", className)}
        >
          <Alert
            variant={destructive ? "destructive" : "default"}
            className={cn("relative flex items-start gap-3 overflow-hidden rounded-xl border-border/60 bg-card py-3.5 pl-4", onDismiss ? (plainIcon ? "pr-13" : "pr-10") : "pr-4")}
          >
            <div
              aria-hidden
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                plainIcon ? "" : "[&>svg]:size-4",
                plainIcon ? "" : destructive ? "bg-destructive/10 text-destructive" : "bg-info text-info-foreground",
              )}
            >
              {icon}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <AlertTitle className={cn("font-medium tracking-tight", titleClassName)}>{title}</AlertTitle>
              {children ? <AlertDescription className={cn("text-sm", destructive ? "text-destructive/90" : "text-muted-foreground")}>{children}</AlertDescription> : null}
            </div>

            {actions ? <div className="flex shrink-0 items-center gap-2 self-center">{actions}</div> : null}

            {onDismiss ? (
              <Button variant="ghost" size="icon-xs" onClick={() => {
                setVisible(false);
                onDismiss?.();
              }} className="absolute top-3 right-3 shrink-0 rounded-full text-muted-foreground/60 hover:text-foreground">
                <X aria-hidden />
                <span className="sr-only">Dismiss</span>
              </Button>
            ) : null}
          </Alert>
        </motion.div>
      )}
    </>
  );
}
