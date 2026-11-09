import { Sparkles } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { briefSentence, type DailyBrief } from "@/logic/brief";

type Props = {
  brief: DailyBrief;
  onDismiss: () => void;
  onReviewAll: () => void;
};

export function DailyBriefBanner({ brief, onDismiss, onReviewAll }: Props) {
  return (
    <Alert className="border-info-border bg-info py-4 pl-4 has-data-[slot=alert-action]:pr-64 text-info-foreground">
      <Sparkles />
      <AlertTitle className="text-base">Daily brief, {brief.dateLabel}</AlertTitle>
      <AlertDescription className="text-base text-info-foreground">{briefSentence(brief)}</AlertDescription>
      <AlertAction className="top-1/2 right-4 flex -translate-y-1/2 items-center gap-2">
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
        {brief.needsYou > 0 ? <Button onClick={onReviewAll}>Review all {brief.needsYou}</Button> : null}
      </AlertAction>
    </Alert>
  );
}
