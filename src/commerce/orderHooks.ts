import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
} from 'payload'

import {
  appendStatusHistory,
  canKitchenTransition,
  canSystemTransition,
  generateOrderReference,
  newDeliveryCode,
  type FulfillmentStatus,
  type StatusHistoryEntry,
} from '@/commerce/orderStatus'
import {
  productIDsFromOrderItems,
  relationID,
  tenantIDFromPopulatedProduct,
  tenantIDFromProductMap,
} from '@/commerce/orderTenant'

type OrderItemLike = { product?: unknown }

/**
 * Plugin confirm-order never sets multi-tenant `tenant`. Infer it from line items
 * so Assigned Tenant validation succeeds for customer checkout.
 */
const ensureOrderTenant = async (
  data: Record<string, unknown>,
  req: PayloadRequest,
): Promise<void> => {
  if (relationID(data.tenant)) return

  const items = data.items as OrderItemLike[] | null | undefined
  if (!items?.length) return

  for (const item of items) {
    const fromPopulated = tenantIDFromPopulatedProduct(item.product)
    if (fromPopulated) {
      data.tenant = fromPopulated
      return
    }
  }

  const productIDs = productIDsFromOrderItems(items)
  if (productIDs.length === 0) return

  const products = await req.payload.find({
    collection: 'products',
    depth: 0,
    limit: productIDs.length,
    overrideAccess: true,
    pagination: false,
    req,
    where: { id: { in: productIDs } },
  })

  const tenantByProductID = new Map<string, string>()
  for (const product of products.docs) {
    const tenantID = relationID(product.tenant)
    if (tenantID) tenantByProductID.set(String(product.id), tenantID)
  }

  const tenantID = tenantIDFromProductMap(productIDs, tenantByProductID)
  if (tenantID) data.tenant = tenantID
}

/**
 * Ensure every order has a delivery code + human reference, including orders
 * created by the ecommerce plugin confirm-order path (not our create-checkout).
 */
export const orderBeforeValidateDefaults: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (!data) return data

  await ensureOrderTenant(data as Record<string, unknown>, req)

  if (!data.deliveryCode) {
    data.deliveryCode = newDeliveryCode()
  }

  if (!data.reference) {
    // Best-effort uniqueness; create-checkout allocates first when possible
    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = generateOrderReference()
      const existing = await req.payload.find({
        collection: 'orders',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
        req,
        where: { reference: { equals: reference } },
      })
      if (existing.totalDocs === 0) {
        data.reference = reference
        break
      }
    }
    if (!data.reference) data.reference = generateOrderReference()
  }

  if (operation === 'create' && !data.fulfillmentStatus) {
    // Plugin confirm creates with status=processing (already paid)
    if (data.status === 'processing') {
      data.fulfillmentStatus = 'confirmed'
      data.paidAt = data.paidAt ?? new Date().toISOString()
      data.statusHistory = appendStatusHistory(
        (data.statusHistory as StatusHistoryEntry[] | undefined) ?? [],
        'confirmed',
        'Payment received',
      )
    } else {
      data.fulfillmentStatus = 'pending_payment'
      if (!data.statusHistory?.length) {
        data.statusHistory = appendStatusHistory([], 'pending_payment', 'Waiting for payment')
      }
    }
  }

  return data
}

/**
 * Guard fulfillmentStatus changes made via Admin / REST (not kitchen/driver endpoints).
 * Kitchen, driver, and release-rider services set `skipFulfillmentGuard` after validating.
 */
export const orderBeforeChangeFulfillment: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !data || context?.skipFulfillmentGuard) return data

  const from = (originalDoc?.fulfillmentStatus as FulfillmentStatus | undefined) ?? undefined
  const to = data.fulfillmentStatus as FulfillmentStatus | undefined
  if (!to || !from || to === from) return data

  if (canKitchenTransition(from, to)) {
    const history =
      (data.statusHistory as StatusHistoryEntry[] | undefined) ??
      (originalDoc?.statusHistory as StatusHistoryEntry[] | undefined) ??
      []
    const last = history.at(-1)
    if (last?.status !== to) {
      const actor =
        (req.user as { name?: string | null; email?: string } | null)?.name?.trim() ||
        (req.user as { email?: string } | null)?.email ||
        'staff'
      data.statusHistory = appendStatusHistory(
        history,
        to,
        `Set to ${to.replace(/_/g, ' ')} by ${actor}`,
      )
    }
    if (to === 'cancelled') {
      data.status = 'cancelled'
    }
    return data
  }

  if (canSystemTransition(from, to)) {
    return data
  }

  throw new APIError(
    `An order that is ${from.replace(/_/g, ' ')} cannot be moved to ${to.replace(/_/g, ' ')}`,
    400,
  )
}

/**
 * When the plugin confirm-order path sets `status: processing` on an existing
 * pending order (or updates), flip fulfillment to confirmed once.
 */
export const orderAfterChangePaymentSync: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context?.skipOrderPaymentSync) return doc

  const wasPending =
    (previousDoc?.fulfillmentStatus as FulfillmentStatus | undefined) === 'pending_payment' ||
    (previousDoc?.fulfillmentStatus as FulfillmentStatus | undefined) === 'payment_failed'

  const nowProcessing = doc.status === 'processing'
  const stillPending =
    doc.fulfillmentStatus === 'pending_payment' || doc.fulfillmentStatus === 'payment_failed'

  if (!nowProcessing || !stillPending || !wasPending) return doc

  const paidAt = new Date().toISOString()
  return req.payload.update({
    collection: 'orders',
    context: { skipOrderPaymentSync: true },
    data: {
      fulfillmentStatus: 'confirmed',
      paidAt,
      statusHistory: appendStatusHistory(
        (doc.statusHistory as StatusHistoryEntry[] | undefined) ?? [],
        'confirmed',
        'Payment received',
      ),
    },
    id: doc.id,
    overrideAccess: true,
    req,
  })
}
