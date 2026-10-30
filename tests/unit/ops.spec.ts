import { describe, expect, it } from 'vitest'

import {
  EMPTY_ANALYTICS_TOTALS,
  escapeRegex,
  fillRevenueSeries,
  normalizeSearchTerm,
  parseOverviewDays,
  parseSortOrderBatch,
  totalsFromAggregateRow,
} from '@/commerce/opsHelpers'

describe('escapeRegex', () => {
  it('escapes metacharacters so user input cannot inject regex', () => {
    expect(escapeRegex('a+b?c.*(d)')).toBe('a\\+b\\?c\\.\\*\\(d\\)')
  })
})

describe('parseOverviewDays', () => {
  it('defaults and clamps', () => {
    expect(parseOverviewDays(undefined)).toBe(7)
    expect(parseOverviewDays('14')).toBe(14)
    expect(parseOverviewDays(0)).toBe(7)
    expect(parseOverviewDays(200)).toBe(90)
    expect(parseOverviewDays(3.9)).toBe(3)
  })
})

describe('fillRevenueSeries', () => {
  it('pads empty days across the window', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    const series = fillRevenueSeries(
      3,
      [{ commission: 10, date: '2026-01-02', revenue: 500 }],
      from,
    )
    expect(series).toEqual([
      { commission: 0, date: '2026-01-01', revenue: 0 },
      { commission: 10, date: '2026-01-02', revenue: 500 },
      { commission: 0, date: '2026-01-03', revenue: 0 },
    ])
  })
})

describe('totalsFromAggregateRow', () => {
  it('returns empty totals for missing rows', () => {
    expect(totalsFromAggregateRow(null)).toEqual(EMPTY_ANALYTICS_TOTALS)
  })

  it('derives average when not provided', () => {
    expect(
      totalsFromAggregateRow({ commission: 100, orders: 2, revenue: 1000, riderPayouts: 50 }),
    ).toEqual({
      averageOrderValue: 500,
      commission: 100,
      orders: 2,
      revenue: 1000,
      riderPayouts: 50,
    })
  })
})

describe('parseSortOrderBatch', () => {
  it('accepts valid rows', () => {
    const result = parseSortOrderBatch(
      [
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 1 },
      ],
      'categories',
    )
    expect(result).toEqual({
      items: [
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 1 },
      ],
    })
  })

  it('rejects empty / invalid payloads', () => {
    expect(parseSortOrderBatch([], 'categories')).toEqual({
      error: 'categories array required',
    })
    expect(parseSortOrderBatch([{ id: 'a', sortOrder: -1 }], 'banners')).toEqual({
      error: 'sortOrder must be an integer from 0 to 999',
    })
    expect(parseSortOrderBatch([{ sortOrder: 1 }], 'banners')).toEqual({
      error: 'Each banner needs a string id',
    })
  })
})

describe('normalizeSearchTerm', () => {
  it('trims and caps length', () => {
    expect(normalizeSearchTerm('  pizza  ')).toBe('pizza')
    expect(normalizeSearchTerm(123)).toBe('')
    expect(normalizeSearchTerm('x'.repeat(100)).length).toBe(80)
  })
})
