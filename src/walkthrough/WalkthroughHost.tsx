"use client";

import { useEffect, useState } from "react";
import { Walkthrough } from "@/components/walkthrough";
import { walkthroughSteps } from "./content";
import type { PlaceId } from "./places";
import "./tokens.css";

// Tells the claims view which place to open. The claims view closes any open panel first.
function showPlace(id: PlaceId) {
  window.dispatchEvent(new CustomEvent("walkthrough:place", { detail: id }));
}

// The Settings item in the sidebar footer. The face starts 52px above it, on its left edge.
function findSettings(): Element | null {
  return [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === "Settings") ?? null;
}

// Mounts the shared walkthrough after the page has loaded in the browser, so the saved
// state is read on the client only and the server and browser render the same page.
export function WalkthroughHost() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Walkthrough
      steps={walkthroughSteps}
      storageKey="melio-prototype:walkthrough"
      onShowPlace={showPlace}
      avatarSrc="/walkthrough/dave.svg"
      inlineGifSrc="/walkthrough/carlton.gif"
      anchorSelector={findSettings}
      anchorGap={52}
      anchorAlignLeft
      autoOpenMs={0}
    />
  );
}
