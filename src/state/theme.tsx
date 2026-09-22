import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeChoice } from '../domain/types';

const CURRENT_KEY = 'easy-money.theme.current';

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  // The pre-paint script in index.html reads this, whichever profile or account is open.
  try {
    if (choice === 'system') localStorage.removeItem(CURRENT_KEY);
    else localStorage.setItem(CURRENT_KEY, choice);
  } catch {
    // ignore
  }
}

interface ThemeCtx {
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
  /** The mode actually on screen, after resolving "system". */
  resolved: 'light' | 'dark';
}

const Ctx = createContext<ThemeCtx | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** The stored choice for whoever is open; the provider applies it and reports changes. */
  choice: ThemeChoice;
  onChange: (c: ThemeChoice) => void;
}

export function ThemeProvider({ children, choice, onChange }: ThemeProviderProps) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMq = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  useEffect(() => apply(choice), [choice]);

  const value = useMemo<ThemeCtx>(
    () => ({ choice, setChoice: onChange, resolved: choice === 'system' ? (systemDark ? 'dark' : 'light') : choice }),
    [choice, onChange, systemDark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
