import { StatusBanner } from "@/components/status-banner";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text: string;
  reviewCount: number;
  onDismiss: () => void;
  onReviewAll: () => void;
};

/** Material Icons "WbSunny", filled (Apache 2.0), in the brief yellow. Drawn inline, see docs/exceptions.md. */
function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5.5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
    </svg>
  );
}

/** The AI brief at the top of a tab. The text and count come from the tab's own brief. */
export function AiBriefBanner({ title, text, reviewCount, onDismiss, onReviewAll }: Props) {
  return (
    <StatusBanner
      icon={<SunIcon className="size-5 text-brief" />}
      title={title}
      onDismiss={onDismiss}
      actions={reviewCount > 0 ? <Button onClick={onReviewAll} className="bg-brief text-brief-foreground hover:bg-brief/90">Review all {reviewCount}</Button> : null}
    >
      {text}
    </StatusBanner>
  );
}
