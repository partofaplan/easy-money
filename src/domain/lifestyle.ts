/**
 * Turns lifestyle interview answers into a set of envelopes.
 *
 * The weights that come out are relative only. `completeSetup` runs the list
 * through `rescaleBuckets`, which spreads the real paycheck over them, so a
 * budget always adds up no matter which answers were given.
 */
import { BUCKET_CATALOG, FALLBACK_BUCKETS, FALLBACK_SAVINGS_WEIGHT, LIFESTYLE_QUESTIONS, OTHER_WEIGHT } from '../data/lifestyle';
import type { Bucket } from './types';

/** Which answers were picked for each question, by question id. */
export type LifestyleAnswers = Record<string, string[]>;

/** True once every question has something recorded, including "none of these". */
export function lifestyleComplete(answers: LifestyleAnswers | undefined): boolean {
  return LIFESTYLE_QUESTIONS.every((q) => (answers?.[q.id]?.length ?? 0) > 0);
}

/** The first question still unanswered, so a half-finished interview picks up where it stopped. */
export function firstUnansweredStep(answers: LifestyleAnswers | undefined): number {
  const i = LIFESTYLE_QUESTIONS.findIndex((q) => (answers?.[q.id]?.length ?? 0) === 0);
  return i === -1 ? LIFESTYLE_QUESTIONS.length : i;
}

/**
 * Sum the weight each envelope earns across every answer given. An answer that
 * is not in the question's list — "none of these", or one from an older version
 * of the catalogue — simply adds nothing.
 */
function weigh(answers: LifestyleAnswers): Map<string, number> {
  const weights = new Map<string, number>();
  for (const question of LIFESTYLE_QUESTIONS) {
    for (const id of answers[question.id] ?? []) {
      const option = question.options.find((o) => o.id === id);
      for (const add of option?.adds ?? []) {
        weights.set(add.bucket, (weights.get(add.bucket) ?? 0) + add.weight);
      }
    }
  }
  return weights;
}

/**
 * True when nothing the person answered calls for an envelope: no housing, no
 * car, no shopping, "none of these" to the rest. They get a generic starter set,
 * and the summary says so rather than claiming it was built from their answers.
 */
export function answersAddNothing(answers: LifestyleAnswers | undefined): boolean {
  return weigh(answers ?? {}).size === 0;
}

/**
 * The envelopes these answers call for, in catalogue order. Every budget also
 * gets a catch-all and somewhere to save, because extra money is allocated to
 * those two by name.
 */
export function bucketsFromLifestyle(answers: LifestyleAnswers | undefined): Bucket[] {
  const weights = weigh(answers ?? {});
  if (weights.size === 0) for (const f of FALLBACK_BUCKETS) weights.set(f.bucket, f.weight);

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

/**
 * Whether an envelope can be dropped from the summary. The catch-all and the
 * last place to save have to stay: extra money is allocated to them by name,
 * and `rescaleBuckets` puts its rounding remainder in the last envelope.
 */
export function canDrop(kept: Bucket[], id: string): boolean {
  if (id === 'other') return false;
  const bucket = kept.find((b) => b.id === id);
  if (!bucket) return false;
  if (bucket.kind === 'savings' && kept.filter((b) => b.kind === 'savings').length === 1) return false;
  return true;
}

/**
 * Which envelopes were dropped last time, worked out from what these answers
 * suggest against what was actually saved. Only meaningful when the saved list
 * came from the interview: a hand-edited or starter list is left alone, so
 * nothing arrives pre-marked as dropped.
 */
export function droppedFromSaved(answers: LifestyleAnswers | undefined, saved: Bucket[]): Set<string> {
  const known = new Set(BUCKET_CATALOG.map((t) => t.id));
  const fromInterview = lifestyleComplete(answers) && saved.length > 0 && saved.every((b) => known.has(b.id));
  if (!fromInterview) return new Set();
  const kept = new Set(saved.map((b) => b.id));
  return new Set(bucketsFromLifestyle(answers).map((b) => b.id).filter((id) => !kept.has(id)));
}
