import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import type { BonusPattern } from '../../domain/types';
import { useStore } from '../../state/store';

const OPTIONS: { value: BonusPattern; title: string; sub?: string }[] = [
  { value: 'regular', title: 'Yes, on a regular schedule', sub: 'Quarterly or yearly bonus, commissions' },
  { value: 'sometimes', title: "Sometimes, I can't predict it", sub: 'Overtime, gifts, occasional side work' },
  { value: 'none', title: 'No, just my paycheck' },
];

export function Bonuses() {
  const { data, answer } = useStore();
  const navigate = useNavigate();
  const value = data.answers.bonuses;

  return (
    <SetupFrame
      step={2}
      backTo="/setup/pay"
      eyebrow="Question 2"
      title="Do you get bonuses or other extra money?"
      lead="Overtime, commissions, tax refunds and side gigs all count."
      why="Extra money that isn't counted on can't be quietly spent. We keep it out of the everyday plan and ask you where each one should go."
      actions={
        <button type="button" className="btn btn-primary" disabled={value === null} onClick={() => navigate('/setup/ahead')}>
          Continue
        </button>
      }
    >
      {OPTIONS.map((o) => (
        <OptionCard key={o.value} selected={value === o.value} onSelect={() => answer({ bonuses: o.value })} title={o.title} sub={o.sub} />
      ))}
      <div className="card row" style={{ marginTop: 10, alignItems: 'flex-start' }}>
        <span className="iconbox clay">
          <Icon name="info" />
        </span>
        <span className="stack" style={{ gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Here&rsquo;s how we handle extra money</span>
          <span className="muted" style={{ fontSize: 14 }}>
            Your everyday plan only counts on your paycheck. When a bonus lands, we&rsquo;ll ask you where it should go, so it never quietly disappears.
          </span>
        </span>
      </div>
    </SetupFrame>
  );
}
