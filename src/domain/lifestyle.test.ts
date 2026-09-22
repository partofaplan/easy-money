import { describe, expect, it } from 'vitest';
import { bucketsFromLifestyle, canDrop, droppedFromSaved, firstUnansweredStep, lifestyleComplete, type LifestyleAnswers } from './lifestyle';
import { rescaleBuckets } from './plan';
import { BUCKET_CATALOG, LIFESTYLE_QUESTIONS, NONE_OPTION } from '../data/lifestyle';

const names = (answers: LifestyleAnswers) => bucketsFromLifestyle(answers).map((b) => b.name);

/** Says "none of these" to everything, so a test only has to state what it says yes to. */
function sayingNo(overrides: LifestyleAnswers = {}): LifestyleAnswers {
  const answers: LifestyleAnswers = {};
  for (const q of LIFESTYLE_QUESTIONS) answers[q.id] = [NONE_OPTION];
  return { ...answers, ...overrides };
}

describe('bucketsFromLifestyle', () => {
  it('gives a driver a Gas bucket', () => {
    expect(names(sayingNo({ wheels: ['paidoff'] }))).toContain('Gas');
    expect(names(sayingNo({ wheels: ['transit'] }))).not.toContain('Gas');
    expect(names(sayingNo({ wheels: [NONE_OPTION], home: ['rent'] }))).not.toContain('Gas');
  });

  it('gives the household shopper a Groceries bucket and no one else', () => {
    expect(names(sayingNo({ groceries: ['all'] }))).toContain('Groceries');
    // Paired with a yes elsewhere, so this is the real "no groceries" case and not the empty-answers fallback.
    expect(names(sayingNo({ groceries: ['none'], home: ['rent'] }))).not.toContain('Groceries');
  });

  it('splits driving into the payment, the gas and the upkeep', () => {
    expect(names(sayingNo({ wheels: ['payment'] }))).toEqual(expect.arrayContaining(['Car payment', 'Gas', 'Car insurance & upkeep']));
  });

  it('stacks several answers into one envelope instead of several', () => {
    const one = bucketsFromLifestyle(sayingNo({ bills: ['utilities'] })).find((b) => b.id === 'bills');
    const all = bucketsFromLifestyle(sayingNo({ bills: ['utilities', 'phone', 'internet'] })).find((b) => b.id === 'bills');
    expect(all?.planned).toBeGreaterThan(one?.planned ?? 0);
    expect(names(sayingNo({ bills: ['utilities', 'phone', 'internet'] })).filter((n) => n === 'Bills & utilities')).toHaveLength(1);
  });

  it('marks rent and a mortgage as due on the 1st', () => {
    expect(bucketsFromLifestyle(sayingNo({ home: ['rent'] })).find((b) => b.id === 'rent')?.dueDay).toBe(1);
    expect(bucketsFromLifestyle(sayingNo({ home: ['mortgage'] })).find((b) => b.id === 'mortgage')?.dueDay).toBe(1);
  });

  it('always leaves somewhere to save and somewhere to put the rest', () => {
    const buckets = bucketsFromLifestyle(sayingNo({ groceries: ['all'] }));
    expect(buckets.some((b) => b.kind === 'savings')).toBe(true);
    expect(buckets.some((b) => b.id === 'other')).toBe(true);
  });

  it('does not add a second savings envelope when a goal was chosen', () => {
    const buckets = bucketsFromLifestyle(sayingNo({ goals: ['emergency'] }));
    expect(buckets.filter((b) => b.kind === 'savings').map((b) => b.name)).toEqual(['Emergency fund']);
  });

  it('falls back to a plain starter set when every answer adds nothing', () => {
    expect(names(sayingNo())).toContain('Everything else');
    expect(names(sayingNo()).length).toBeGreaterThan(4);
    expect(names({})).toEqual(names(sayingNo()));
  });

  it('only ever produces envelopes the catalogue can describe', () => {
    const known = new Set(BUCKET_CATALOG.map((t) => t.id));
    const everyAnswer: LifestyleAnswers = {};
    for (const q of LIFESTYLE_QUESTIONS) everyAnswer[q.id] = q.options.map((o) => o.id);
    for (const answers of [sayingNo(), everyAnswer, {}]) {
      for (const b of bucketsFromLifestyle(answers)) {
        expect(known).toContain(b.id);
        expect(BUCKET_CATALOG.find((t) => t.id === b.id)?.note).toBeTruthy();
      }
    }
  });

  it('puts the emergency fund first, because extra money goes to the first savings envelope', () => {
    // Mirrors allocateIncome's `buckets.find((b) => b.kind === 'savings')`.
    const buckets = bucketsFromLifestyle(sayingNo({ goals: ['travel', 'goal', 'emergency'] }));
    expect(buckets.find((b) => b.kind === 'savings')?.name).toBe('Emergency fund');
  });

  it('always leaves exactly one catch-all', () => {
    for (const answers of [sayingNo(), sayingNo({ home: ['rent'] }), {}]) {
      expect(bucketsFromLifestyle(answers).filter((b) => b.id === 'other')).toHaveLength(1);
    }
  });

  it('keeps the list in catalogue order, housing first', () => {
    const ids = bucketsFromLifestyle(sayingNo({ home: ['rent'], goals: ['emergency'], groceries: ['all'] })).map((b) => b.id);
    const order = BUCKET_CATALOG.map((t) => t.id);
    expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    expect(ids[0]).toBe('rent');
  });

  it('spreads a real paycheck over whatever set comes out', () => {
    const buckets = bucketsFromLifestyle(sayingNo({ home: ['rent'], wheels: ['paidoff'], groceries: ['all'], dining: ['week'] }));
    const scaled = rescaleBuckets(buckets, 2140);
    expect(scaled.reduce((sum, b) => sum + b.planned, 0)).toBe(2140);
    expect(scaled.every((b) => b.planned === b.defaultAmount)).toBe(true);
  });
});

