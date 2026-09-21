import { useNavigate } from 'react-router-dom';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import type { PayFrequency as Freq } from '../../domain/types';
import { useStore } from '../../state/store';

const OPTIONS: { value: Freq; title: string; sub?: string }[] = [
  { value: 'weekly', title: 'Every week' },
  { value: 'biweekly', title: 'Every two weeks', sub: '26 paychecks a year' },
  { value: 'semimonthly', title: 'Twice a month', sub: 'Like the 1st and the 15th' },
  { value: 'monthly', title: 'Once a month' },
  { value: 'irregular', title: 'It varies', sub: 'Tips, gigs, freelance, hourly with changing shifts' },
];

export function PayFrequency() {
  const { data, answer } = useStore();
  const navigate = useNavigate();
  const { payFrequency, nextPayday } = data.answers;
  const ready = payFrequency !== null && !!nextPayday;

  return (
    <SetupFrame
      step={1}
      backTo="/"
      eyebrow="Question 1"
      title="How often do you get paid?"
      lead="This sets the rhythm of your budget. We plan around each paycheck instead of the calendar month."
      why="Budgets built around paychecks are easier to keep than ones built around months, because that's when the money actually shows up."
      actions={
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => navigate('/setup/bonuses')}>
          Continue
        </button>
      }
    >
      {OPTIONS.map((o) => (
        <OptionCard key={o.value} selected={payFrequency === o.value} onSelect={() => answer({ payFrequency: o.value })} title={o.title} sub={o.sub} />
      ))}
      <div className="card stack" style={{ marginTop: 10 }}>
        <label htmlFor="next-payday" style={{ fontWeight: 700, fontSize: 15 }}>
          When is your next payday?
        </label>
        <div className="input">
          <input id="next-payday" type="date" value={nextPayday ?? ''} onChange={(e) => answer({ nextPayday: e.target.value || null })} />
        </div>
        {payFrequency === 'irregular' && (
          <span className="small muted">
            We&rsquo;ll plan two weeks at a time and you can adjust each paycheck as it comes in.
          </span>
        )}
      </div>
    </SetupFrame>
  );
}
