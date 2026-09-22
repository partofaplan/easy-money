/**
 * Turns lifestyle interview answers into a set of envelopes.
 *
 * The weights that come out are relative only. `completeSetup` runs the list
 * through `rescaleBuckets`, which spreads the real paycheck over them, so a
 * budget always adds up no matter which answers were given.
 */
import { BUCKET_CATALOG, FALLBACK_SAVINGS_WEIGHT, LIFESTYLE_QUESTIONS, NONE_OPTION, OTHER_WEIGHT } from '../data/lifestyle';
import { suggestBuckets } from './plan';
import type { Bucket } from './types';

/** Which answers were picked for each question, by question id. */
export type LifestyleAnswers = Record<string, string[]>;

/** True once every question has something recorded, including "none of these". */
export function lifestyleComplete(answers: LifestyleAnswers | undefined): boolean {
  return LIFESTYLE_QUESTIONS.every((q) => (answers?.[q.id]?.length ?? 0) > 0);
}

/** Sum the weight each envelope earns across every answer given. */
function weigh(answers: LifestyleAnswers): Map<string, number> {
  const weights = new Map<string, number>();
  for (const question of LIFESTYLE_QUESTIONS) {
    for (const id of answers[question.id] ?? []) {
      if (id === NONE_OPTION) continue;
      const option = question.options.find((o) => o.id === id);
      for (const add of option?.adds ?? []) {
        weights.set(add.bucket, (weights.get(add.bucket) ?? 0) + add.weight);
      }
    }
  }
  return weights;
}

/**
 * The envelopes these answers call for, in catalogue order. Every budget also
 * gets a catch-all and somewhere to save, because extra money is allocated to
 * those two by name. Answers that add nothing at all fall back to the starter
 * set rather than leaving someone with two envelopes.
 */
export function bucketsFromLifestyle(answers: LifestyleAnswers | undefined): Bucket[] {
  const weights = weigh(answers ?? {});
  if (weights.size === 0) return suggestBuckets(1000);

  weights.set('other', (weights.get('other') ?? 0) + OTHER_WEIGHT);
  const hasSavings = BUCKET_CATALOG.some((t) => weights.has(t.id) && t.kind === 'savings');
  if (!hasSavings) weights.set('savings', FALLBACK_SAVINGS_WEIGHT);

  return BUCKET_CATALOG.filter((t) => weights.has(t.id)).map((t) => {
    const planned = weights.get(t.id) ?? 0;
    return {
      id: t.id,
      name: t.name,
      planned,
      defaultAmount: planned,
      spent: 0,
      kind: t.kind,
      ...(t.dueDay ? { dueDay: t.dueDay } : {}),
    };
  });
}
