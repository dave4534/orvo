"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { actionPreview, firstName, type ActionInput } from "@/logic/actions";
import { formatUsd } from "@/logic/format";
import type { LocalClaim } from "@/logic/local";
import type { ActionSpec } from "@/logic/recommendations";
import { employeeName } from "@/logic/comparison";
import { PreviewList } from "./preview-list";

const ASK_BY_REASON: Record<string, string> = {
  currency_mismatch: "Add the card fee line, or confirm the amount from the statement.",
  possible_split: "Were these two separate purchases? Please add the invoice details.",
  no_matching_rule: "Was this team event approved in advance? Please add who agreed to it.",
  over_meal_cap: "Add the part over the cap, or give more detail about the bill.",
  over_finance_threshold: "Add why this fare was needed.",
  unusual_amount: "Add more detail on why this was higher than usual.",
  possible_duplicate: "Is this the same trip as the other claim? Please add the ride details.",
};

export function defaultMessage(spec: ActionSpec, claim: LocalClaim): string {
  if (spec.askMessage === "wait") {
    return claim.agent.reason_type === "receipt_unreadable"
      ? "The receipt image can't be read. Please send a clearer copy."
      : "Please send the receipt from the merchant, or a duplicate they can issue.";
  }
  if (spec.askMessage === "ask") return ASK_BY_REASON[claim.agent.reason_type] ?? "Add a few details about this claim.";
  if (spec.askMessage === "decline") return claim.agent.headline;
  return "";
}

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  spec: ActionSpec;
  onConfirm: (input: ActionInput) => void;
  onCancel: () => void;
  /** Wording to start with instead of the standard message, for example what was dictated. */
  initialMessage?: string;
  /** Lets the AI chat confirm the dialog ("send it"). It gets the same check as the Confirm button. */
  registerSubmit?: (submit: (() => boolean) | null) => void;
};

export function ActionDialog({ claim, allClaims, spec, onConfirm, onCancel, initialMessage, registerSubmit }: Props) {
  const claimed = claim.amount.usd_claimed;
  const [amountText, setAmountText] = useState(spec.askAmount ? "" : "");
  const [message, setMessage] = useState(() => initialMessage ?? defaultMessage(spec, claim));
  const [touched, setTouched] = useState(false);

  const typed = Number(amountText.replace(/[$,\s]/g, ""));
  let amountError: string | null = null;
  if (spec.askAmount) {
    if (amountText.trim() === "" || Number.isNaN(typed) || typed <= 0) {
      amountError = "Enter an amount above $0.00. To pay nothing, decline the claim instead.";
    } else if (typed > claimed) {
      amountError = `The amount can't be more than the ${formatUsd(claimed)} claimed.`;
    }
  }

  const amount = spec.askAmount && !amountError ? Math.round(typed * 100) / 100 : spec.input.amount;
  const input: ActionInput = {
    ...spec.input,
    amount,
    message: spec.askMessage ? message.trim() : undefined,
    id: spec.askAmount && amount === claimed ? "approve" : spec.input.id,
  };
  const preview = actionPreview(claim, input, allClaims);
  // Approvals are success actions (green). Everything else keeps the primary yellow.
  const approves = !spec.destructive && (input.to === "approved" || ["approve", "approve_amount", "exception"].includes(input.id));
  const messageMissing = spec.askMessage === "ask" || spec.askMessage === "wait" ? message.trim() === "" : false;
  const blocked = Boolean(amountError) || messageMissing;

  useEffect(() => {
    registerSubmit?.(() => {
      if (blocked) return false;
      onConfirm(input);
      return true;
    });
    return () => registerSubmit?.(null);
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{spec.label}</DialogTitle>
          <DialogDescription>
            {employeeName(claim)}, {claim.id}, {formatUsd(claimed)} claimed
          </DialogDescription>
        </DialogHeader>

        {spec.askAmount ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="action-amount">Amount to approve (USD)</Label>
            <Input
              id="action-amount"
              inputMode="decimal"
              autoFocus
              placeholder={formatUsd(claimed)}
              value={amountText}
              aria-invalid={touched && Boolean(amountError)}
              aria-describedby="action-amount-help"
              onChange={(e) => {
                setAmountText(e.target.value);
                setTouched(true);
              }}
            />
            <p id="action-amount-help" className={touched && amountError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
              {touched && amountError ? amountError : `Up to ${formatUsd(claimed)}. The amount is always in USD.`}
            </p>
          </div>
        ) : null}

        {spec.askMessage ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="action-message">{spec.askMessage === "decline" ? `Message to ${firstName(claim)} (optional)` : `Message to ${firstName(claim)}`}</Label>
            <Textarea id="action-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        ) : null}

        <PreviewList preview={preview} title="What happens when confirmed" />

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={spec.destructive ? "destructive" : "default"}
            className={approves ? "bg-success text-success-foreground hover:bg-success/90" : undefined}
            disabled={blocked}
            onClick={() => {
              if (blocked) {
                setTouched(true);
                return;
              }
              onConfirm(input);
            }}
          >
            {spec.askAmount ? (amountError ? "Approve" : `Approve ${formatUsd(amount ?? claimed)}`) : spec.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
