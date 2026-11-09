import raw from "./data.json";
import type { Dataset } from "./types";

// Runtime dataset. Produced by `npm run prep:data`, which strips ground_truth.
export const dataset = raw as unknown as Dataset;

// "Now" is fixed by the data. Never read the real clock (PRD D2).
export const NOW = new Date(dataset.meta.now);
