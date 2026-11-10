"use client";

import { useState } from "react";
import { X } from "@untitledui/icons";

import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import { TextArea } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import { actionPreview, firstName, type ActionInput } from "@/logic/actions";
import { detectFinding, employeeName, type Finding } from "@/logic/comparison";
import { formatUsd } from "@/logic/format";
import { MEAL_CAP, type LocalClaim } from "@/logic/local";
import { PreviewList } from "./preview-list";

type OptionId = "amount" | "people" | "declined_valid" | "linked" | "rate" | "other";

const OPTIONS: { id: OptionId; title: string; description: string; tag: string }[] = [
  { id: "amount", title: "Read the wrong amount", description: "The approved amount doesn't match the receipt", tag: "misread total" },
  { id: "people", title: "Counted the wrong people", description: "Covers or attendees are off", tag: "wrong diner count" },
  { id: "declined_valid", title: "Declined a valid claim", description: "It isn't a duplicate or a rule break", tag: "false duplicate" },
  { id: "linked", title: "Missed a linked claim", description: "Two claims belong together", tag: "missed link" },
  { id: "rate", title: "Used the wrong rate or limit", description: "Currency, category or policy cap", tag: "wrong rate or limit" },
  { id: "other", title: "Something else", description: "Describe it, and it is recorded", tag: "other" },
];

/** Bordered option card around a radio. */
const CARD = "w-full cursor-pointer rounded-xl border border-primary p-3";

const FINDING_TO_OPTION: Record<Finding, OptionId> = { amount: "amount", people: "people", declined_valid: "declined_valid" };

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  onConfirm: (input: ActionInput) => void;
  onCancel: () => void;
};

