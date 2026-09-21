import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export function Brand({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`row ${className}`} style={{ gap: 10, color: 'inherit', textDecoration: 'none' }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="coin" size={20} strokeWidth={2.2} />
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em' }}>Easy Money</span>
    </Link>
  );
}
