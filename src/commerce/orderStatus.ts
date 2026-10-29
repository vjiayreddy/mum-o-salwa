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
  note?: string
}

/** Kitchen / admin may move along this graph (Phase 4 expands actors). */
const KITCHEN_TRANSITIONS: Partial<Record<FulfillmentStatus, FulfillmentStatus[]>> = {
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['cancelled'],
}

export const canKitchenTransition = (
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean => (KITCHEN_TRANSITIONS[from] ?? []).includes(to)

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
