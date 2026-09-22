import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeChoice } from '../domain/types';

function readChoice(key: string): ThemeChoice {
  try {
    const v = localStorage.getItem(key);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

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

/** @param storageKey where this profile's choice is kept */
export function ThemeProvider({ children, storageKey }: { children: ReactNode; storageKey: string }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readChoice(storageKey));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => apply(choice), [choice]);

  const setChoice = useCallback(
    (c: ThemeChoice) => {
      setChoiceState(c);
      try {
        if (c === 'system') localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, c);
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const value = useMemo<ThemeCtx>(
    () => ({ choice, setChoice, resolved: choice === 'system' ? (systemDark ? 'dark' : 'light') : choice }),
    [choice, setChoice, systemDark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
