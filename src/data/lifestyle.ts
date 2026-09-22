/**
 * The lifestyle interview behind "Choose for me": a short run of questions about
 * how someone actually lives, and the envelopes each answer creates.
 *
 * Weights are points out of roughly 1000 for a whole paycheck. They are only
 * ever relative — `rescaleBuckets` spreads the real paycheck over whatever set
 * comes out — so adding a question never needs the others re-balanced.
 */
import type { Bucket } from '../domain/types';

export interface BucketTemplate {
  id: string;
  name: string;
  kind: Bucket['kind'];
  /** Day of the month this is usually due. Shown as a reminder; the user can change it. */
  dueDay?: number;
  /** One line on the summary saying what the envelope is for. */
  note: string;
}

/** Every envelope the interview can create, in the order they should be shown. */
export const BUCKET_CATALOG: readonly BucketTemplate[] = [
  { id: 'rent', name: 'Rent', kind: 'spending', dueDay: 1, note: 'Your biggest bill, due at the start of the month.' },
  { id: 'mortgage', name: 'Mortgage', kind: 'spending', dueDay: 1, note: 'Your biggest bill, due at the start of the month.' },
  { id: 'bills', name: 'Bills & utilities', kind: 'spending', note: 'The bills that arrive whether you think about them or not.' },
  { id: 'groceries', name: 'Groceries', kind: 'spending', note: 'Food you bring home and cook.' },
  { id: 'carpayment', name: 'Car payment', kind: 'spending', note: 'The same amount every month, so it is easy to forget.' },
  { id: 'gas', name: 'Gas', kind: 'spending', note: 'Filling the tank between paychecks.' },
  { id: 'carcare', name: 'Car insurance & upkeep', kind: 'spending', note: 'Insurance, oil changes and the repair that always comes.' },
  { id: 'transit', name: 'Transit & rides', kind: 'spending', note: 'Passes, fares and the occasional ride share.' },
  { id: 'kids', name: 'Kids', kind: 'spending', note: 'Care, school and everything they outgrow.' },
  { id: 'pets', name: 'Pet care', kind: 'spending', note: 'Food, litter and the vet.' },
  { id: 'family', name: 'Helping family', kind: 'spending', note: 'Money you send or spend on people you support.' },
  { id: 'health', name: 'Health & personal care', kind: 'spending', note: 'Copays, prescriptions, the gym, haircuts.' },
  { id: 'debt', name: 'Debt payments', kind: 'spending', note: 'What you send beyond the minimum stays here too.' },
  { id: 'dining', name: 'Eating out', kind: 'spending', note: 'Restaurants, takeout and coffee.' },
  { id: 'fun', name: 'Fun money', kind: 'spending', note: 'Hobbies and going out, with no guilt attached.' },
  { id: 'clothes', name: 'Clothes & shopping', kind: 'spending', note: 'Clothes and the things that are not quite groceries.' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'spending', note: 'Streaming, music and apps that renew on their own.' },
  { id: 'gifts', name: 'Gifts & holidays', kind: 'spending', note: 'A little each paycheck beats a December panic.' },
  // Extra money is allocated to the first savings envelope in this list (see
  // `allocateIncome`), so the emergency fund comes before the other two.
  { id: 'emergency', name: 'Emergency fund', kind: 'savings', note: 'The one that turns an emergency into an inconvenience.' },
  { id: 'goal', name: 'Savings goal', kind: 'savings', note: 'Whatever you are working toward.' },
  { id: 'travel', name: 'Travel', kind: 'savings', note: 'Saved up between trips.' },
  { id: 'savings', name: 'Savings', kind: 'savings', note: 'Money set aside for later.' },
  { id: 'other', name: 'Everything else', kind: 'spending', note: 'The catch-all, so one odd purchase never breaks the budget.' },
];

export interface LifestyleOption {
  id: string;
  label: string;
  sub?: string;
  /** Envelopes this answer feeds, and by how much. Several answers can feed one envelope. */
  adds: { bucket: string; weight: number }[];
}

