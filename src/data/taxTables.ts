/**
 * Tax tables for the take-home estimator.
 *
 * These are static, approximate figures for tax year 2026 so the estimate can
 * work without a service. They are labeled as estimates in the UI. Update the
 * numbers here when the real tables are confirmed; nothing else needs to change.
 */
import type { PayFrequency } from '../domain/types';

export type FilingStatus = 'single' | 'married' | 'head';

export interface Bracket {
  /** Upper bound of taxable income for this rate; Infinity for the top bracket. */
  upTo: number;
  rate: number;
}

export const TAX_YEAR = 2026;

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16_100,
  married: 32_200,
  head: 24_150,
};

export const FEDERAL_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 12_400, rate: 0.1 },
    { upTo: 50_400, rate: 0.12 },
    { upTo: 105_700, rate: 0.22 },
    { upTo: 201_775, rate: 0.24 },
    { upTo: 256_225, rate: 0.32 },
    { upTo: 640_600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 24_800, rate: 0.1 },
    { upTo: 100_800, rate: 0.12 },
    { upTo: 211_400, rate: 0.22 },
    { upTo: 403_550, rate: 0.24 },
    { upTo: 512_450, rate: 0.32 },
    { upTo: 768_700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head: [
    { upTo: 17_700, rate: 0.1 },
    { upTo: 67_450, rate: 0.12 },
    { upTo: 105_700, rate: 0.22 },
    { upTo: 201_775, rate: 0.24 },
    { upTo: 256_200, rate: 0.32 },
    { upTo: 640_600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

export const SOCIAL_SECURITY_RATE = 0.062;
export const SOCIAL_SECURITY_WAGE_BASE = 184_500;
export const MEDICARE_RATE = 0.0145;

export const PAYCHECKS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  irregular: 26,
};

export interface StateTax {
  code: string;
  name: string;
  /** Flat rate applied to taxable wages. 0 for states with no wage tax. */
  rate: number;
  /**
   * True when the state really uses brackets and this is a typical effective
   * rate for a middle income, not the statutory rate.
   */
  approximate: boolean;
}

export const STATE_TAXES: StateTax[] = [
  { code: 'AL', name: 'Alabama', rate: 0.045, approximate: true },
  { code: 'AK', name: 'Alaska', rate: 0, approximate: false },
  { code: 'AZ', name: 'Arizona', rate: 0.025, approximate: false },
  { code: 'AR', name: 'Arkansas', rate: 0.037, approximate: true },
  { code: 'CA', name: 'California', rate: 0.06, approximate: true },
  { code: 'CO', name: 'Colorado', rate: 0.044, approximate: false },
  { code: 'CT', name: 'Connecticut', rate: 0.05, approximate: true },
  { code: 'DE', name: 'Delaware', rate: 0.05, approximate: true },
  { code: 'DC', name: 'District of Columbia', rate: 0.06, approximate: true },
  { code: 'FL', name: 'Florida', rate: 0, approximate: false },
  { code: 'GA', name: 'Georgia', rate: 0.0519, approximate: false },
  { code: 'HI', name: 'Hawaii', rate: 0.07, approximate: true },
  { code: 'ID', name: 'Idaho', rate: 0.053, approximate: false },
  { code: 'IL', name: 'Illinois', rate: 0.0495, approximate: false },
  { code: 'IN', name: 'Indiana', rate: 0.03, approximate: false },
  { code: 'IA', name: 'Iowa', rate: 0.038, approximate: false },
  { code: 'KS', name: 'Kansas', rate: 0.052, approximate: true },
  { code: 'KY', name: 'Kentucky', rate: 0.04, approximate: false },
  { code: 'LA', name: 'Louisiana', rate: 0.03, approximate: false },
  { code: 'ME', name: 'Maine', rate: 0.06, approximate: true },
  { code: 'MD', name: 'Maryland', rate: 0.0475, approximate: true },
  { code: 'MA', name: 'Massachusetts', rate: 0.05, approximate: false },
  { code: 'MI', name: 'Michigan', rate: 0.0425, approximate: false },
  { code: 'MN', name: 'Minnesota', rate: 0.06, approximate: true },
  { code: 'MS', name: 'Mississippi', rate: 0.044, approximate: false },
  { code: 'MO', name: 'Missouri', rate: 0.045, approximate: true },
  { code: 'MT', name: 'Montana', rate: 0.05, approximate: true },
  { code: 'NE', name: 'Nebraska', rate: 0.045, approximate: true },
  { code: 'NV', name: 'Nevada', rate: 0, approximate: false },
  { code: 'NH', name: 'New Hampshire', rate: 0, approximate: false },
  { code: 'NJ', name: 'New Jersey', rate: 0.045, approximate: true },
  { code: 'NM', name: 'New Mexico', rate: 0.045, approximate: true },
  { code: 'NY', name: 'New York', rate: 0.055, approximate: true },
  { code: 'NC', name: 'North Carolina', rate: 0.0425, approximate: false },
  { code: 'ND', name: 'North Dakota', rate: 0.02, approximate: true },
  { code: 'OH', name: 'Ohio', rate: 0.03, approximate: true },
  { code: 'OK', name: 'Oklahoma', rate: 0.045, approximate: true },
  { code: 'OR', name: 'Oregon', rate: 0.08, approximate: true },
  { code: 'PA', name: 'Pennsylvania', rate: 0.0307, approximate: false },
  { code: 'RI', name: 'Rhode Island', rate: 0.045, approximate: true },
  { code: 'SC', name: 'South Carolina', rate: 0.055, approximate: true },
  { code: 'SD', name: 'South Dakota', rate: 0, approximate: false },
  { code: 'TN', name: 'Tennessee', rate: 0, approximate: false },
  { code: 'TX', name: 'Texas', rate: 0, approximate: false },
  { code: 'UT', name: 'Utah', rate: 0.045, approximate: false },
  { code: 'VT', name: 'Vermont', rate: 0.06, approximate: true },
  { code: 'VA', name: 'Virginia', rate: 0.05, approximate: true },
  { code: 'WA', name: 'Washington', rate: 0, approximate: false },
  { code: 'WV', name: 'West Virginia', rate: 0.045, approximate: true },
  { code: 'WI', name: 'Wisconsin', rate: 0.05, approximate: true },
  { code: 'WY', name: 'Wyoming', rate: 0, approximate: false },
];
