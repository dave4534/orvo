// The places a walkthrough chip can open in this prototype. Each id is handled in the claims
// view (src/features/claims/claims-view.tsx), which listens for the "walkthrough:place" event.
export type PlaceId =
  | "claims-page"
  | "review-tab"
  | "done-tab"
  | "done-queue"
  | "claims-queue"
  | "queue-ai-voice"
  | "chat-cards"
  | "more-options";
