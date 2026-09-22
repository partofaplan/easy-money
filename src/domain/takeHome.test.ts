import { describe, expect, it } from 'vitest';
import { bracketTax, estimateTakeHome, netForHours } from './takeHome';
import { FEDERAL_BRACKETS } from '../data/taxTables';

describe('bracketTax', () => {
  it('applies rates progressively', () => {
    expect(bracketTax(0, FEDERAL_BRACKETS.single)).toBe(0);
    expect(bracketTax(12_400, FEDERAL_BRACKETS.single)).toBeCloseTo(1_240);
    expect(bracketTax(50_400, FEDERAL_BRACKETS.single)).toBeCloseTo(1_240 + 4_560);
  });
});

describe('estimateTakeHome', () => {
  it('estimates a biweekly Colorado paycheck close to the design figure', () => {
    const e = estimateTakeHome({
      gross: 76_000,
      grossUnit: 'year',
      hoursPerPaycheck: 0,
      frequency: 'biweekly',
      stateCode: 'CO',
      filing: 'single',
      retirementPct: 4,
      healthPerPaycheck: 85,
    });
    expect(e.grossPerPaycheck).toBeCloseTo(2923.08, 1);
    expect(e.takeHome).toBeGreaterThan(2_050);
    expect(e.takeHome).toBeLessThan(2_200);
    expect(e.deductions.map((d) => d.label)).toContain('Colorado state tax');
    expect(e.stateApproximate).toBe(false);
  });

  it('handles hourly pay and no-tax states', () => {
    const e = estimateTakeHome({
      gross: 22,
      grossUnit: 'hour',
      hoursPerPaycheck: 40,
      frequency: 'weekly',
      stateCode: 'TX',
      filing: 'single',
      retirementPct: 0,
      healthPerPaycheck: 0,
    });
    expect(e.annualGross).toBe(45_760);
    expect(e.deductions.some((d) => d.label.includes('state'))).toBe(false);
    expect(e.takeHome).toBeLessThan(e.grossPerPaycheck);
  });
});

describe('netForHours', () => {
  it('nets hourly pay for one paycheck and scales with hours', () => {
    const tax = { stateCode: 'CO', filing: 'single' as const, retirementPct: 0, healthPerPaycheck: 0 };
    const eighty = netForHours(22, 80, 'biweekly', tax);
    const forty = netForHours(22, 40, 'biweekly', tax);
    expect(eighty).toBeGreaterThan(1_300);
    expect(eighty).toBeLessThan(22 * 80);
    expect(forty).toBeLessThan(eighty);
    // Fewer hours means a lower tax bracket, so the net is more than half.
    expect(forty).toBeGreaterThan(eighty / 2);
    expect(netForHours(22, 0, 'biweekly', tax)).toBe(0);
    expect(netForHours(22, 80, 'biweekly', null)).toBeGreaterThan(eighty);
  });
});
