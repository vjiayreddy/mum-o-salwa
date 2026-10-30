import type { FulfillmentStatus } from '@/commerce/orderStatus'

/** Paid fulfillment states that count toward business figures. */
export const PAID_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
]

/** Still moving toward a customer — sidebar / live badge. */
export const LIVE_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
]

export type AnalyticsTotals = {
  averageOrderValue: number
  commission: number
  orders: number
  revenue: number
  riderPayouts: number
}

export type RevenuePoint = {
  commission: number
  date: string
  revenue: number
}

export type SortOrderItem = {
  id: string
  sortOrder: number
}

export const EMPTY_ANALYTICS_TOTALS: AnalyticsTotals = {
  averageOrderValue: 0,
  commission: 0,
  orders: 0,
  revenue: 0,
  riderPayouts: 0,
}

/** Escape user input before using it in a RegExp / Mongo `$regex`. */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const startOfUtcDay = (date: Date = new Date()): Date => {
  const copy = new Date(date)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

export const daysAgoUtc = (days: number, from: Date = new Date()): Date => {
  const date = startOfUtcDay(from)
  date.setUTCDate(date.getUTCDate() - days)
  return date
}

/** Clamp overview window; default 7, max 90. */
export const parseOverviewDays = (raw: unknown): number => {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : 7
  if (!Number.isFinite(n) || n < 1) return 7
  return Math.min(90, Math.floor(n))
}

/**
 * Fill missing UTC days so a revenue chart stays continuous.
 * `rows` may be sparse; output length is always `days`.
 */
export const fillRevenueSeries = (
  days: number,
  rows: RevenuePoint[],
  from: Date = daysAgoUtc(days - 1),
): RevenuePoint[] => {
  const byDate = new Map(rows.map((row) => [row.date, row]))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from)
    date.setUTCDate(date.getUTCDate() + index)
    const key = date.toISOString().slice(0, 10)
    return byDate.get(key) ?? { commission: 0, date: key, revenue: 0 }
  })
}

export const totalsFromAggregateRow = (
  row?: Partial<AnalyticsTotals> | null,
): AnalyticsTotals => {
  if (!row) return { ...EMPTY_ANALYTICS_TOTALS }
  const orders = Number(row.orders) || 0
  const revenue = Number(row.revenue) || 0
  const commission = Number(row.commission) || 0
  const riderPayouts = Number(row.riderPayouts) || 0
  const averageOrderValue =
    row.averageOrderValue != null
      ? Math.round(Number(row.averageOrderValue) || 0)
      : orders > 0
        ? Math.round(revenue / orders)
        : 0

  return { averageOrderValue, commission, orders, revenue, riderPayouts }
}

/** Validate a batch sortOrder payload; returns cleaned rows or an error message. */
export const parseSortOrderBatch = (
  items: unknown,
  label: string,
): { error: string } | { items: SortOrderItem[] } => {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: `${label} array required` }
  }
  if (items.length > 100) {
    return { error: `At most 100 ${label} per reorder` }
  }

  const cleaned: SortOrderItem[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      return { error: `Each ${label.slice(0, -1)} needs id and sortOrder` }
    }
    const id = (item as { id?: unknown }).id
    const sortOrder = (item as { sortOrder?: unknown }).sortOrder
    if (typeof id !== 'string' || !id) {
      return { error: `Each ${label.slice(0, -1)} needs a string id` }
    }
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
      return { error: 'sortOrder must be an integer from 0 to 999' }
    }
    cleaned.push({ id, sortOrder })
  }

  return { items: cleaned }
}

export const normalizeSearchTerm = (raw: unknown): string => {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, 80)
}
