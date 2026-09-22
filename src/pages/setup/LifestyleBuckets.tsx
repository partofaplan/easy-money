import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import { BUCKET_CATALOG, LIFESTYLE_QUESTIONS, NONE_OPTION, type LifestyleOption } from '../../data/lifestyle';
import { bucketsFromLifestyle, lifestyleComplete, type LifestyleAnswers } from '../../domain/lifestyle';
import { defaultTakeHome, rescaleBuckets } from '../../domain/plan';
import type { Bucket } from '../../domain/types';
import { ordinalDay } from '../../lib/dates';
import { fmt } from '../../lib/money';
import { useStore } from '../../state/store';

const TOTAL = LIFESTYLE_QUESTIONS.length;
const noteFor = (id: string) => BUCKET_CATALOG.find((t) => t.id === id)?.note ?? '';

/**
 * "Choose for me" in full: a short interview about how someone lives, one
 * question at a time, ending in the envelopes those answers call for. Answers
 * are saved as they are given, so leaving and coming back keeps them.
 */
export function LifestyleBuckets() {
  const { data, answer, setBuckets } = useStore();
  const navigate = useNavigate();
  const selections: LifestyleAnswers = data.answers.lifestyle ?? {};
  // Someone coming back to change their buckets lands on the list, not back at question one.
  const [step, setStep] = useState(() => (lifestyleComplete(data.answers.lifestyle) ? TOTAL : 0));

  // Envelopes dropped on the summary. Re-derived on a return visit from the
  // difference between what the answers call for and what was actually saved.
  const [removed, setRemoved] = useState<Set<string>>(() => {
    if (!data.answers.lifestyle || data.buckets.length === 0) return new Set();
    const kept = new Set(data.buckets.map((b) => b.id));
    return new Set(bucketsFromLifestyle(data.answers.lifestyle).map((b) => b.id).filter((id) => !kept.has(id)));
  });

  const suggested = useMemo(() => bucketsFromLifestyle(selections), [selections]);
  const list = suggested.filter((b) => !removed.has(b.id));
  const dropped = suggested.filter((b) => removed.has(b.id));

  // Real amounts once a paycheck is known; on the way through setup it is not yet.
  const paycheck = defaultTakeHome(data.answers);
  const priced = paycheck > 0 && list.length > 0 ? rescaleBuckets(list, paycheck) : null;
  const amountFor = (id: string) => priced?.find((b) => b.id === id)?.planned ?? null;

  const pick = (questionId: string, optionId: string, multi: boolean) => {
    const current = selections[questionId] ?? [];
    let next: string[];
    if (!multi) {
      next = [optionId];
    } else if (optionId === NONE_OPTION) {
      next = [NONE_OPTION];
    } else {
      const without = current.filter((id) => id !== NONE_OPTION);
      next = without.includes(optionId) ? without.filter((id) => id !== optionId) : [...without, optionId];
    }
    answer({ lifestyle: { ...selections, [questionId]: next } });
  };

  const toggleRemoved = (id: string) =>
    setRemoved((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const back = () => (step === 0 ? navigate('/setup/buckets') : setStep(step - 1));

  if (step < TOTAL) {
    const question = LIFESTYLE_QUESTIONS[step];
    const multi = question.multi === true;
    const chosen = selections[question.id] ?? [];
    const options: readonly LifestyleOption[] = multi ? [...question.options, { id: NONE_OPTION, label: 'None of these', adds: [] }] : question.options;

    return (
      <SetupFrame
        step={4}
        backTo="/setup/buckets"
        onBack={back}
        eyebrow={`About you · ${step + 1} of ${TOTAL}`}
        title={question.title}
        lead={question.lead}
        why={question.why}
        actions={
          <button type="button" className="btn btn-primary" disabled={chosen.length === 0} onClick={() => setStep(step + 1)}>
            {step === TOTAL - 1 ? 'See my buckets' : 'Continue'}
          </button>
        }
      >
        {multi && <span className="small muted">Pick as many as apply.</span>}
        {options.map((o) => (
          <OptionCard
            key={o.id}
            multi={multi}
            selected={chosen.includes(o.id)}
            onSelect={() => pick(question.id, o.id, multi)}
            title={o.label}
            sub={o.sub}
          />
        ))}
      </SetupFrame>
    );
  }

  const save = (list: Bucket[]) => setBuckets(list.map((b) => ({ ...b })));

  return (
    <SetupFrame
      step={4}
      backTo="/setup/buckets"
      onBack={back}
      eyebrow="About you · done"
      title={`Here are your ${list.length} buckets.`}
      lead="Built from your answers. Drop any you would rather not track and it rolls into Everything else."
      why={
        list.length > 9
          ? 'That is a long list for a first budget. Anything you drop still gets spent, it just stops being a decision every time.'
          : 'Amounts are suggestions. The first real paycheck is when you find out which ones are too small.'
      }
      actions={
        <button
          type="button"
          className="btn btn-primary"
          disabled={list.length === 0}
          onClick={() => {
            save(list);
            navigate('/setup/ready');
          }}
        >
          Use these buckets
        </button>
      }
    >
      <div className="stack" style={{ gap: 8 }}>
        {list.map((b) => (
          <div key={b.id} className="row card" style={{ padding: '12px 10px 12px 16px', gap: 10 }}>
            <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{b.name}</span>
                {b.kind === 'savings' && <span className="chip small">savings</span>}
                {b.dueDay && <span className="chip small">due the {ordinalDay(b.dueDay)}</span>}
              </span>
              <span className="small muted">{noteFor(b.id)}</span>
            </span>
            {amountFor(b.id) !== null && (
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(amountFor(b.id) as number)}</span>
            )}
            <button type="button" className="icon-btn" aria-label={`Remove ${b.name}`} onClick={() => toggleRemoved(b.id)}>
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>

      {dropped.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <span className="eyebrow">Dropped — tap to put one back</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {dropped.map((b) => (
              <button key={b.id} type="button" className="chip row" style={{ gap: 6 }} aria-label={`Put ${b.name} back`} onClick={() => toggleRemoved(b.id)}>
                {b.name}
                <Icon name="plus" size={14} strokeWidth={2.6} />
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-outline"
        onClick={() => {
          save(list);
          navigate('/setup/buckets/customize');
        }}
      >
        Rename or add my own
      </button>
      <span className="small muted">
        {priced ? 'Amounts come from the paycheck you entered; they change if you change it.' : 'We will suggest an amount for each once we know your paycheck.'}
      </span>
    </SetupFrame>
  );
}
