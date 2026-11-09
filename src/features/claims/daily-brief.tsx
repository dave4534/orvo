import { Sparkles } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    <Alert className="border-info-border bg-info py-4 pl-4 has-data-[slot=alert-action]:pr-64 text-info-foreground">
      <Sparkles />
      <AlertTitle className="text-base">{title}</AlertTitle>
      <AlertDescription className="text-base text-info-foreground">{text}</AlertDescription>
      <AlertAction className="top-1/2 right-4 flex -translate-y-1/2 items-center gap-2">
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
        {reviewCount > 0 ? <Button onClick={onReviewAll}>Review all {reviewCount}</Button> : null}
      </AlertAction>
    </Alert>
  );
}
