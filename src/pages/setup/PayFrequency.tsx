import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import type { PayFrequency as Freq } from '../../domain/types';
import { DEFAULT_SEMIMONTHLY, isSemimonthlyPayday, SEMIMONTHLY_PRESETS, semimonthlyPaydaysFrom } from '../../domain/plan';
import { ordinalDay, today } from '../../lib/dates';
import { useStore } from '../../state/store';

const OPTIONS: { value: Freq; title: string; sub?: string }[] = [
  { value: 'weekly', title: 'Every week' },
  { value: 'biweekly', title: 'Every two weeks', sub: '26 paychecks a year' },
  { value: 'semimonthly', title: 'Twice a month', sub: 'The 1st and 15th, the 15th and last day, or any two days' },
  { value: 'monthly', title: 'Once a month' },
  { value: 'irregular', title: 'It varies', sub: 'Tips, gigs, freelance, hourly with changing shifts' },
];

export function PayFrequency() {
  const { data, answer } = useStore();
  const navigate = useNavigate();
  const { payFrequency, nextPayday, semimonthlyDays } = data.answers;
  const days = semimonthlyDays ?? DEFAULT_SEMIMONTHLY;
  const isPreset = SEMIMONTHLY_PRESETS.some((p) => p.days[0] === days[0] && p.days[1] === days[1]);
  const [custom, setCustom] = useState(payFrequency === 'semimonthly' && !isPreset);
  const [sameDay, setSameDay] = useState(false);
  const paydayFitsPattern = payFrequency !== 'semimonthly' || !nextPayday || isSemimonthlyPayday(nextPayday, days);
  const ready = payFrequency !== null && !!nextPayday && paydayFitsPattern;

  /**
   * Choose the two pay days and point the next payday at the first one coming up.
   * A date the user typed is kept when it still fits; `recompute` forces the next one.
   */
  const chooseDays = (next: [number, number], recompute = false) => {
    const upcoming = semimonthlyPaydaysFrom(today(), next, 1)[0] ?? null;
    const keep = !recompute && nextPayday && isSemimonthlyPayday(nextPayday, next);
    answer({ semimonthlyDays: next, nextPayday: keep ? nextPayday : upcoming });
  };

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
        <OptionCard
          key={o.value}
          selected={payFrequency === o.value}
          onSelect={() => {
            answer({ payFrequency: o.value });
            // Moving onto a twice-a-month cadence points the date at a real pay day.
            if (o.value === 'semimonthly') chooseDays(days);
          }}
          title={o.title}
          sub={o.sub}
        />
      ))}
      {payFrequency === 'semimonthly' && (
        <div className="card stack" style={{ marginTop: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Which two days?</span>
          {SEMIMONTHLY_PRESETS.map((p) => (
            <OptionCard
              key={p.label}
              selected={!custom && days[0] === p.days[0] && days[1] === p.days[1]}
              onSelect={() => {
                setCustom(false);
                chooseDays(p.days);
              }}
              title={p.label}
            />
          ))}
          <OptionCard selected={custom} onSelect={() => setCustom(true)} title="Two other days" sub="Pick the days of the month yourself." />
          {custom && (
            <div className="grid-2">
              {[0, 1].map((i) => (
                <div key={i} className="field">
                  <label htmlFor={`payday-${i}`}>{i === 0 ? 'First payday' : 'Second payday'}</label>
                  <div className="input">
                    <select
                      id={`payday-${i}`}
                      value={days[i]}
                      onChange={(e) => {
                        const next: [number, number] = [days[0], days[1]];
                        next[i] = Number(e.target.value);
                        setSameDay(next[0] === next[1]);
                        if (next[0] !== next[1]) chooseDays(next, true);
                      }}
                    >
                      {Array.from({ length: 31 }, (_, d) => d + 1).map((d) => (
                        <option key={d} value={d}>
                          {d === 31 ? 'Last day of the month' : `The ${ordinalDay(d)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
          {sameDay && (
            <span className="small" style={{ color: 'var(--warn-text)', fontWeight: 700 }}>
              Pick two different days.
            </span>
          )}
          <span className="small muted">
            {days[1] === 31 || days[0] === 31 ? 'The last day of the month moves with the month: the 30th, the 31st, or the 28th in February.' : 'Paychecks run from one payday to the day before the next.'}
          </span>
        </div>
      )}
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
        {!paydayFitsPattern && (
          <span className="small" style={{ color: 'var(--warn-text)', fontWeight: 700 }}>
            That date isn&rsquo;t one of your pay days. Pick the next {days[0] === 1 && days[1] === 15 ? '1st or 15th' : `${ordinalDay(days[0])} or ${days[1] === 31 ? 'last day' : ordinalDay(days[1])}`}.
          </span>
        )}
      </div>
    </SetupFrame>
  );
}
