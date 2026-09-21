# Easy Money

A budgeting app for first-time budgeters. Setup is a short interview: how you
get paid, whether you get bonuses, how far ahead you like to plan, and whether
you want to pick your own spending buckets. The app builds a paycheck-based
budget from those answers.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # domain logic tests
npm run build      # typecheck + production build
```

## Proof-of-concept notes

The design and flow are still moving, so nothing here depends on a backend.

- **Seed data is static.** Starter buckets, sample bills, the demo budget and
  the tax tables live in `src/data/`. Change them there.
- **User input stays local.** Answers, buckets, plans and purchases are kept in
  the browser through `LocalStorageRepository` (`src/state/repository.ts`),
  one entry per profile. A server-backed repository only needs the same
  `load`, `save` and `clear`.
- **Profiles are local too.** `src/state/profiles.ts` keeps the list of
  profiles and which one is open; each profile owns its budget and theme.
- **Take-home estimates are estimates.** `src/domain/takeHome.ts` uses the
  approximate 2026 tables in `src/data/taxTables.ts`; states marked
  `approximate` use a typical effective rate rather than real brackets.
- "Start over" on the Settings screen clears everything.

## Layout

| Path | What |
| --- | --- |
| `src/domain/` | Plan building, pay periods, bill placement, take-home math, with tests |
| `src/data/` | Static fixtures and tax tables |
| `src/state/` | Store (React context + reducer), repository, profiles, theme |
| `src/pages/setup/` | The interview: welcome, four questions, summary, estimator |
| `src/pages/app/` | This paycheck, Plan, Ahead, Extra money, Buckets, Settings |
| `src/components/` | Shared pieces: option cards, setup frame, app shell |
| `src/styles/` | Theme tokens (light and dark) and base styles |

Breakpoints: under 720px is the phone layout with bottom tabs; 720 to 1100px is
an icon rail; above 1100px is a sidebar, and the Home screen gains a right rail
with the Ahead and Extra money panels.