export function FixDialog({ claim, allClaims, onConfirm, onCancel }: Props) {
  const finding = detectFinding(claim, allClaims);
  // Always start at step 1 (what went wrong). A detected finding only pre-selects its option, so the reader confirms it.
  const [step, setStep] = useState<1 | 2>(1);
  const [option, setOption] = useState<OptionId | null>(finding ? FINDING_TO_OPTION[finding] : null);

  const doc = claim.receipt.document;
  const claimed = claim.amount.usd_claimed;
  const name = firstName(claim);

  // Fix-step state. Defaults come from the receipt, never typed by hand.
  const [amountText, setAmountText] = useState(doc?.total != null ? doc.total.toFixed(2) : "");
  const [peopleChoice, setPeopleChoice] = useState<"cap" | "ask">("cap");
  const [reverseChoice, setReverseChoice] = useState<"reverse" | "keep">("reverse");
  const [otherOutcome, setOtherOutcome] = useState<"approved" | "declined" | "ask">("approved");
  const [otherText, setOtherText] = useState("");
  const [tellOrvo, setTellOrvo] = useState(true);
  const [touched, setTouched] = useState(false);

  const chosen = OPTIONS.find((o) => o.id === option);
  const typed = Math.round(Number(amountText.replace(/[$,\s]/g, "")) * 100) / 100;
  const covers = doc?.covers ?? claim.attendees.count;
  const capAmount = MEAL_CAP * covers;

  // Build the action and its preview for the chosen template.
  let input: ActionInput | null = null;
  let error: string | null = null;
  const feedback = tellOrvo && chosen ? { option: chosen.tag, text: option === "other" ? otherText.trim() || undefined : undefined } : null;

  // The amount being corrected: what is approved now. A correction needs a different amount.
  const approvedNow = claim.noa?.approved_amount_usd ?? claimed;
  const unchanged = !Number.isNaN(typed) && Math.abs(typed - approvedNow) < 0.005;

  if (option === "amount" || option === "rate") {
    if (Number.isNaN(typed) || typed <= 0) error = "Enter an amount above $0.00.";
    else if (typed > claimed) error = `The amount can't be more than the ${formatUsd(claimed)} approved.`;
    else if (!unchanged) input = { id: "correct", to: "approved", amount: typed, feedback };
  } else if (option === "people") {
    const capped = Math.min(capAmount, claimed);
    if (peopleChoice === "cap") {
      // Capping to the amount already approved is no correction.
      if (Math.abs(capped - approvedNow) >= 0.005) input = { id: "correct", to: "approved", amount: capped, feedback };
    } else {
      input = { id: "correct", to: "ask", message: `The receipt shows ${covers} diners but the claim lists ${claim.attendees.count}. Explain the difference.`, feedback };
    }
  } else if (option === "declined_valid") {
    input = reverseChoice === "reverse" ? { id: "correct", to: "approved", amount: claimed, feedback } : null;
  } else if (option === "linked") {
    input = { id: "to_finance_both" };
  } else if (option === "other") {
    if (otherText.trim() === "") error = "Describe what went wrong so it can be recorded.";
    else if (otherOutcome === "approved") {
      if (Number.isNaN(typed) || typed <= 0 || typed > claimed) error = `Enter an amount between $0.01 and ${formatUsd(claimed)}.`;
      else if (!unchanged) input = { id: "correct", to: "approved", amount: typed, feedback };
    } else if (otherOutcome === "declined") input = { id: "correct", to: "declined", feedback };
    else input = { id: "correct", to: "ask", message: otherText.trim(), feedback };
  }

  const preview = input ? actionPreview(claim, input, allClaims) : null;
  const confirmLabel =
    option === "declined_valid"
      ? reverseChoice === "reverse"
        ? `Reverse decline, pay ${formatUsd(claimed)}`
        : "Keep declined"
      : input?.to === "approved" && input.amount !== undefined
        ? `Correct to ${formatUsd(input.amount)}`
        : input?.to === "declined"
          ? "Correct to a decline"
          : input?.to === "ask"
            ? `Ask ${name}`
            : input?.id === "to_finance_both"
              ? "Send both to Finance"
              : "Confirm";

  return (
    <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && onCancel()}>
      <Modal className="sm:max-w-xl">
        <Dialog aria-label="Correct an automatic decision" className="flex flex-col gap-4 p-6">
        <Button color="tertiary" size="sm" aria-label="Close" iconLeading={X} onPress={onCancel} className="absolute top-4 right-4" />
        <div className="flex flex-col gap-1 pr-10">
          <h2 className="text-lg font-semibold text-primary">
            Correct an automatic decision
          </h2>
          <p className="text-sm text-tertiary">
            {employeeName(claim)}, {claim.id}. Step {step} of 2
          </p>
        </div>

        <div aria-hidden className="flex gap-1.5">
          <span className="h-1 flex-1 rounded-full bg-brand-solid" />
          <span className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-brand-solid" : "bg-tertiary"}`} />
        </div>

        {step === 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-tertiary">What went wrong?</legend>
            <RadioGroup aria-label="What went wrong?" value={option} onChange={(v) => setOption(v as OptionId)} className="gap-2">
              {OPTIONS.map((o) => (
                <RadioButton
                  key={o.id}
                  id={`fix-${o.id}`}
                  value={o.id}
                  className={({ isSelected }) => cx(CARD, isSelected && "border-brand bg-brand-primary")}
                  label={
                    <span className="flex items-center gap-2">
                      {o.title}
                      {finding && FINDING_TO_OPTION[finding] === o.id ? <Badge size="sm" color="warning">Differs on screen</Badge> : null}
                    </span>
                  }
                  hint={o.description}
                />
              ))}
            </RadioGroup>
          </fieldset>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Badge color="warning">{chosen?.title}</Badge>
              <Button color="tertiary" size="sm" onPress={() => setStep(1)}>
                Change
              </Button>
            </div>

            {(option === "amount" || option === "rate") && doc ? (
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border">
                <div className="p-4">
                  <div className="text-xs text-tertiary">Receipt total</div>
                  <div className="text-2xl font-semibold tabular-nums">{doc.total != null ? formatUsd(doc.total) : "Unreadable"}</div>
                </div>
                <div className="border-l p-4">
                  <div className="text-xs text-tertiary">Approved automatically</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatUsd(claimed)}</div>
                </div>
              </div>
            ) : null}

            {option === "people" && doc ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border">
                  <div className="p-4">
                    <div className="text-xs text-tertiary">Covers on the receipt</div>
                    <div className="text-2xl font-semibold">{covers}</div>
                  </div>
                  <div className="border-l p-4">
                    <div className="text-xs text-tertiary">Attendees on the claim</div>
                    <div className="text-2xl font-semibold">{claim.attendees.count}</div>
                  </div>
                </div>
                <RadioGroup aria-label="How to correct the cover count" value={peopleChoice} onChange={(v) => setPeopleChoice(v as "cap" | "ask")} className="gap-2">
                  <RadioButton
                    id="people-cap"
                    value="cap"
                    className={CARD}
                    label={`Pay up to the cap for ${covers} people`}
                    hint={`${formatUsd(MEAL_CAP)} × ${covers} = ${formatUsd(capAmount)}`}
                  />
                  <RadioButton
                    id="people-ask"
                    value="ask"
                    className={CARD}
                    label={`Ask ${name} to explain`}
                    hint="The claim goes back to waiting on the employee"
                  />
                </RadioGroup>
              </div>
            ) : null}

            {option === "declined_valid" ? (
              <RadioGroup aria-label="Reverse the decline or keep it" value={reverseChoice} onChange={(v) => setReverseChoice(v as "reverse" | "keep")} className="gap-2">
                <RadioButton
                  id="rev-reverse"
                  value="reverse"
                  className={CARD}
                  label="Reverse the decline and approve"
                  hint={`Pays ${formatUsd(claimed)} to ${name}`}
                />
                <RadioButton id="rev-keep" value="keep" className={CARD} label="Keep it declined" hint="Nothing changes" />
              </RadioGroup>
            ) : null}

            {option === "linked" ? (
              <p className="text-sm text-tertiary">
                This sends {claim.id} and its linked claims ({claim.agent.related_claim_ids.join(", ") || "none found"}) to Finance together.
              </p>
            ) : null}

            {(option === "amount" || option === "rate" || (option === "other" && otherOutcome === "approved")) ? (
              <Input
                id="fix-amount"
                label="New approved amount (USD)"
                inputMode="decimal"
                value={amountText}
                isInvalid={touched && Boolean(error)}
                onChange={(value) => {
                  setAmountText(value);
                  setTouched(true);
                }}
                hint={
                  touched && error
                    ? error
                    : unchanged && (option === "amount" || option === "rate")
                      ? "Same as the approved amount. Enter a different one to correct it."
                      : doc?.total != null && option === "amount"
                        ? "Filled in from the receipt"
                        : `Up to ${formatUsd(claimed)}`
                }
              />
            ) : null}

            {option === "other" ? (
              <div className="flex flex-col gap-3">
                <RadioGroup aria-label="Corrected outcome" value={otherOutcome} onChange={(v) => setOtherOutcome(v as "approved" | "declined" | "ask")} className="flex-row gap-2">
                  {(["approved", "declined", "ask"] as const).map((o) => (
                    <RadioButton
                      key={o}
                      id={`other-${o}`}
                      value={o}
                      className={cx(CARD, "flex-1 items-center")}
                      label={o === "approved" ? "Approve" : o === "declined" ? "Decline" : `Ask ${name}`}
                    />
                  ))}
                </RadioGroup>
                <TextArea
                  id="fix-text"
                  label="What went wrong?"
                  rows={3}
                  value={otherText}
                  onChange={(value) => {
                    setOtherText(value);
                    setTouched(true);
                  }}
                  isInvalid={touched && Boolean(error) && otherText.trim() === ""}
                  hint={touched && error && otherText.trim() === "" ? error : undefined}
                />
              </div>
            ) : null}

            {preview ? <PreviewList preview={preview} title="What happens when confirmed" /> : null}

            {option !== "linked" ? (
              <Checkbox
                id="fix-tell-orvo"
                isSelected={tellOrvo}
                onChange={setTellOrvo}
                label="Submit feedback"
                hint={<>Recorded as &quot;{chosen?.tag}&quot; on this claim, so the pattern is on file.</>}
              />
            ) : null}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {step === 1 ? (
            <>
              <Button color="secondary" onPress={onCancel}>
                Cancel
              </Button>
              <Button isDisabled={!option} onPress={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button color="secondary" onPress={() => setStep(1)}>
                Back
              </Button>
              <Button
                isDisabled={option === "declined_valid" ? false : !input}
                onPress={() => {
                  if (option === "declined_valid" && reverseChoice === "keep") return onCancel();
                  if (!input) return setTouched(true);
                  onConfirm(input);
                }}
              >
                {confirmLabel}
              </Button>
            </>
          )}
        </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
