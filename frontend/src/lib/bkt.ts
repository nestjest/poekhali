// Bayesian Knowledge Tracing per skill tag (PROMPT.md §10.7).
export const BKT = { pInit: 0.15, pLearn: 0.2, pSlip: 0.1, pGuess: 0.2, mastery: 0.85 };

export function bktUpdate(p: number | undefined, correct: boolean): number {
  const prior = p ?? BKT.pInit;
  const { pSlip, pGuess, pLearn } = BKT;
  const posterior = correct
    ? (prior * (1 - pSlip)) / (prior * (1 - pSlip) + (1 - prior) * pGuess)
    : (prior * pSlip) / (prior * pSlip + (1 - prior) * (1 - pGuess));
  return posterior + (1 - posterior) * pLearn;
}

export const mastered = (p: number | undefined) => (p ?? BKT.pInit) >= BKT.mastery;
