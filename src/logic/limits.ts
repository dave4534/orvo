/** Hard character limits for product text the prototype shows in small spaces. Pure. */
export const TILE_VALUE_MAX = 20;
export const WHY_NOA_MAX = 80;

/** Clips text to `max` characters, ending in an ellipsis when it is cut. Never longer than `max`. */
export function clipTo(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