export interface LifestyleQuestion {
  id: string;
  title: string;
  lead?: string;
  why?: string;
  /** Any number of answers can be picked. A "None of these" choice is added automatically. */
  multi?: boolean;
  options: LifestyleOption[];
}

/** The answer id that means "none of these" on a multiple-choice question. */
export const NONE_OPTION = 'none';

export const LIFESTYLE_QUESTIONS: readonly LifestyleQuestion[] = [
  {
    id: 'home',
    title: 'Where does your housing money go?',
    lead: 'Housing is usually the biggest envelope, so we start there.',
    why: 'Rent and mortgages land on the 1st, so we mark the due date for you. Everything else is sized around what is left.',
    options: [
      { id: 'rent', label: 'I pay rent', adds: [{ bucket: 'rent', weight: 300 }] },
      { id: 'mortgage', label: 'I pay a mortgage', adds: [{ bucket: 'mortgage', weight: 300 }] },
      { id: 'none', label: 'Neither right now', sub: 'Living with family, or the place is paid off.', adds: [] },
    ],
  },
  {
    id: 'wheels',
    title: 'Do you drive?',
    lead: 'Driving costs land in three different places, so it helps to split them.',
    why: 'Gas gets spent a little at a time; insurance and repairs arrive all at once. Separate envelopes keep one from eating the other.',
    options: [
      {
        id: 'payment',
        label: 'Yes, and I have a car payment',
        adds: [
          { bucket: 'carpayment', weight: 120 },
          { bucket: 'gas', weight: 60 },
          { bucket: 'carcare', weight: 45 },
        ],
      },
      {
        id: 'paidoff',
        label: 'Yes, the car is paid off',
        adds: [
          { bucket: 'gas', weight: 60 },
          { bucket: 'carcare', weight: 50 },
        ],
      },
      { id: 'transit', label: 'No, I take transit or get around another way', adds: [{ bucket: 'transit', weight: 35 }] },
      { id: 'none', label: 'No driving costs at all', adds: [] },
    ],
  },
  {
    id: 'groceries',
    title: 'Do you buy the groceries in your household?',
    lead: 'Food is the envelope people underestimate most.',
    why: 'Groceries are the easiest place to see a habit change, which is why they get their own envelope instead of hiding inside "food".',
    options: [
      { id: 'all', label: 'Yes, that is me', adds: [{ bucket: 'groceries', weight: 130 }] },
      { id: 'split', label: 'We split the shopping', adds: [{ bucket: 'groceries', weight: 70 }] },
      { id: 'none', label: 'No, someone else handles it', adds: [] },
    ],
  },
  {
    id: 'dining',
    title: 'How often do you eat out or grab coffee?',
    lead: 'Be honest here. This is the number that surprises people.',
    why: 'An envelope for this is not a punishment. It is how you spend on it without wondering whether you should have.',
    options: [
      { id: 'most', label: 'Most days', adds: [{ bucket: 'dining', weight: 95 }] },
      { id: 'week', label: 'A few times a week', adds: [{ bucket: 'dining', weight: 60 }] },
      { id: 'rare', label: 'Once in a while', adds: [{ bucket: 'dining', weight: 25 }] },
      { id: 'none', label: 'Almost never', adds: [] },
    ],
  },
  {
    id: 'bills',
    title: 'Which of these bills are in your name?',
    lead: 'Pick every one you pay.',
    why: 'These share one envelope because they arrive on their own schedule and you rarely change what you spend on them.',
    multi: true,
    options: [
      { id: 'utilities', label: 'Electric, gas or water', adds: [{ bucket: 'bills', weight: 50 }] },
      { id: 'phone', label: 'Phone', adds: [{ bucket: 'bills', weight: 25 }] },
      { id: 'internet', label: 'Internet or cable', adds: [{ bucket: 'bills', weight: 25 }] },
      { id: 'subs', label: 'Streaming, music or app subscriptions', adds: [{ bucket: 'subscriptions', weight: 22 }] },
    ],
  },
  {
    id: 'household',
    title: 'Who else is in your budget?',
    lead: 'Anyone whose costs come out of your paycheck.',
    why: 'These costs are steady but invisible until they are named, and they are the first thing that makes a starter budget wrong.',
    multi: true,
    options: [
      { id: 'kids', label: 'Kids at home', adds: [{ bucket: 'kids', weight: 70 }] },
      { id: 'care', label: 'Daycare or after-school care', adds: [{ bucket: 'kids', weight: 90 }] },
      { id: 'pets', label: 'A pet', adds: [{ bucket: 'pets', weight: 30 }] },
      { id: 'family', label: 'Family I help support', adds: [{ bucket: 'family', weight: 50 }] },
    ],
  },
  {
    id: 'health',
    title: 'Which of these come out of your own pocket?',
    lead: 'Not what your employer covers. What you actually pay for.',
    why: 'They share an envelope because they are all small, regular and easy to forget until the month one of them doubles.',
    multi: true,
    options: [
      { id: 'medical', label: 'Doctor visits, copays or prescriptions', adds: [{ bucket: 'health', weight: 32 }] },
      { id: 'gym', label: 'A gym or fitness membership', adds: [{ bucket: 'health', weight: 20 }] },
      { id: 'personal', label: 'Haircuts and personal care', adds: [{ bucket: 'health', weight: 25 }] },
    ],
  },
  {
    id: 'debt',
    title: 'Are you paying down any debt?',
    lead: 'Just the payments you make each month.',
    why: 'Debt payments get their own envelope so paying extra is a decision you make, not whatever happens to be left over.',
    multi: true,
    options: [
      { id: 'cards', label: 'Credit cards', adds: [{ bucket: 'debt', weight: 60 }] },
      { id: 'student', label: 'Student loans', adds: [{ bucket: 'debt', weight: 60 }] },
      { id: 'loan', label: 'A personal, medical or other loan', adds: [{ bucket: 'debt', weight: 40 }] },
    ],
  },
  {
    id: 'fun',
    title: 'What do you spend on for yourself?',
    lead: 'Every budget that lasts has room in it.',
    why: 'A budget with nothing fun in it is the kind people quit in three weeks.',
    multi: true,
    options: [
      { id: 'hobbies', label: 'Hobbies', adds: [{ bucket: 'fun', weight: 30 }] },
      { id: 'out', label: 'Going out', adds: [{ bucket: 'fun', weight: 35 }] },
      { id: 'clothes', label: 'Clothes and shopping', adds: [{ bucket: 'clothes', weight: 35 }] },
    ],
  },
  {
    id: 'goals',
    title: 'What would you like to put money aside for?',
    lead: 'Last one. Pick anything you want to save toward.',
    why: 'Saving works best as a bill you pay yourself on payday, which is exactly what an envelope makes it.',
    multi: true,
    options: [
      { id: 'emergency', label: 'An emergency fund', sub: 'The one most worth having first.', adds: [{ bucket: 'emergency', weight: 80 }] },
      { id: 'goal', label: 'Something big I am saving up for', adds: [{ bucket: 'goal', weight: 50 }] },
      { id: 'travel', label: 'A trip', adds: [{ bucket: 'travel', weight: 40 }] },
      { id: 'gifts', label: 'Holidays and gifts', adds: [{ bucket: 'gifts', weight: 22 }] },
    ],
  },
];

/** Weight of the catch-all envelope, which every budget gets. */
export const OTHER_WEIGHT = 45;

/** Weight of the plain savings envelope added when no savings goal was picked. */
export const FALLBACK_SAVINGS_WEIGHT = 60;

/**
 * What someone gets when their answers add up to nothing at all: no housing, no
 * car, no shopping, "none of these" to the rest. Two envelopes would be useless,
 * so this is a plain starter set. Drawn from the catalogue like everything else,
 * so the summary can describe each one.
 */
export const FALLBACK_BUCKETS: readonly { bucket: string; weight: number }[] = [
  { bucket: 'groceries', weight: 130 },
  { bucket: 'bills', weight: 50 },
  { bucket: 'dining', weight: 60 },
  { bucket: 'health', weight: 40 },
  { bucket: 'fun', weight: 50 },
  { bucket: 'emergency', weight: 80 },
];
