import type * as React from "react";
import { Check } from "lucide-react";

import { FinanceIcon, MealsIcon, ReceiptIcon } from "@/components/icons/policy";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/logic/format";
import type { Comparison, Half } from "@/logic/comparison";
import { policyLabel, type PolicyId } from "@/logic/policy";
import { cn } from "@/lib/utils";

/** Material Icons "Warning", filled (Apache 2.0). Used alone, with no circle behind it. */
function WarningIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
  );
}

const DOT: Record<Half["tone"], string> = {
  neutral: "bg-muted-foreground",
  good: "bg-success",
  info: "bg-primary",
};

/** Same colors as the scale bar: the lower value is the green part, the higher one is the red gap. */
const SCALE_DOT = { low: "bg-success", high: "bg-gap" };

const POLICY_ICON: Record<PolicyId, (props: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  meal_cap: MealsIcon,
  receipt_required: ReceiptIcon,
  finance_over_1000: FinanceIcon,
};

function HalfView({ half, dot }: { half: Half; dot: string }) {
  const PolicyIcon = half.policy ? POLICY_ICON[half.policy] : null;
  return (
    <div className="min-w-0 px-6 py-5">
      <div className="flex items-center gap-2 font-medium text-foreground/80">
        <span aria-hidden className={cn("size-2.5 rounded-full", dot)} />
        {half.label}
      </div>
      {half.amount !== undefined ? (
        <div className="mt-1.5 text-[2.125rem] leading-[2.6rem] font-semibold tracking-tight tabular-nums">
          {formatUsd(half.amount)}
        </div>
      ) : (
        <div className="mt-1.5 text-lg leading-snug font-semibold text-balance">{half.text}</div>
      )}
      {half.policy && PolicyIcon ? (
        // Only the policy: a small solid icon, 2px from its name. The detail of the limit is left out on purpose.
        <div className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground">
          <PolicyIcon className="size-3.5 shrink-0" />
          <span className="font-medium whitespace-nowrap text-foreground/80">{policyLabel(half.policy)}</span>
        </div>
      ) : half.sub ? (
        <div className="mt-1 text-xs text-muted-foreground">{half.sub}</div>
      ) : null}
    </div>
  );
}

/** Numeric scale. Decorative: the gap is always stated in the sentence below it. */
function GapScale({ scale }: { scale: NonNullable<Comparison["scale"]> }) {
  const [a, b] = scale.marks;
  const lo = Math.min(a.value, b.value);
  const hi = Math.max(a.value, b.value);
  const pct = (v: number) => `${(v / scale.max) * 100}%`;
  const loMark = a.value <= b.value ? a : b;
  const hiMark = a.value <= b.value ? b : a;
  return (
    <div aria-hidden className="mx-6 mt-11">
      <div className="relative h-3.5 rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-success" style={{ width: pct(lo) }} />
        <div className="absolute inset-y-0 bg-gap" style={{ left: pct(lo), width: `${((hi - lo) / scale.max) * 100}%` }} />
        <div className="absolute -inset-y-2 w-0.5 bg-foreground" style={{ left: pct(lo) }} />
        <div className="absolute -inset-y-2 w-0.5 bg-foreground" style={{ left: pct(hi) }} />
        <div className="absolute -top-7 -translate-x-1/2 text-xs font-semibold whitespace-nowrap" style={{ left: pct(lo) }}>
          {loMark.label}
        </div>
        <div className="absolute top-[1.375rem] -translate-x-1/2 text-xs font-semibold whitespace-nowrap" style={{ left: pct(hi) }}>
          {hiMark.label}
        </div>
        <div className="absolute top-[1.375rem] left-0 text-[11px] text-muted-foreground">$0</div>
        <div className="absolute -top-7 right-0 text-[11px] text-muted-foreground">{formatUsd(scale.max).replace(".00", "")}</div>
      </div>
    </div>
  );
}

export function ComparisonView({ comparison }: { comparison: Comparison }) {
  const lowIsLeft = (comparison.left.amount ?? 0) <= (comparison.right.amount ?? 0);
  const noGap = comparison.scale ? comparison.left.amount === comparison.right.amount : false;
  // Duplicates: the earlier claim is green (it was paid), this claim is red (it was declined).
  const isDuplicate = comparison.kind === "identity";
  const leftDot = isDuplicate ? SCALE_DOT.low : comparison.scale ? (noGap || lowIsLeft ? SCALE_DOT.low : SCALE_DOT.high) : DOT[comparison.left.tone];
  const rightDot = isDuplicate ? (comparison.matches ? SCALE_DOT.low : SCALE_DOT.high) : comparison.scale ? (noGap || !lowIsLeft ? SCALE_DOT.low : SCALE_DOT.high) : DOT[comparison.right.tone];
  // The amount is already at the top right of the card, so it is never repeated as a tile.
  const evidence = comparison.evidence.filter((e) => !/^amount$/i.test(e.label));
  return (
    <div>
      <div className="grid grid-cols-[1fr_1px_1fr] border-y">
        <HalfView half={comparison.left} dot={leftDot} />
        <div className="bg-border" />
        <HalfView half={comparison.right} dot={rightDot} />
      </div>
      {comparison.scale ? <GapScale scale={comparison.scale} /> : null}
      <p className={cn("flex items-center gap-2 px-6 text-base font-semibold text-balance", evidence.length > 0 ? "pb-0" : "pb-3", comparison.scale ? "pt-11" : "pt-5")}>
        {/* Always an icon before the sentence: a filled green check when it matches, a filled warning when it is an issue. */}
        {comparison.matches === true ? (
          <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : (
          <WarningIcon aria-hidden className="size-5 shrink-0 text-gap" />
        )}
        {comparison.sentence}
      </p>
      {evidence.length > 0 ? (
        // One small card per fact, in a row that wraps. Label above, value below, so each fact can be scanned on its own.
        // Three to a row at most: one fact takes the full width, two take half each.
        <div className={cn("mx-6 mt-3 mb-4 grid gap-3", evidence.length === 1 ? "grid-cols-1" : evidence.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {evidence.map((e) => (
            <Card key={`${e.label}-${e.value}`} size="sm" className="gap-0 bg-muted/40 p-0 shadow-none">
              <CardContent className="flex min-w-0 flex-col gap-1 p-3">
                <span className="text-xs text-muted-foreground">{e.label}</span>
                <span className="text-base leading-snug font-semibold break-words">{e.value}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
