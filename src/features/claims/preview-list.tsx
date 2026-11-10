import type { Preview } from "@/logic/actions";

/** What an action changes, in one plain sentence or two, shown before it is confirmed (PRD 8.4). */
export function PreviewList({ preview, title }: { preview: Preview; title: string }) {
  return (
    <section aria-label={title} className="rounded-card border bg-card p-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="text-sm text-balance">{preview.summary}</p>
    </section>
  );
}
