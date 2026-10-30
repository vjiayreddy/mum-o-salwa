import { addDataAndFileToRequest, type Endpoint } from 'payload'

import {
  assertDriverActor,
  claimDelivery,
  completeDelivery,
  findDelivery,
  getDriverHome,
  pickUpDelivery,
  setDriverOnline,
  todayEarnings,
} from '@/commerce/driver'

const jsonError = (error: unknown) => {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status) || 500
      : 500
  const message = error instanceof Error ? error.message : 'Request failed'
  return Response.json({ message }, { status })
}

const orderIDParam = (req: { routeParams?: Record<string, unknown> }): string | null => {
  const id = req.routeParams?.id
  return typeof id === 'string' && id ? id : null
}

/** GET /api/drivers/home — queue + active jobs + today's earnings. */
export const driverHomeEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const driver = assertDriverActor(req)
      const data = await getDriverHome(req, driver)
      return Response.json({ data, message: 'Driver home' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver home failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/drivers/home',
}

/** GET /api/drivers/earnings — deliveries + earnings since local midnight. */
export const driverEarningsEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const driver = assertDriverActor(req)
      const data = await todayEarnings(req, driver)
      return Response.json({ data, message: 'Driver earnings' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver earnings failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/drivers/earnings',
}

/** PATCH /api/drivers/online — { isOnline: boolean }. */
export const driverOnlineEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      await addDataAndFileToRequest(req)
      const driver = assertDriverActor(req)
      const body = (req.data ?? {}) as { isOnline?: unknown }
      if (typeof body.isOnline !== 'boolean') {
        return Response.json({ message: 'isOnline boolean required' }, { status: 400 })
      }
      const isOnline = await setDriverOnline(req, driver, body.isOnline)
      return Response.json({ data: { isOnline }, message: 'Updated' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver online failed' })
      return jsonError(error)
    }
  },
  method: 'patch',
  path: '/drivers/online',
}

/** GET /api/drivers/deliveries/:id */
export const driverGetDeliveryEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const driver = assertDriverActor(req)
      const orderID = orderIDParam(req)
      if (!orderID) return Response.json({ message: 'Order id required' }, { status: 400 })
      const data = await findDelivery(req, String(driver.id), orderID)
      return Response.json({ data, message: 'Delivery' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver get delivery failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/drivers/deliveries/:id',
}

/** POST /api/drivers/deliveries/:id/claim */
export const driverClaimEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const driver = assertDriverActor(req)
      const orderID = orderIDParam(req)
      if (!orderID) return Response.json({ message: 'Order id required' }, { status: 400 })
      const data = await claimDelivery(req, driver, orderID)
      return Response.json({ data, message: 'Delivery claimed' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver claim failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/drivers/deliveries/:id/claim',
}

/** POST /api/drivers/deliveries/:id/pick-up */
export const driverPickUpEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const driver = assertDriverActor(req)
      const orderID = orderIDParam(req)
      if (!orderID) return Response.json({ message: 'Order id required' }, { status: 400 })
      const data = await pickUpDelivery(req, String(driver.id), orderID)
      return Response.json({ data, message: 'Picked up' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver pick-up failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/drivers/deliveries/:id/pick-up',
}

/** POST /api/drivers/deliveries/:id/complete — { code: string }. */
export const driverCompleteEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      await addDataAndFileToRequest(req)
      const driver = assertDriverActor(req)
      const orderID = orderIDParam(req)
      if (!orderID) return Response.json({ message: 'Order id required' }, { status: 400 })
      const body = (req.data ?? {}) as { code?: unknown }
      if (typeof body.code !== 'string' || !body.code.trim()) {
        return Response.json({ message: 'Delivery code required' }, { status: 400 })
      }
      const data = await completeDelivery(req, String(driver.id), orderID, body.code.trim())
      return Response.json({ data, message: 'Delivered' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'driver complete failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/drivers/deliveries/:id/complete',
}

export const deliveryDriverEndpoints: Endpoint[] = [
  driverHomeEndpoint,
  driverEarningsEndpoint,
  driverOnlineEndpoint,
  driverGetDeliveryEndpoint,
  driverClaimEndpoint,
  driverPickUpEndpoint,
  driverCompleteEndpoint,
]
