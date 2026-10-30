import type { PayloadRequest } from 'payload'

import {
  EMPTY_ANALYTICS_TOTALS,
  LIVE_FULFILLMENT_STATUSES,
  PAID_FULFILLMENT_STATUSES,
  daysAgoUtc,
  fillRevenueSeries,
  parseOverviewDays,
  startOfUtcDay,
  totalsFromAggregateRow,
  type AnalyticsTotals,
  type RevenuePoint,
} from '@/commerce/opsHelpers'
import type { FulfillmentStatus } from '@/commerce/orderStatus'

export type StatusCount = { count: number; status: FulfillmentStatus }

export type RecentOrderRow = {
  contactName?: string | null
  createdAt: string
  id: string
  reference?: string | null
  restaurantName?: string | null
  status: FulfillmentStatus
  total: number
}

export type ActivityEvent = {
  at: string
  note?: string | null
  orderId: string
  reference?: string | null
  restaurantName?: string | null
  status: FulfillmentStatus
}

export type OverviewPayload = {
  activity: ActivityEvent[]
  byStatus: StatusCount[]
  liveOrders: number
  recent: RecentOrderRow[]
  series: RevenuePoint[]
  today: AnalyticsTotals
  yesterday: AnalyticsTotals
}

type OrdersModel = {
  // mongoose Aggregate is thenable; keep the surface narrow for our pipelines
  aggregate: (pipeline: object[]) => Promise<object[]> | { then: Promise<object[]>['then'] }
  countDocuments: (filter: object) => Promise<number> | { then: Promise<number>['then'] }
}

const ordersCollection = (req: PayloadRequest): OrdersModel => {
  const db = req.payload.db as unknown as { collections?: Record<string, OrdersModel> }
  const model = db.collections?.orders
  if (!model) {
    throw new Error('Orders collection is not available')
  }
  return model
}

const runAggregate = async <T>(model: OrdersModel, pipeline: object[]): Promise<T[]> => {
  return (await model.aggregate(pipeline)) as T[]
}

const runCount = async (model: OrdersModel, filter: object): Promise<number> => {
  return model.countDocuments(filter)
}

const paidMatch = () => ({ fulfillmentStatus: { $in: PAID_FULFILLMENT_STATUSES } })

const totalsBetween = async (
  model: OrdersModel,
  from: Date,
  to: Date,
): Promise<AnalyticsTotals> => {
  const [row] = await runAggregate<AnalyticsTotals & { _id: null }>(model, [
    {
      $match: {
        createdAt: { $gte: from, $lt: to },
        ...paidMatch(),
      },
    },
    {
      $group: {
        _id: null,
        commission: { $sum: { $ifNull: ['$commission', 0] } },
        orders: { $sum: 1 },
        revenue: { $sum: { $ifNull: ['$amount', 0] } },
        riderPayouts: { $sum: { $ifNull: ['$driverPayout.total', 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        averageOrderValue: {
          $cond: [{ $gt: ['$orders', 0] }, { $round: [{ $divide: ['$revenue', '$orders'] }, 0] }, 0],
        },
        commission: 1,
        orders: 1,
        revenue: 1,
        riderPayouts: 1,
      },
    },
  ])

  return totalsFromAggregateRow(row)
}

const revenueSeries = async (model: OrdersModel, days: number): Promise<RevenuePoint[]> => {
  const from = daysAgoUtc(days - 1)
  const rows = await runAggregate<RevenuePoint>(model, [
    {
      $match: {
        createdAt: { $gte: from },
        ...paidMatch(),
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d' } },
        commission: { $sum: { $ifNull: ['$commission', 0] } },
        revenue: { $sum: { $ifNull: ['$amount', 0] } },
      },
    },
    { $project: { _id: 0, commission: 1, date: '$_id', revenue: 1 } },
    { $sort: { date: 1 } },
  ])

  return fillRevenueSeries(days, rows, from)
}

const ordersByStatus = async (model: OrdersModel): Promise<StatusCount[]> => {
  const rows = await runAggregate<{ count: number; status: FulfillmentStatus }>(model, [
    { $match: paidMatch() },
    { $group: { _id: '$fulfillmentStatus', count: { $sum: 1 } } },
    { $project: { _id: 0, count: 1, status: '$_id' } },
  ])

  const byStatus = new Map(rows.map((row) => [row.status, row.count]))
  return PAID_FULFILLMENT_STATUSES.map((status) => ({
    count: byStatus.get(status) ?? 0,
    status,
  }))
}

const recentOrders = async (model: OrdersModel, limit: number): Promise<RecentOrderRow[]> => {
  const rows = await runAggregate<{
    _id: unknown
    contactName?: string | null
    createdAt: Date | string
    reference?: string | null
    restaurantName?: string | null
    status: FulfillmentStatus
    total: number
  }>(model, [
    { $match: paidMatch() },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $project: {
        contactName: 1,
        createdAt: 1,
        reference: 1,
        restaurantName: 1,
        status: '$fulfillmentStatus',
        total: { $ifNull: ['$amount', 0] },
      },
    },
  ])

  return rows.map((row) => ({
    contactName: row.contactName,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    id: String(row._id),
    reference: row.reference,
    restaurantName: row.restaurantName,
    status: row.status,
    total: row.total,
  }))
}

const recentActivity = async (model: OrdersModel, limit: number): Promise<ActivityEvent[]> => {
  const rows = await runAggregate<{
    _id: unknown
    at: Date | string
    note?: string | null
    reference?: string | null
    restaurantName?: string | null
    status: FulfillmentStatus
  }>(model, [
    { $match: paidMatch() },
    { $unwind: '$statusHistory' },
    { $sort: { 'statusHistory.at': -1 } },
    { $limit: limit },
    {
      $project: {
        at: '$statusHistory.at',
        note: '$statusHistory.note',
        reference: 1,
        restaurantName: 1,
        status: '$statusHistory.status',
      },
    },
  ])

  return rows.map((row) => ({
    at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    note: row.note,
    orderId: String(row._id),
    reference: row.reference,
    restaurantName: row.restaurantName,
    status: row.status,
  }))
}

/** Admin dashboard overview: today/yesterday cards, series, live ops. */
export const getAnalyticsOverview = async (
  req: PayloadRequest,
  daysRaw?: unknown,
): Promise<OverviewPayload> => {
  const days = parseOverviewDays(daysRaw)
  const model = ordersCollection(req)

  const todayStart = startOfUtcDay()
  const tomorrow = new Date(todayStart)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const yesterdayStart = daysAgoUtc(1)

  const [today, yesterday, series, byStatus, recent, activity, liveOrders] = await Promise.all([
    totalsBetween(model, todayStart, tomorrow),
    totalsBetween(model, yesterdayStart, todayStart),
    revenueSeries(model, days),
    ordersByStatus(model),
    recentOrders(model, 5),
    recentActivity(model, 6),
    runCount(model, { fulfillmentStatus: { $in: LIVE_FULFILLMENT_STATUSES } }),
  ])

  return {
    activity,
    byStatus,
    liveOrders,
    recent,
    series,
    today: today ?? EMPTY_ANALYTICS_TOTALS,
    yesterday: yesterday ?? EMPTY_ANALYTICS_TOTALS,
  }
}