describe('the question catalogue', () => {
  it('only ever points at envelopes that exist', () => {
    const known = new Set(BUCKET_CATALOG.map((t) => t.id));
    for (const q of LIFESTYLE_QUESTIONS) for (const o of q.options) for (const add of o.adds) expect(known).toContain(add.bucket);
  });

  it('gives every question a way to say no', () => {
    for (const q of LIFESTYLE_QUESTIONS) {
      if (q.multi) continue;
      expect(q.options.some((o) => o.adds.length === 0)).toBe(true);
    }
  });
});

describe('canDrop', () => {
  const buckets = bucketsFromLifestyle(sayingNo({ home: ['rent'], goals: ['emergency', 'travel'] }));

  it('keeps the catch-all and the last place to save', () => {
    expect(canDrop(buckets, 'other')).toBe(false);
    expect(canDrop(buckets, 'rent')).toBe(true);
    // Two savings envelopes, so either may go.
    expect(canDrop(buckets, 'emergency')).toBe(true);
    const oneLeft = buckets.filter((b) => b.id !== 'travel');
    expect(canDrop(oneLeft, 'emergency')).toBe(false);
  });
});

describe('droppedFromSaved', () => {
  const answers = sayingNo({ home: ['rent'], goals: ['emergency'] });

  it('remembers what was dropped last time', () => {
    const suggested = bucketsFromLifestyle(answers);
    const saved = suggested.filter((b) => b.id !== 'rent');
    expect([...droppedFromSaved(answers, saved)]).toEqual(['rent']);
  });

  it('leaves a hand-edited or starter list alone rather than marking it all dropped', () => {
    expect(droppedFromSaved(answers, [])).toEqual(new Set());
    const custom = [{ id: 'bucket_x1', name: 'Boat', planned: 100, defaultAmount: 100, spent: 0, kind: 'spending' as const }];
    expect(droppedFromSaved(answers, custom)).toEqual(new Set());
    expect(droppedFromSaved({ home: ['rent'] }, bucketsFromLifestyle(answers))).toEqual(new Set());
  });
});

describe('firstUnansweredStep', () => {
  it('resumes at the first question with no answer', () => {
    expect(firstUnansweredStep(undefined)).toBe(0);
    expect(firstUnansweredStep({ [LIFESTYLE_QUESTIONS[0].id]: ['rent'] })).toBe(1);
    expect(firstUnansweredStep(sayingNo())).toBe(LIFESTYLE_QUESTIONS.length);
  });
});

describe('lifestyleComplete', () => {
  it('needs an answer to every question', () => {
    expect(lifestyleComplete(undefined)).toBe(false);
    expect(lifestyleComplete({ home: ['rent'] })).toBe(false);
    expect(lifestyleComplete(sayingNo())).toBe(true);
  });
});
