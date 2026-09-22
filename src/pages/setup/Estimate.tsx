import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { SetupFrame } from '../../components/SetupFrame';
import { STATE_TAXES, TAX_YEAR, type FilingStatus } from '../../data/taxTables';
import { FREQUENCY_LABEL, nextPayday } from '../../domain/plan';
import { estimateTakeHome } from '../../domain/takeHome';
import type { TaxSettings } from '../../domain/types';
import { fmt, fmtSigned } from '../../lib/money';
import { useStore } from '../../state/store';

export function Estimate() {
  const { data, answer } = useStore();
  const navigate = useNavigate();
  const a = data.answers;
  const frequency = a.payFrequency ?? 'biweekly';
  const hourly = a.payType === 'hourly';
  // After setup this page is reached from the app; go back there, not through setup again.
  const done = data.setupComplete ? '/app/plan' : '/setup/ready';

  const [gross, setGross] = useState<number | null>(hourly ? a.hourlyRate : null);
  const [unit, setUnit] = useState<'year' | 'hour'>(hourly ? 'hour' : 'year');
  const [hours, setHours] = useState<number | null>(a.typicalHours ?? defaultHours(frequency));
  const [stateCode, setStateCode] = useState(a.tax?.stateCode ?? '');
  const [filing, setFiling] = useState<FilingStatus>(a.tax?.filing ?? 'single');
  const [retirement, setRetirement] = useState<number | null>(a.tax?.retirementPct ?? null);
  const [health, setHealth] = useState<number | null>(a.tax?.healthPerPaycheck ?? null);

  const estimate = useMemo(() => {
    if (!gross || gross <= 0) return null;
    if (unit === 'hour' && (!hours || hours <= 0)) return null;
    return estimateTakeHome({
      gross,
      grossUnit: unit,
      hoursPerPaycheck: hours ?? 0,
      frequency,
      stateCode,
      filing,
      retirementPct: retirement ?? 0,
      healthPerPaycheck: health ?? 0,
    });
  }, [gross, unit, hours, frequency, stateCode, filing, retirement, health]);

  const rounded = estimate ? Math.round(estimate.takeHome) : 0;
  const perYearLabel = (() => {
    const n = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, irregular: 26 }[frequency];
    return `${n} paychecks a year`;
  })();
  const stateName = STATE_TAXES.find((s) => s.code === stateCode)?.name ?? '';
  const taxSettings: TaxSettings = { stateCode, filing, retirementPct: retirement ?? 0, healthPerPaycheck: health ?? 0 };

  return (
    <SetupFrame
      step={null}
      wide
      stepLabel="Optional · Take-home estimate"
      backTo={done}
      title="Let's work out what actually lands in your account."
      lead="Your pay stub has all of this. A close guess works too."
      why={`We apply the ${TAX_YEAR} federal brackets and standard deduction, Social Security and Medicare, a state rate, and anything taken out before taxes. It's an estimate, not a filing.`}
    >
      <div className="estimate">
        <div className="stack">
          <div className="card stack" style={{ gap: 8 }}>
            <label htmlFor="gross" style={{ fontWeight: 700, fontSize: 14 }}>
              Pay before taxes
            </label>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="grow" style={{ minWidth: 160 }}>
                <MoneyInput id="gross" value={gross} onChange={setGross} placeholder={unit === 'year' ? '76,000' : '22'} />
              </div>
              <div className="seg" role="group" aria-label="Pay unit">
                <button
                  type="button"
                  aria-pressed={unit === 'year'}
                  onClick={() => {
                    if (unit !== 'year') setGross(null);
                    setUnit('year');
                  }}
                >
                  Per year
                </button>
                <button
                  type="button"
                  aria-pressed={unit === 'hour'}
                  onClick={() => {
                    if (unit !== 'hour') setGross(null);
                    setUnit('hour');
                  }}
                >
                  Per hour
                </button>
              </div>
            </div>
            {unit === 'hour' && (
              <div className="field">
                <label htmlFor="hours">Hours in a typical paycheck</label>
                <MoneyInput id="hours" value={hours} onChange={setHours} prefix="" unit="hrs" />
                <span className="small muted">Paid {FREQUENCY_LABEL[frequency]}: about {defaultHours(frequency)} hours for full time.</span>
              </div>
            )}
          </div>

          <div className="card row" style={{ padding: '12px 16px' }}>
            <span className="iconbox">
              <Icon name="calendar" />
            </span>
            <span className="stack grow" style={{ gap: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Paid {FREQUENCY_LABEL[frequency]}</span>
              <span className="small muted" style={{ fontSize: 12 }}>
                From your first answer. {perYearLabel}.
              </span>
            </span>
            <Link to="/setup/pay" className="link small">
              Change
            </Link>
          </div>

          <div className="card grid-2">
            <div className="field">
              <label htmlFor="state">State you live in</label>
              <div className="input">
                <select id="state" value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
                  <option value="">Not sure yet</option>
                  {STATE_TAXES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="filing">Tax filing status</label>
              <div className="input">
                <select id="filing" value={filing} onChange={(e) => setFiling(e.target.value as FilingStatus)}>
                  <option value="single">Single</option>
                  <option value="married">Married, filing jointly</option>
                  <option value="head">Head of household</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card stack">
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Taken out before taxes <span className="muted" style={{ fontWeight: 600 }}>(optional)</span>
              </span>
              <span className="small muted" style={{ fontSize: 12 }}>
                Retirement and health premiums lower your taxable pay.
              </span>
            </span>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="retire">401(k) or retirement</label>
                <MoneyInput id="retire" value={retirement} onChange={setRetirement} prefix="" unit="%" placeholder="0" />
              </div>
              <div className="field">
                <label htmlFor="health">Health insurance, per paycheck</label>
                <MoneyInput id="health" value={health} onChange={setHealth} placeholder="0" />
              </div>
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {estimate ? (
            <>
              <div className="hero">
                <span className="eyebrow">Estimated take-home, each paycheck</span>
                <span className="display amount" style={{ fontSize: 44 }}>
                  {fmt(rounded)}
                </span>
                <span style={{ fontSize: 14, opacity: 0.9 }}>
                  Paid {FREQUENCY_LABEL[frequency]}. About {fmt(estimate.annualTakeHome)} a year in hand from {fmt(estimate.annualGross)}.
                </span>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="eyebrow" style={{ paddingBottom: 8 }}>
                  Where the rest goes
                </span>
                <div className="line" style={{ fontWeight: 700 }}>
                  <span>Pay before taxes</span>
                  <span>{fmt(estimate.grossPerPaycheck)}</span>
                </div>
                {estimate.deductions.map((d) => (
                  <div key={d.label} className="line">
                    <span>{d.label}</span>
                    <span className="muted">{fmtSigned(-d.amount)}</span>
                  </div>
                ))}
                <div className="line total">
                  <span>Lands in your account</span>
                  <span style={{ color: 'var(--accent)' }}>{fmt(rounded)}</span>
                </div>
              </div>
              <div className="row small muted" style={{ alignItems: 'flex-start', padding: '0 4px' }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  <Icon name="info" />
                </span>
                <span>
                  An estimate from {TAX_YEAR} federal rates and the standard deduction
                  {stateName ? `, plus a ${stateName} rate${estimate.stateApproximate ? ' (a typical effective rate, since the state uses brackets)' : ''}` : '. Pick your state for a closer number'}
                  . Your real stub may differ a little. Check it against one when you can.
                </span>
              </div>
              <div className="stack" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    answer(
                      unit === 'hour'
                        ? { paycheckAmount: rounded, tax: taxSettings, payType: 'hourly', hourlyRate: gross, typicalHours: hours }
                        : { paycheckAmount: rounded, tax: taxSettings, payType: 'salary' },
                    );
                    navigate(done);
                  }}
                >
                  {unit === 'hour' ? `Use ${fmt(rounded)} for ${hours} hours` : `Use ${fmt(rounded)} in my budget`}
                </button>
                {unit !== 'hour' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      // Keep the tax details even when the number itself is not used.
                      answer({ tax: taxSettings });
                      navigate(done);
                    }}
                  >
                    Keep my own number
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="card tint stack" style={{ padding: 24 }}>
              <span style={{ fontWeight: 700 }}>Enter your pay to see the estimate.</span>
              <span className="muted" style={{ fontSize: 14 }}>
                It updates as you type. Nothing is saved to your budget until you choose to use it.
              </span>
              <span className="small muted">
                Next payday {data.answers.nextPayday ? `is ${data.answers.nextPayday}` : 'not set'}; the one after is{' '}
                {data.answers.nextPayday ? nextPayday(data.answers.nextPayday, frequency) : 'unknown'}.
              </span>
            </div>
          )}
        </div>
      </div>
    </SetupFrame>
  );
}

/** Full-time hours in one paycheck for a pay frequency. */
function defaultHours(frequency: string): number {
  return { weekly: 40, biweekly: 80, semimonthly: 87, monthly: 173, irregular: 80 }[frequency] ?? 80;
}
