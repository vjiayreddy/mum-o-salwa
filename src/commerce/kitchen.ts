import { APIError, type PayloadRequest } from 'payload'

import { userCanAccessTenant } from '@/access/restaurantTenants'
import { checkRole } from '@/access/utilities'
import {
  applyKitchenTransition,
  applyReleaseRider,
  type FulfillmentStatus,
} from '@/commerce/orderStatus'
import type { Order, User } from '@/payload-types'

const relationID = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

const actorName = (user: User): string => {
  const name = user.name?.trim()
  if (name) return name
  return user.email || 'staff'
}

const loadOrder = async (req: PayloadRequest, orderID: string): Promise<Order> => {
  try {
    return (await req.payload.findByID({
      collection: 'orders',
      depth: 0,
      id: orderID,
      overrideAccess: true,
      req,
    })) as Order
  } catch {
    throw new APIError('Order not found', 404)
  }
}

const assertKitchenActor = (req: PayloadRequest, order: Order): User => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)

  if (checkRole(['admin'], user)) return user

  if (!checkRole(['restaurant'], user)) {
    throw new APIError('Forbidden', 403)
  }

  const tenantID = relationID(order.tenant)
  if (!userCanAccessTenant(user, tenantID)) {
    throw new APIError('Forbidden', 403)
  }

  return user
}

const assertAdmin = (req: PayloadRequest): User => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)
  if (!checkRole(['admin'], user)) throw new APIError('Forbidden', 403)
  return user
}

/** Kitchen / admin moves fulfillment along the kitchen graph. */
export const transitionOrderFulfillment = async (
  req: PayloadRequest,
  orderID: string,
  to: FulfillmentStatus,
): Promise<Order> => {
  const order = await loadOrder(req, orderID)
  const user = assertKitchenActor(req, order)

  let patch: ReturnType<typeof applyKitchenTransition>
  try {
    patch = applyKitchenTransition(order, to, actorName(user))
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : 'Invalid transition', 400)
  }

  return (await req.payload.update({
    collection: 'orders',
    context: { skipFulfillmentGuard: true },
    data: patch,
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
    user,
  })) as Order
}

/** Admin frees a quiet rider; order returns to ready for re-claim. */
export const releaseOrderRider = async (
  req: PayloadRequest,
  orderID: string,
): Promise<Order> => {
  const order = await loadOrder(req, orderID)
  const user = assertAdmin(req)

  let patch: ReturnType<typeof applyReleaseRider>
  try {
    patch = applyReleaseRider(order, actorName(user))
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : 'Cannot release rider', 400)
  }

  return (await req.payload.update({
    collection: 'orders',
    context: { skipFulfillmentGuard: true },
    data: {
      driver: {
        avatarUrl: null,
        location: { lat: null, lng: null },
        locationUpdatedAt: null,
        name: null,
        phone: null,
        rating: null,
        ratingCount: null,
        user: null,
      },
      driverPayout: {
        base: null,
        distance: null,
        distanceKm: null,
        total: null,
      },
      fulfillmentStatus: patch.fulfillmentStatus,
      statusHistory: patch.statusHistory,
    },
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
    user,
  })) as Order
}
