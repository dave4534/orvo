"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
  { id: "other", title: "Something else", description: "Describe it, and Orvo learns from it", tag: "other" },
];

const FINDING_TO_OPTION: Record<Finding, OptionId> = { amount: "amount", people: "people", declined_valid: "declined_valid" };

type Props = {
  claim: LocalClaim;
  allClaims: LocalClaim[];
  onConfirm: (input: ActionInput) => void;
  onCancel: () => void;
};

export function FixDialog({ claim, allClaims, onConfirm, onCancel }: Props) {
  const finding = detectFinding(claim, allClaims);
  const [step, setStep] = useState<1 | 2>(finding ? 2 : 1);
  const [option, setOption] = useState<OptionId | null>(finding ? FINDING_TO_OPTION[finding] : null);

  const doc = claim.receipt.document;
  const claimed = claim.amount.usd_claimed;
  const name = firstName(claim);

  // Fix-step state. Defaults come from the receipt, never typed by hand.
  const [amountText, setAmountText] = useState(doc?.total != null ? String(doc.total) : "");
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

  if (option === "amount" || option === "rate") {
    if (Number.isNaN(typed) || typed <= 0) error = "Enter an amount above $0.00.";
    else if (typed > claimed) error = `The amount can't be more than the ${formatUsd(claimed)} approved.`;
    else input = { id: "correct", to: "approved", amount: typed, feedback };
  } else if (option === "people") {
    input =
      peopleChoice === "cap"
        ? { id: "correct", to: "approved", amount: Math.min(capAmount, claimed), feedback }
        : { id: "correct", to: "ask", message: `The receipt shows ${covers} diners but the claim lists ${claim.attendees.count}. Could you explain the difference?`, feedback };
  } else if (option === "declined_valid") {
    input = reverseChoice === "reverse" ? { id: "correct", to: "approved", amount: claimed, feedback } : null;
  } else if (option === "linked") {
    input = { id: "to_finance_both" };
  } else if (option === "other") {
    if (otherText.trim() === "") error = "Describe what went wrong so Orvo can record it.";
    else if (otherOutcome === "approved") {
      if (Number.isNaN(typed) || typed <= 0 || typed > claimed) error = `Enter an amount between $0.01 and ${formatUsd(claimed)}.`;
      else input = { id: "correct", to: "approved", amount: typed, feedback };
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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-xl" aria-label="Fix Orvo's mistake">
        <DialogHeader>
          <DialogTitle>Fix Orvo&apos;s mistake</DialogTitle>
          <DialogDescription>
            {employeeName(claim)}, {claim.id}. Step {step} of 2
          </DialogDescription>
        </DialogHeader>

        <div aria-hidden className="flex gap-1.5">
          <span className="h-1 flex-1 rounded-full bg-primary" />
          <span className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        {step === 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-muted-foreground">Where did Orvo go wrong?</legend>
            <RadioGroup value={option ?? ""} onValueChange={(v) => setOption(v as OptionId)} className="gap-2">
              {OPTIONS.map((o) => (
                <Label
                  key={o.id}
                  htmlFor={`fix-${o.id}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal ${option === o.id ? "border-primary bg-info" : ""}`}
                >
                  <RadioGroupItem id={`fix-${o.id}`} value={o.id} className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="font-semibold">{o.title}</span>
                    <span className="text-xs text-muted-foreground">{o.description}</span>
                  </span>
                  {finding && FINDING_TO_OPTION[finding] === o.id ? <Badge variant="outline" className="ml-auto border-warning-border bg-warning text-warning-foreground">Differs on screen</Badge> : null}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-warning-border bg-warning text-warning-foreground">
                {chosen?.title}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Change
              </Button>
            </div>

            {(option === "amount" || option === "rate") && doc ? (
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border">
                <div className="p-4">
                  <div className="text-xs text-muted-foreground">Receipt total</div>
                  <div className="text-2xl font-semibold tabular-nums">{doc.total != null ? formatUsd(doc.total) : "Unreadable"}</div>
                </div>
                <div className="border-l p-4">
                  <div className="text-xs text-muted-foreground">Orvo approved</div>
                  <div className="text-2xl font-semibold tabular-nums">{formatUsd(claimed)}</div>
                </div>
              </div>
            ) : null}

            {option === "people" && doc ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border">
                  <div className="p-4">
                    <div className="text-xs text-muted-foreground">Covers on the receipt</div>
                    <div className="text-2xl font-semibold">{covers}</div>
                  </div>
                  <div className="border-l p-4">
                    <div className="text-xs text-muted-foreground">Attendees on the claim</div>
                    <div className="text-2xl font-semibold">{claim.attendees.count}</div>
                  </div>
                </div>
                <RadioGroup value={peopleChoice} onValueChange={(v) => setPeopleChoice(v as "cap" | "ask")} className="gap-2">
                  <Label htmlFor="people-cap" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal">
                    <RadioGroupItem id="people-cap" value="cap" className="mt-0.5" />
                    <span>
                      <span className="block font-semibold">Pay up to the cap for {covers} people</span>
                      <span className="text-xs text-muted-foreground">{formatUsd(MEAL_CAP)} × {covers} = {formatUsd(capAmount)}</span>
                    </span>
                  </Label>
                  <Label htmlFor="people-ask" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal">
                    <RadioGroupItem id="people-ask" value="ask" className="mt-0.5" />
                    <span>
                      <span className="block font-semibold">Ask {name} to explain</span>
                      <span className="text-xs text-muted-foreground">The claim goes back to waiting on the employee</span>
                    </span>
                  </Label>
                </RadioGroup>
              </div>
            ) : null}

            {option === "declined_valid" ? (
              <RadioGroup value={reverseChoice} onValueChange={(v) => setReverseChoice(v as "reverse" | "keep")} className="gap-2">
                <Label htmlFor="rev-reverse" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal">
                  <RadioGroupItem id="rev-reverse" value="reverse" className="mt-0.5" />
                  <span>
                    <span className="block font-semibold">Reverse the decline and approve</span>
                    <span className="text-xs text-muted-foreground">Pays {formatUsd(claimed)} to {name}</span>
                  </span>
                </Label>
                <Label htmlFor="rev-keep" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal">
                  <RadioGroupItem id="rev-keep" value="keep" className="mt-0.5" />
                  <span>
                    <span className="block font-semibold">Keep it declined</span>
                    <span className="text-xs text-muted-foreground">Nothing changes</span>
                  </span>
                </Label>
              </RadioGroup>
            ) : null}

            {option === "linked" ? (
              <p className="text-sm text-muted-foreground">
                This sends {claim.id} and its linked claims ({claim.agent.related_claim_ids.join(", ") || "none found"}) to Finance together.
              </p>
            ) : null}

            {(option === "amount" || option === "rate" || (option === "other" && otherOutcome === "approved")) ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fix-amount">New approved amount (USD)</Label>
                <Input id="fix-amount" inputMode="decimal" value={amountText} aria-invalid={touched && Boolean(error)} onChange={(e) => { setAmountText(e.target.value); setTouched(true); }} />
                <p className={touched && error ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                  {touched && error ? error : doc?.total != null && option === "amount" ? "Filled in from the receipt" : `Up to ${formatUsd(claimed)}`}
                </p>
              </div>
            ) : null}

            {option === "other" ? (
              <div className="flex flex-col gap-3">
                <RadioGroup value={otherOutcome} onValueChange={(v) => setOtherOutcome(v as "approved" | "declined" | "ask")} className="flex gap-2">
                  {(["approved", "declined", "ask"] as const).map((o) => (
                    <Label key={o} htmlFor={`other-${o}`} className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border p-3 font-normal">
                      <RadioGroupItem id={`other-${o}`} value={o} />
                      {o === "approved" ? "Approve" : o === "declined" ? "Decline" : `Ask ${name}`}
                    </Label>
                  ))}
                </RadioGroup>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fix-text">What went wrong?</Label>
                  <Textarea id="fix-text" rows={3} value={otherText} onChange={(e) => { setOtherText(e.target.value); setTouched(true); }} />
                  {touched && error && otherText.trim() === "" ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
              </div>
            ) : null}

            {preview ? <PreviewList preview={preview} title="What happens when you confirm" /> : null}

            {option !== "linked" ? (
              <div className="flex items-start gap-3">
                <Checkbox id="fix-tell-orvo" checked={tellOrvo} onCheckedChange={(c) => setTellOrvo(c)} className="mt-0.5" />
                <Label htmlFor="fix-tell-orvo" className="flex flex-col items-start gap-0.5 font-normal">
                  <span className="font-semibold">Tell Orvo AI what went wrong</span>
                  <span className="text-xs text-muted-foreground">Recorded as &quot;{chosen?.tag}&quot; on this claim, so the pattern is on file.</span>
                </Label>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button disabled={!option} onClick={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                disabled={option === "declined_valid" ? false : !input}
                onClick={() => {
                  if (option === "declined_valid" && reverseChoice === "keep") return onCancel();
                  if (!input) return setTouched(true);
                  onConfirm(input);
                }}
              >
                {confirmLabel}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
