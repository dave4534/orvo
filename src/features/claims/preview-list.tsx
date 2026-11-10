import type { Preview } from "@/logic/actions";

/** Pays / Tells / Finance: what an action changes, shown before it is confirmed (PRD 8.4). */
export function PreviewList({ preview, title }: { preview: Preview; title: string }) {
  const rows: [string, string][] = [
    ["Pays", preview.pays],
    ["Tells", preview.tells],
    ["Finance", preview.finance],
  ];
  return (
    <section aria-label={title} className="rounded-lg border bg-muted/40 p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[4rem_1fr] gap-3">
            <dt className="text-tertiary">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
