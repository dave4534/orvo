import { Stars01 } from "@untitledui/icons";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/base/buttons/button";

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
      <Stars01 />
      <AlertTitle className="text-base">{title}</AlertTitle>
      <AlertDescription className="text-base text-info-foreground">{text}</AlertDescription>
      <AlertAction className="top-1/2 right-4 flex -translate-y-1/2 items-center gap-2">
        <Button color="tertiary" size="lg" onPress={onDismiss}>
          Dismiss
        </Button>
        {reviewCount > 0 ? <Button size="lg" onPress={onReviewAll}>Review all {reviewCount}</Button> : null}
      </AlertAction>
    </Alert>
  );
}
