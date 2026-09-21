/**
 * Estimates what lands in the account each paycheck from gross pay, pay
 * frequency, pre-tax deductions, and federal and state taxes.
 *
 * It uses the static tables in data/taxTables.ts and is deliberately simple:
 * standard deduction only, no credits, flat state rates.
 */
import type { PayFrequency, TaxSettings } from './types';
import {
  FEDERAL_BRACKETS,
  MEDICARE_RATE,
  PAYCHECKS_PER_YEAR,
  SOCIAL_SECURITY_RATE,
  SOCIAL_SECURITY_WAGE_BASE,
  STANDARD_DEDUCTION,
  STATE_TAXES,
  type FilingStatus,
} from '../data/taxTables';

export interface EstimateInput {
  gross: number;
  grossUnit: 'year' | 'hour';
  /** Hours in one paycheck, used when `grossUnit` is 'hour'. */
  hoursPerPaycheck: number;
  frequency: PayFrequency;
  stateCode: string;
  filing: FilingStatus;
  /** Percent of gross to a 401(k) or similar, e.g. 4 for 4%. */
  retirementPct: number;
  /** Health insurance premium per paycheck, pre-tax. */
  healthPerPaycheck: number;
}

export interface EstimateLine {
  label: string;
  amount: number;
}

export interface Estimate {
  grossPerPaycheck: number;
  annualGross: number;
  paychecksPerYear: number;
  deductions: EstimateLine[];
  takeHome: number;
  annualTakeHome: number;
  stateApproximate: boolean;
}

/** Progressive tax on `taxable` using `brackets`. */
export function bracketTax(taxable: number, brackets: { upTo: number; rate: number }[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (taxable <= lower) break;
    const slice = Math.min(taxable, b.upTo) - lower;
    tax += slice * b.rate;
    lower = b.upTo;
  }
  return tax;
}

export function estimateTakeHome(input: EstimateInput): Estimate {
  const paychecksPerYear = PAYCHECKS_PER_YEAR[input.frequency];
  const annualGross = input.grossUnit === 'year' ? input.gross : input.gross * input.hoursPerPaycheck * paychecksPerYear;
  const grossPerPaycheck = annualGross / paychecksPerYear;

  const retirement = grossPerPaycheck * (input.retirementPct / 100);
  const health = Math.min(input.healthPerPaycheck, grossPerPaycheck);

  // Health premiums escape both income tax and FICA; retirement escapes income tax only.
  const ficaWages = Math.max(0, grossPerPaycheck - health);
  const incomeTaxable = Math.max(0, grossPerPaycheck - health - retirement);

  const annualTaxable = Math.max(0, incomeTaxable * paychecksPerYear - STANDARD_DEDUCTION[input.filing]);
  const federal = bracketTax(annualTaxable, FEDERAL_BRACKETS[input.filing]) / paychecksPerYear;

  const annualFica = ficaWages * paychecksPerYear;
  const socialSecurity = (Math.min(annualFica, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE) / paychecksPerYear;
  const medicare = ficaWages * MEDICARE_RATE;

  const state = STATE_TAXES.find((s) => s.code === input.stateCode);
  const stateTax = incomeTaxable * (state?.rate ?? 0);

  const deductions: EstimateLine[] = [
    { label: 'Federal income tax', amount: federal },
    { label: 'Social Security', amount: socialSecurity },
    { label: 'Medicare', amount: medicare },
  ];
  if (state && state.rate > 0) deductions.push({ label: `${state.name} state tax`, amount: stateTax });
  if (retirement > 0) deductions.push({ label: `401(k) retirement, ${input.retirementPct}%`, amount: retirement });
  if (health > 0) deductions.push({ label: 'Health insurance', amount: health });

  const takeHome = grossPerPaycheck - deductions.reduce((s, d) => s + d.amount, 0);
  return {
    grossPerPaycheck,
    annualGross,
    paychecksPerYear,
    deductions,
    takeHome,
    annualTakeHome: takeHome * paychecksPerYear,
    stateApproximate: state?.approximate ?? false,
  };
}

export const DEFAULT_TAX: TaxSettings = { stateCode: '', filing: 'single', retirementPct: 0, healthPerPaycheck: 0 };

/** Take-home for `hours` of hourly work in one paycheck, netted with the saved tax settings. */
export function netForHours(rate: number, hours: number, frequency: PayFrequency, tax: TaxSettings | null): number {
  if (rate <= 0 || hours <= 0) return 0;
  const t = tax ?? DEFAULT_TAX;
  const e = estimateTakeHome({
    gross: rate,
    grossUnit: 'hour',
    hoursPerPaycheck: hours,
    frequency,
    stateCode: t.stateCode,
    filing: t.filing,
    retirementPct: t.retirementPct,
    healthPerPaycheck: t.healthPerPaycheck,
  });
  return Math.round(e.takeHome);
}
