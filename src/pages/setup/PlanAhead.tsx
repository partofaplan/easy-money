import { useNavigate } from 'react-router-dom';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import { horizonCount, payPeriods } from '../../domain/plan';
import type { PlanningHorizon } from '../../domain/types';
import { fmtShort } from '../../lib/dates';
import { useStore } from '../../state/store';

const OPTIONS: { value: PlanningHorizon; title: string; sub: string }[] = [
  { value: 'this', title: 'Just this paycheck', sub: 'One at a time. The simplest place to start.' },
  { value: 'few', title: 'A few paychecks ahead', sub: "See what's coming so big bills don't surprise you." },
  { value: 'month', title: 'The whole month', sub: 'Every paycheck this month, side by side.' },
];

export function PlanAhead() {
  const { data, answer } = useStore();
  const navigate = useNavigate();
  const { horizon, payFrequency, nextPayday } = data.answers;

  const freq = payFrequency ?? 'biweekly';
  const start = nextPayday ?? '2026-09-26';
  const shown = horizon ? horizonCount(horizon, freq, start) : 3;
  const preview = payPeriods(start, freq, 0, Math.max(shown + 1, 4));

  return (
    <SetupFrame
      step={3}
      backTo="/setup/bonuses"
      eyebrow="Question 3"
      title="Do you like to plan your spending a few paychecks ahead?"
      lead="There's no wrong answer. This only changes how much of the future we show you."
      why="Some people feel calmer seeing what's coming; others find it noise. The app shows exactly as much future as you want."
      actions={
        <button type="button" className="btn btn-primary" disabled={horizon === null} onClick={() => navigate('/setup/buckets')}>
          Continue
        </button>
      }
    >
      <div className="card stack">
        <span className="eyebrow">Your view would show</span>
        <div className="row" style={{ gap: 6 }}>
          {preview.map((p, i) => {
            const on = i < shown;
            const first = i === 0;
            return (
              <span
                key={p.payday}
                style={{
                  flexGrow: 1,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: first ? 'var(--accent)' : on ? 'var(--tint)' : 'var(--bg)',
                  color: first ? 'var(--on-accent)' : on ? 'var(--ink)' : 'var(--muted)',
                  border: first ? 'none' : on ? '1.5px solid var(--accent)' : '1.5px dashed var(--ring)',
                }}
              >
                {fmtShort(p.payday)}
              </span>
            );
          })}
        </div>
        <span className="small muted">
          {shown === 1 ? 'Only the paycheck you are in right now.' : `This paycheck plus the next ${shown - 1}, with bills placed where they fall.`}
        </span>
      </div>
      {OPTIONS.map((o) => (
        <OptionCard key={o.value} selected={horizon === o.value} onSelect={() => answer({ horizon: o.value })} title={o.title} sub={o.sub} />
      ))}
    </SetupFrame>
  );
}
