import { APIError, type PayloadRequest, type Where } from 'payload'

import { checkRole } from '@/access/utilities'
import { computeDriverPayout, type DriverPayout, type LatLng } from '@/commerce/money'
import {
  applyClaimDelivery,
  applyCompleteDelivery,
  applyPickupDelivery,
  orderDriverID,
  orderHasDriver,
  type DriverSnapshot,
} from '@/commerce/orderStatus'
import type { Order, PlatformSetting, User } from '@/payload-types'

export type DeliveryPayload = {
  order: Order
  payout: DriverPayout
}

export type DriverSummary = {
  deliveries: number
  earnings: number
  isOnline: boolean
}

export type DriverHome = {
  active: DeliveryPayload[]
  ready: DeliveryPayload[]
  summary: DriverSummary
}

const asLatLng = (point?: { lat?: number | null; lng?: number | null } | null): LatLng | null => {
  if (typeof point?.lat !== 'number' || typeof point?.lng !== 'number') return null
  return { lat: point.lat, lng: point.lng }
}

/** Riders waiting for approval or suspended may look, never take work. */
export const assertApprovedDriver = (driver: User): void => {
  if (driver.driverStatus === 'approved') return

  throw new APIError(
    driver.driverStatus === 'suspended'
      ? 'Your rider account is suspended. Contact support.'
      : 'Your rider account is waiting for approval.',
    403,
  )
}

export const assertDriverActor = (req: PayloadRequest): User => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)
  if (!checkRole(['driver'], user)) throw new APIError('Forbidden', 403)
  if (user.isActive === false) throw new APIError('Forbidden', 403)
  return user
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
    throw new APIError('Delivery not found', 404)
  }
}

const getDriverPayRates = async (req: PayloadRequest) => {
  const settings = (await req.payload.findGlobal({
    slug: 'platform-settings',
    depth: 0,
    overrideAccess: true,
    req,
  })) as PlatformSetting

  return {
    basePay: settings.driverBasePay ?? 490,
    payPerKm: settings.driverPayPerKm ?? 120,
  }
}

const payoutFor = (order: Order, rates: { basePay: number; payPerKm: number }): DriverPayout => {
  if (
    typeof order.driverPayout?.base === 'number' &&
    typeof order.driverPayout?.total === 'number'
  ) {
    return {
      base: order.driverPayout.base,
      distance: order.driverPayout.distance ?? 0,
      distanceKm: order.driverPayout.distanceKm ?? 0,
      total: order.driverPayout.total,
    }
  }

  return computeDriverPayout(
    asLatLng(order.restaurantLocation),
    asLatLng(order.deliveryLocation),
    rates,
  )
}

const withPayout = (
  order: Order,
  rates: { basePay: number; payPerKm: number },
): DeliveryPayload => ({
  order,
  payout: payoutFor(order, rates),
})

const driverSnapshot = (driver: User): NonNullable<DriverSnapshot> => ({
  avatarUrl: null,
  location: { lat: null, lng: null },
  locationUpdatedAt: null,
  name: driver.name?.trim() || driver.email || 'Rider',
  phone: driver.phone ?? null,
  rating: driver.rating ?? null,
  ratingCount: driver.ratingCount ?? null,
  user: driver.id,
})

/** Ready queue: kitchen done, nobody claimed yet. */
export const listReadyDeliveries = async (req: PayloadRequest): Promise<DeliveryPayload[]> => {
  const rates = await getDriverPayRates(req)
  const result = await req.payload.find({
    collection: 'orders',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'createdAt',
    where: {
      and: [
        { fulfillmentStatus: { equals: 'ready' } },
        {
          or: [
            { 'driver.user': { exists: false } },
            { 'driver.user': { equals: null } },
          ],
        },
      ],
    },
  })

  return (result.docs as Order[])
    .filter((order) => !orderHasDriver(order))
    .map((order) => withPayout(order, rates))
}

/** Deliveries this rider holds that are not finished. */
export const listMyDeliveries = async (
  req: PayloadRequest,
  driverID: string,
): Promise<DeliveryPayload[]> => {
  const rates = await getDriverPayRates(req)
  const result = await req.payload.find({
    collection: 'orders',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'createdAt',
    where: {
      and: [
        { 'driver.user': { equals: driverID } },
        {
          fulfillmentStatus: {
            in: ['ready', 'out_for_delivery'],
          },
        },
      ],
    } satisfies Where,
  })

  return (result.docs as Order[]).map((order) => withPayout(order, rates))
}

/**
 * Unclaimed ready order, or one this rider already holds. Anything else is 404
 * so another rider's job stays invisible.
 */
