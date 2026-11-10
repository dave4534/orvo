import { Sparkle } from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text: string;
  reviewCount: number;
  onDismiss: () => void;
  onReviewAll: () => void;
};

/** The AI brief at the top of a tab. The text and count come from the tab's own brief. */
export function AiBriefBanner({ title, text, reviewCount, onDismiss, onReviewAll }: Props) {
  return (
    <StatusBanner
      icon={<Sparkle />}
      title={title}
      onDismiss={onDismiss}
      actions={reviewCount > 0 ? <Button onClick={onReviewAll}>Review all {reviewCount}</Button> : null}
    >
      {text}
    </StatusBanner>
  );
}
