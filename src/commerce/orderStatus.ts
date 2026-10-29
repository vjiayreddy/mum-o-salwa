/**
 * Dual-track order status: plugin `status` (payment settlement) + `fulfillmentStatus`
 * (kitchen / rider lifecycle). Pure helpers — no Payload imports.
 */

export const FULFILLMENT_STATUSES = [
  'pending_payment',
  'payment_failed',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]

/** Plugin ecommerce order status values we use. */
export type PluginOrderStatus = 'processing' | 'completed' | 'cancelled' | 'refunded'

export type StatusHistoryEntry = {
  status: FulfillmentStatus
  at: string
  note?: string | null
  id?: string | null
}

/** Kitchen / admin may move along this graph. */
const KITCHEN_TRANSITIONS: Partial<Record<FulfillmentStatus, FulfillmentStatus[]>> = {
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['cancelled'],
}

/** Payment + release-rider paths that bypass the kitchen graph. */
const SYSTEM_TRANSITIONS: Partial<Record<FulfillmentStatus, FulfillmentStatus[]>> = {
  pending_payment: ['confirmed', 'payment_failed'],
  payment_failed: ['confirmed'],
  // Release rider: stranded out_for_delivery goes back to ready for re-claim
  out_for_delivery: ['ready'],
}

export const canKitchenTransition = (
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean => (KITCHEN_TRANSITIONS[from] ?? []).includes(to)

export const canSystemTransition = (
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean => (SYSTEM_TRANSITIONS[from] ?? []).includes(to)

/** Admin may free a rider only while the order is waiting for pickup or en route. */
export const canReleaseRider = (status: FulfillmentStatus | null | undefined): boolean =>
  status === 'ready' || status === 'out_for_delivery'

const humanizeStatus = (status: FulfillmentStatus): string => status.replace(/_/g, ' ')

/**
 * Apply a kitchen/admin status change. Caller persists the returned patch.
 */
export const applyKitchenTransition = (
  order: {
    fulfillmentStatus?: FulfillmentStatus | null
    status?: PluginOrderStatus | null
    statusHistory?: StatusHistoryEntry[] | null
  },
  to: FulfillmentStatus,
  actorName: string,
): {
  fulfillmentStatus: FulfillmentStatus
  status?: PluginOrderStatus
  statusHistory: StatusHistoryEntry[]
} => {
  const from = order.fulfillmentStatus ?? 'pending_payment'
  if (!canKitchenTransition(from, to)) {
    throw new Error(
      `An order that is ${humanizeStatus(from)} cannot be moved to ${humanizeStatus(to)}`,
    )
  }

  const patch: {
    fulfillmentStatus: FulfillmentStatus
    status?: PluginOrderStatus
    statusHistory: StatusHistoryEntry[]
  } = {
    fulfillmentStatus: to,
    statusHistory: appendStatusHistory(
      order.statusHistory,
      to,
      `Set to ${humanizeStatus(to)} by ${actorName}`,
    ),
  }

  if (to === 'cancelled') {
    patch.status = 'cancelled'
  }

  return patch
}

type DriverSnapshot = {
  user?: unknown
  name?: string | null
  phone?: string | null
  avatarUrl?: string | null
  rating?: number | null
  ratingCount?: number | null
  location?: { lat?: number | null; lng?: number | null } | null
  locationUpdatedAt?: string | null
} | null

/**
 * Clear the assigned rider and return the order to `ready` for re-claim.
 */
export const applyReleaseRider = (
  order: {
    fulfillmentStatus?: FulfillmentStatus | null
    statusHistory?: StatusHistoryEntry[] | null
    driver?: DriverSnapshot
  },
  adminName: string,
): {
  driver: null
  driverPayout: null
  fulfillmentStatus: 'ready'
  statusHistory: StatusHistoryEntry[]
} => {
  const driverName = order.driver?.name?.trim()
  const hasDriver = Boolean(order.driver?.user || driverName)
  if (!hasDriver) {
    throw new Error('No rider is assigned to this order')
  }

  if (!canReleaseRider(order.fulfillmentStatus)) {
    throw new Error('Only an order still on its way can be released')
  }

  const label = driverName || 'rider'
  return {
    driver: null,
    driverPayout: null,
    fulfillmentStatus: 'ready',
    statusHistory: appendStatusHistory(
      order.statusHistory,
      'ready',
      `Released from ${label} by ${adminName}`,
    ),
  }
}

export const appendStatusHistory = (
  history: StatusHistoryEntry[] | null | undefined,
  status: FulfillmentStatus,
  note?: string,
  at: Date = new Date(),
): StatusHistoryEntry[] => [
  ...(history ?? []),
  {
    at: at.toISOString(),
    note,
    status,
  },
]

/**
 * Stripe paid: plugin settlement → processing, fulfillment → confirmed.
 * Idempotent for already-confirmed (or later) kitchen states.
 */
export const applyPaymentSucceeded = (order: {
  fulfillmentStatus?: FulfillmentStatus | null
  status?: PluginOrderStatus | null
  statusHistory?: StatusHistoryEntry[] | null
  paidAt?: string | null
}): {
  changed: boolean
  fulfillmentStatus: FulfillmentStatus
  status: PluginOrderStatus
  statusHistory: StatusHistoryEntry[]
  paidAt: string
} => {
  const current = order.fulfillmentStatus ?? 'pending_payment'
  const alreadyPastPayment =
    current !== 'pending_payment' && current !== 'payment_failed'

  if (alreadyPastPayment) {
    return {
      changed: false,
      fulfillmentStatus: current,
      paidAt: order.paidAt ?? new Date().toISOString(),
      status: (order.status as PluginOrderStatus) || 'processing',
      statusHistory: order.statusHistory ?? [],
    }
  }

  const paidAt = new Date()
  return {
    changed: true,
    fulfillmentStatus: 'confirmed',
    paidAt: paidAt.toISOString(),
    status: 'processing',
    statusHistory: appendStatusHistory(
      order.statusHistory,
      'confirmed',
      'Payment received',
      paidAt,
    ),
  }
}

export const applyPaymentFailed = (order: {
  fulfillmentStatus?: FulfillmentStatus | null
  statusHistory?: StatusHistoryEntry[] | null
}): {
  changed: boolean
  fulfillmentStatus: FulfillmentStatus
  statusHistory: StatusHistoryEntry[]
} => {
  if (order.fulfillmentStatus !== 'pending_payment') {
    return {
      changed: false,
      fulfillmentStatus: order.fulfillmentStatus ?? 'pending_payment',
      statusHistory: order.statusHistory ?? [],
    }
  }

  return {
    changed: true,
    fulfillmentStatus: 'payment_failed',
    statusHistory: appendStatusHistory(
      order.statusHistory,
      'payment_failed',
      'Payment was not completed',
    ),
  }
}

/** Four digits the customer reads out to the rider at the door. */
export const newDeliveryCode = (): string =>
  String(Math.floor(1000 + Math.random() * 9000))

/** Short human reference, e.g. CH-2481. Caller must ensure uniqueness. */
export const generateOrderReference = (): string =>
  `CH-${Math.floor(1000 + Math.random() * 9000)}`