export const findDelivery = async (
  req: PayloadRequest,
  driverID: string,
  orderID: string,
): Promise<DeliveryPayload> => {
  const order = await loadOrder(req, orderID)
  const mine = orderDriverID(order) === String(driverID)
  const claimable = !orderHasDriver(order) && order.fulfillmentStatus === 'ready'

  if (!mine && !claimable) throw new APIError('Delivery not found', 404)

  return withPayout(order, await getDriverPayRates(req))
}

/**
 * Claim race: only the update that still matches an unclaimed ready order wins.
 * Uses the DB adapter's conditional findOneAndUpdate under the hood.
 */
export const claimDelivery = async (
  req: PayloadRequest,
  driver: User,
  orderID: string,
): Promise<DeliveryPayload> => {
  assertApprovedDriver(driver)

  const order = await loadOrder(req, orderID)
  const rates = await getDriverPayRates(req)
  const payout = payoutFor(order, rates)
  const snapshot = driverSnapshot(driver)

  let patch: ReturnType<typeof applyClaimDelivery>
  try {
    patch = applyClaimDelivery(order, snapshot, payout)
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : 'Cannot claim delivery', 400)
  }

  const claimed = await req.payload.db.updateOne({
    collection: 'orders',
    data: {
      driver: patch.driver,
      driverPayout: patch.driverPayout,
      statusHistory: patch.statusHistory,
    },
    req,
    where: {
      and: [
        { id: { equals: orderID } },
        { fulfillmentStatus: { equals: 'ready' } },
        {
          or: [
            { 'driver.user': { exists: false } },
            { 'driver.user': { equals: null } },
          ],
        },
      ],
    },
  })

  if (!claimed) {
    throw new APIError('Another rider claimed this delivery', 400)
  }

  // Re-read through Local API so shape matches Order docs elsewhere.
  const fresh = await loadOrder(req, orderID)
  if (orderDriverID(fresh) !== String(driver.id)) {
    throw new APIError('Another rider claimed this delivery', 400)
  }

  return withPayout(fresh, rates)
}

export const pickUpDelivery = async (
  req: PayloadRequest,
  driverID: string,
  orderID: string,
): Promise<DeliveryPayload> => {
  const order = await loadOrder(req, orderID)

  let patch: ReturnType<typeof applyPickupDelivery>
  try {
    patch = applyPickupDelivery(order, driverID)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cannot pick up delivery'
    throw new APIError(message, message === 'Delivery not found' ? 404 : 400)
  }

  const updated = (await req.payload.update({
    collection: 'orders',
    context: { skipFulfillmentGuard: true },
    data: {
      fulfillmentStatus: patch.fulfillmentStatus,
      statusHistory: patch.statusHistory,
    },
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
  })) as Order

  return withPayout(updated, await getDriverPayRates(req))
}

export const completeDelivery = async (
  req: PayloadRequest,
  driverID: string,
  orderID: string,
  code: string,
): Promise<DeliveryPayload> => {
  const order = await loadOrder(req, orderID)

  let patch: ReturnType<typeof applyCompleteDelivery>
  try {
    patch = applyCompleteDelivery(order, driverID, code)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cannot complete delivery'
    throw new APIError(message, message === 'Delivery not found' ? 404 : 400)
  }

  const updated = (await req.payload.update({
    collection: 'orders',
    context: { skipFulfillmentGuard: true },
    data: {
      fulfillmentStatus: patch.fulfillmentStatus,
      status: patch.status,
      statusHistory: patch.statusHistory,
    },
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
  })) as Order

  return withPayout(updated, await getDriverPayRates(req))
}

export const setDriverOnline = async (
  req: PayloadRequest,
  driver: User,
  isOnline: boolean,
): Promise<boolean> => {
  if (isOnline) assertApprovedDriver(driver)

  await req.payload.update({
    collection: 'users',
    data: { isOnline },
    depth: 0,
    id: driver.id,
    overrideAccess: true,
    req,
    user: driver,
  })

  return isOnline
}

/** Earnings from this rider's completed runs since local midnight. */
export const todayEarnings = async (
  req: PayloadRequest,
  driver: User,
): Promise<DriverSummary> => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const result = await req.payload.find({
    collection: 'orders',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        { 'driver.user': { equals: driver.id } },
        { fulfillmentStatus: { equals: 'delivered' } },
        { updatedAt: { greater_than_equal: startOfDay.toISOString() } },
      ],
    },
  })

  const orders = result.docs as Order[]
  return {
    deliveries: orders.length,
    earnings: orders.reduce((total, order) => total + (order.driverPayout?.total ?? 0), 0),
    isOnline: Boolean(driver.isOnline),
  }
}

export const getDriverHome = async (
  req: PayloadRequest,
  driver: User,
): Promise<DriverHome> => {
  const [summary, ready, active] = await Promise.all([
    todayEarnings(req, driver),
    listReadyDeliveries(req),
    listMyDeliveries(req, String(driver.id)),
  ])

  return { active, ready, summary }
}
