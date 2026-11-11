import { Clock, Eye, Layers, Map, MessageCircle, Route, Scissors, Search, ShieldCheck, Sparkles, Swords, Telescope, Undo2, Users } from "lucide-react";
import type { WalkthroughStep } from "../components/walkthrough/types";
import type { PlaceId } from "./places";

// The walkthrough's words and where each chip goes, from the Melio Deck.md outline.
// - A plain string is a paragraph; an { icon, text } entry is a bullet with a 16px icon.
// - [text](url) is a link. A link starting with image: opens that image in a lightbox.
//   ?zoom=2 shows it at twice its size; ?vh=90 shows it at 90% of the view height.
// - {timeOfDay} becomes morning, afternoon or evening.
export const walkthroughSteps: WalkthroughStep<PlaceId>[] = [
  {
    title: "Hi, I’m Dave!",
    body: [
      "Welcome to my prototype. I had a lot of fun working on it. I hope this guide finds you well and is useful for showing you context-specific key decisions I made according to the [assignment](https://drive.google.com/file/d/1r-QNwulH0xMJHZLcl8a7fQTgXJSpkK-L/view?usp=sharing). You’ll see little text chips in some steps, these are my way of showing you examples of what I’m talking about.",
    ],
  },
  {
    title: "The story",
    body: [
      { photo: "/walkthrough/melio/noa.jpg", alt: "Noa" },
      { icon: Users, text: "Noa leads a team of marketing creatives at Spotify. She’s a mother of 3, devoted to her family or to herself, but she also has a high bar for her work." },
      { icon: Clock, text: "Last week she and her team went to an offsite in San Francisco that included a music-tech conference and a red hot chili peppers concert. Noa is surprised by the scale and variety of claims in this round. She dreads how long it will take and is bummed out by the receipt chasing." },
    ],
  },
  {
    title: "How I understood the Problem",
    body: [
      { icon: Route, text: "6Qs (authored by Raz Cohen): Problem, Data, Hypothesis, Impact, Who it’s for and how success will be measured." },
      { icon: ShieldCheck, text: "Current risks are rubber stamping approvals or making errors that cost money. The problem is made more complex when considering that she needs to understand the policies, chase down missing receipts and potential employee mistakes among an overload of info." },
    ],
  },
  {
    title: "Research",
    body: [
      { icon: Swords, text: "Competitive Research (Perplexity > Claude) + Market Research (How spend tools overlap with accounting software and ERPs). Looked at the usual suspects (Ramp, Expensify, Brex etc...)" },
      { icon: Layers, text: "Pattern Research (Mobbin)" },
      { icon: Search, text: "User Research (ChatGPT generated research report found top pains are chasing receipts and the time it takes to review and approve reports. Report errors and policy violations were close after that, even when there are workflows in place." },
    ],
  },
  {
    title: "Crafting the Experience",
    body: [
      { icon: Map, text: "UX Artifacts ([Journey Map](image:/walkthrough/melio/journey-map.png?vh=90) skill + User Flows based on research documents)" },
      { icon: Scissors, text: "Wireframing: Researching existing patterns I saw that most of them consisted of a list view and of a panel for triage. I explored a few different directions by hand, trying to rethink the list view and the triage." },
      { icon: Eye, text: "[Wireframe 1](image:/walkthrough/melio/wireframe-1.png)" },
      { icon: Eye, text: "[Wireframe 2](image:/walkthrough/melio/wireframe-2.png)" },
      { icon: Layers, text: "Artifacting: I explored 2 directions:" },
      { icon: Eye, text: "[Triage side panel with all claims in view](image:/walkthrough/melio/triage-side-panel.png), passive AI" },
      { icon: Layers, text: "[Triage card stack](image:/walkthrough/melio/triage-card-stack.png), proactive AI" },
      { icon: MessageCircle, text: "[Triage in Slack](image:/walkthrough/melio/triage-in-slack.png), where Noa would realistically work" },
    ],
  },
  {
    title: "Lowering Approval time",
    body: [
      { icon: Clock, text: "Noa’s and Employees’ biggest pain. I added time markers in a few places to indicate how long someone has been waiting, and how long it took Orvo AI to resolve its queue." },
      { icon: Eye, text: "Part of quick decision making is Noa’s understanding, so quickly digestible information like what decision the AI made and why the AI made the decision it did at the list level makes it clear to Noa without having to go into Review mode." },
    ],
    places: [
      { id: "review-tab", label: "Review Tab" },
      { id: "done-tab", label: "Done Tab" },
      { id: "queue-ai-voice", label: "Claims Queue AI & Voice" },
    ],
  },
  {
    title: "Increasing Clarity",
    body: [
      { icon: Layers, text: "Noa’s previous process of opening an item, checking documentation, comparing to the policy, approving, and going back to the list cost time and overwhelmed her. I distilled information to a comparison mental model where Noa could visually understand at a glance what she needs to drive her decision." },
      { icon: MessageCircle, text: "Proactive clarity is also intentionally designed, intentionally baked into the AI chat experience where Noa can ask questions and get visual cards instead of having to go search for more information." },
    ],
    places: [
      { id: "claims-queue", label: "Claims Queue" },
      { id: "chat-cards", label: "Chat Cards" },
    ],
  },
  {
    title: "What reaches Noa",
    body: [
      { icon: Route, text: "Claims reach Noa if the agent has made attempts to reconcile and hasn’t succeeded, if she has reached out and a certain amount of time has passed since her trying to reconcile or if the agent determines real judgement call is needed by a person due to a close margin." },
      { icon: Eye, text: "If Noa wants to spot check for mistakes she can review the Done items" },
      { icon: Clock, text: "Timing: If an agent chases a receipt, it does so with 24-hour windows. If Noa chases a receipt, 2 days are allowed to pass before the claim appears again in her review queue when she needs to make a decision." },
      { icon: Undo2, text: "If she sees a mistake she can immediately correct the AI" },
    ],
    places: [
      { id: "done-queue", label: "Done Queue" },
      { id: "more-options", label: "More Options" },
    ],
  },
  {
    title: "List view",
    body: [
      { icon: Layers, text: "Tabs: Looking at patterns and just thinking about the process, I looked. I decided on the tabs, names, and order based on the approval process and the most common denominator buckets for those stages of the process." },
    ],
    places: [{ id: "claims-page", label: "Claims page" }],
  },
  {
    title: "User Triage",
    body: [
      { icon: Eye, text: "I chose to display the minimum amount of information on the triage card that would be needed for Noa to make a decision on visual context alone. The policy vs. claim comparison is a visual way to communicate that." },
      { icon: Route, text: "In triage mode, list view cannot be seen. The trade-off here is that the user doesn’t have context of the list view, and if they want to access another item they either have to paginate to it in triage or go back to claims and select it there. I did consider an option that has the list view to the left, but it was explicitly written that Noa’s old process of checking and going back to the list each time was painful." },
    ],
    places: [{ id: "needs-review-triage", label: "Needs review triage" }],
  },
  {
    title: "AI Decisions",
    body: [
      { icon: Sparkles, text: "Existing patterns of AI chat within a dynamic interface showed generative AI has the chat mostly on the left, while AI that helps the user understand visual information is on the right. [View](image:/walkthrough/melio/ai-inspo.png)" },
      { icon: MessageCircle, text: "Voice was designed with the assumption that users would be able to complete tasks quicker by voicing their questions, and by having the AI share visual insights in the chat. The trade-off of this decision is that if users want a manual experience, they will have an extra click into the info panel and then another potential extra click into one of the info panel tabs." },
      { icon: Route, text: "Decisions are based on approval workflows which I assumed are controlled by another role in the company. I decided not to go too deep with explorations here but the flow does assume that approval workflows exist, and ideally the manager should be able to suggest adjustments to workflows." },
    ],
    places: [{ id: "voice-mode", label: "Voice mode" }],
  },
  {
    title: "What I’d do next",
    body: [
      { icon: Route, text: "Logic: I would explore different ways of communicating the logic visually to the user, test those directions and continuously iterate. I would explore more ways of iterating on the learning loop between the manager, the finance dept. and refinining approval workflows." },
      { icon: Telescope, text: "I’m curious to what extent users need the list view. From my pattern research of seeing [Airwallex](image:/walkthrough/melio/airwallex.png?zoom=2) / [Expensify](image:/walkthrough/melio/expensify.png?zoom=2) and others use list views with a side panel for triage, I’d wonder if they would feel that someone is moving their cheese." },
    ],
  },
  {
    title: "Thanks for joining me!",
    body: [
      "Thanks for joining me on this journey! I hope you have a great {timeOfDay} and I really look forward to hearing any thoughts or feedback :)",
    ],
  },
];
