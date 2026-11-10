"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
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
};

export function defaultMessage(spec: ActionSpec, claim: LocalClaim): string {
  if (spec.askMessage === "hold") return "Please send the receipt from the merchant, or a duplicate they can issue.";
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
  const messageMissing = spec.askMessage === "ask" || spec.askMessage === "hold" ? message.trim() === "" : false;
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
    <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && onCancel()}>
      <Modal className="sm:max-w-lg">
        <Dialog aria-label={spec.label} className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-primary">
            {spec.label}
          </h2>
          <p className="text-sm text-tertiary">
            {employeeName(claim)}, {claim.id}, {formatUsd(claimed)} claimed
          </p>
        </div>

        {spec.askAmount ? (
          <Input
            id="action-amount"
            label="Amount to approve (USD)"
            inputMode="decimal"
            autoFocus
            placeholder={formatUsd(claimed)}
            value={amountText}
            isInvalid={touched && Boolean(amountError)}
            hint={touched && amountError ? amountError : `Up to ${formatUsd(claimed)}. The amount is always in USD.`}
            onChange={(value) => {
              setAmountText(value);
              setTouched(true);
            }}
          />
        ) : null}

        {spec.askMessage ? (
          <TextArea
            id="action-message"
            label={spec.askMessage === "decline" ? `Message to ${firstName(claim)} (optional)` : `Message to ${firstName(claim)}`}
            rows={3}
            value={message}
            onChange={setMessage}
          />
        ) : null}

        <PreviewList preview={preview} title="What happens when confirmed" />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button color="secondary" onPress={onCancel}>
            Cancel
          </Button>
          <Button
            color={spec.destructive ? "primary-destructive" : "primary"}
            isDisabled={blocked}
            onPress={() => {
              if (blocked) {
                setTouched(true);
                return;
              }
              onConfirm(input);
            }}
          >
            {spec.askAmount ? (amountError ? "Approve" : `Approve ${formatUsd(amount ?? claimed)}`) : spec.label}
          </Button>
        </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
