import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsd } from "@/logic/format";
import type { Comparison, Half } from "@/logic/comparison";
import { cn } from "@/lib/utils";

const DOT: Record<Half["tone"], string> = {
  neutral: "bg-muted-foreground",
  good: "bg-success",
  info: "bg-primary",
};

function HalfView({ half }: { half: Half }) {
  return (
    <div className="min-w-0 px-6 py-5">
      <div className="flex items-center gap-2 font-medium text-foreground/80">
        <span aria-hidden className={cn("size-2.5 rounded-full", DOT[half.tone])} />
        {half.label}
      </div>
      {half.amount !== undefined ? (
        <div className="mt-1.5 text-[2.125rem] leading-[2.6rem] font-semibold tracking-tight tabular-nums">
          {formatUsd(half.amount)}
        </div>
      ) : (
        <div className="mt-1.5 text-lg leading-snug font-semibold text-balance">{half.text}</div>
      )}
      {half.sub ? <div className="mt-0.5 text-xs text-muted-foreground">{half.sub}</div> : null}
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
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-success/50" style={{ width: pct(lo) }} />
        <div className="absolute inset-y-0 bg-danger-border/70" style={{ left: pct(lo), width: `${((hi - lo) / scale.max) * 100}%` }} />
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
  return (
    <div>
      {comparison.kind === "identity" && comparison.records ? (
        <div className="px-6 pt-5">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Field</TableHead>
                <TableHead>{comparison.records.leftTitle}</TableHead>
                <TableHead>{comparison.records.rightTitle}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.records.rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="break-words whitespace-normal">{row.left}</TableCell>
                  <TableCell className={cn("break-words whitespace-normal", row.differs && "bg-warning font-semibold text-warning-foreground")}>
                    {row.right}
                    {row.differs ? <span className="sr-only"> (differs)</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_1px_1fr] border-y">
          <HalfView half={comparison.left} />
          <div className="bg-border" />
          <HalfView half={comparison.right} />
        </div>
      )}
      {comparison.scale ? <GapScale scale={comparison.scale} /> : null}
      <p className={cn("px-6 pb-3 text-base font-semibold text-balance", comparison.scale ? "pt-8" : "pt-5")}>{comparison.sentence}</p>
      {comparison.evidence.length > 0 ? (
        <dl className="mx-6 mb-4 flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
          {comparison.evidence.map((e) => (
            <div key={`${e.label}-${e.value}`} className="grid grid-cols-[8.5rem_1fr] gap-3">
              <dt className="text-muted-foreground">{e.label}</dt>
              <dd className="min-w-0 break-words">{e.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
