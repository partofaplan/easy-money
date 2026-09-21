import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub?: string;
  badge?: string;
  icon?: IconName;
  children?: ReactNode;
}

/** One answer in a single-choice question. A real button, so it is keyboard and screen-reader friendly. */
export function OptionCard({ selected, onSelect, title, sub, badge, icon, children }: Props) {
  return (
    <button type="button" className="option" aria-pressed={selected} onClick={onSelect}>
      {icon && (
        <span className="iconbox">
          <Icon name={icon} />
        </span>
      )}
      <span className="stack grow" style={{ gap: 2 }}>
        <span className="row" style={{ gap: 8 }}>
          <span className="title">{title}</span>
          {badge && <span className="badge">{badge}</span>}
        </span>
        {sub && <span className="sub">{sub}</span>}
        {children}
      </span>
      <span className={`radio ${selected ? 'on' : ''}`}>{selected && <Icon name="check" size={14} strokeWidth={3.5} />}</span>
    </button>
  );
}
