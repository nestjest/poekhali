// Display-side economy helpers (mirror of judge.scoring for UI; the judge stays the source of stars).
export const TIPS: Record<number, number> = { 3: 10, 4: 15, 5: 25 };

/** Tips are paid once per star level; a better resubmission pays the difference. */
export function tipsDue(oldStars: number, newStars: number): number {
  let sum = 0;
  for (let s = oldStars + 1; s <= newStars; s++) sum += TIPS[s] ?? 0;
  return sum;
}

export const starsText = (n: number, max = 5) => '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
