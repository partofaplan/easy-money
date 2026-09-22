import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { Progress } from './Progress';

interface Props {
  /** 1 to 5, or null for optional side steps like the estimator. */
  step: number | null;
  stepLabel?: string;
  backTo: string;
  /** Step back inside the screen instead of leaving it. `backTo` is the fallback for the first step. */
  onBack?: () => void;
  /**
   * Changes when the question changes without the route changing. Moves focus to
   * the new heading, so a screen reader announces it and the keyboard does not
   * fall back to the top of the page.
   */
  focusKey?: string | number;
  eyebrow?: string;
  title: string;
  lead?: string;
  /** Short "why we ask" shown beside the question on wide screens. */
  why?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Single column on desktop, for screens whose content is already two columns. */
  wide?: boolean;
}

/**
 * The interview frame. One question per screen at every width; on desktop the
 * question sits on the left and the answers on the right.
 */
export function SetupFrame({ step, stepLabel, backTo, onBack, focusKey, eyebrow, title, lead, why, children, actions, wide }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusKey !== undefined) headingRef.current?.focus();
  }, [focusKey]);

  const backIcon = onBack ? (
    <button type="button" className="icon-btn back" aria-label="Back" onClick={onBack}>
      <Icon name="chevronLeft" size={22} strokeWidth={2.2} />
    </button>
  ) : (
    <Link to={backTo} className="icon-btn back" aria-label="Back">
      <Icon name="chevronLeft" size={22} strokeWidth={2.2} />
    </Link>
  );
  const backButton = onBack ? (
    <button type="button" className="btn btn-outline back" onClick={onBack}>
      Back
    </button>
  ) : (
    <Link to={backTo} className="btn btn-outline back">
      Back
    </Link>
  );
  return (
    <div className="setup">
      <header className="setup-top">
        {backIcon}
        <Brand className="brand" />
        <div className="row grow progress-wrap">
          {step !== null ? (
            <>
              <Progress step={step} />
              <span className="small muted" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {step} of 5
              </span>
            </>
          ) : (
            <span className="small muted" style={{ fontWeight: 700 }}>
              {stepLabel}
            </span>
          )}
        </div>
        <Link to="/" className="link save-later small">
          Save and finish later
        </Link>
      </header>

      <div className={`setup-body ${wide ? 'wide' : ''}`}>
        <div className="intro">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 ref={headingRef} tabIndex={focusKey === undefined ? undefined : -1} style={{ marginTop: eyebrow ? 12 : 12, outline: 'none' }}>
            {title}
          </h1>
          {lead && (
            <p className="lead" style={{ marginTop: 12 }}>
              {lead}
            </p>
          )}
          {why && (
            <div className="card tint why" style={{ gap: 14 }}>
              <span className="iconbox" style={{ background: 'var(--card)' }}>
                <Icon name="info" />
              </span>
              <span className="stack" style={{ gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Why we ask</span>
                <span className="muted" style={{ fontSize: 15 }}>
                  {why}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="stack answers" style={{ minHeight: '100%' }}>
          {children}
          <div className="setup-actions">
            {backButton}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
