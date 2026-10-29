import { addDataAndFileToRequest, type Endpoint } from 'payload'

import {
  createCheckout,
  reorderFromOrder,
  syncOrderPayment,
  type CreateCheckoutInput,
} from '@/commerce/checkout'

const jsonError = (error: unknown) => {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status) || 500
      : 500
  const message = error instanceof Error ? error.message : 'Request failed'
  return Response.json({ message }, { status })
}

/** POST /api/orders/create-checkout — snapshot cart + Stripe PaymentIntent. */
export const createCheckoutEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      await addDataAndFileToRequest(req)
      const body = (req.data ?? {}) as CreateCheckoutInput
      const result = await createCheckout(req, {
        addressId: typeof body.addressId === 'string' ? body.addressId : undefined,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : undefined,
        deliveryInstructions:
          typeof body.deliveryInstructions === 'string'
            ? body.deliveryInstructions
            : undefined,
      })
      return Response.json(result)
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'create-checkout failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/create-checkout',
}

/** POST /api/orders/:id/sync-payment — reconcile PI when webhook is late. */
export const syncPaymentEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const orderID = req.routeParams?.id
      if (typeof orderID !== 'string' || !orderID) {
        return Response.json({ message: 'Order id required' }, { status: 400 })
      }
      const result = await syncOrderPayment(req, orderID)
      return Response.json(result)
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'sync-payment failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/:id/sync-payment',
}

/** POST /api/orders/:id/reorder — rebuild active cart from a past order. */
export const reorderEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const orderID = req.routeParams?.id
      if (typeof orderID !== 'string' || !orderID) {
        return Response.json({ message: 'Order id required' }, { status: 400 })
      }
      const result = await reorderFromOrder(req, orderID)
      return Response.json(result)
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'reorder failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/:id/reorder',
}

export const deliveryOrderEndpoints: Endpoint[] = [
  createCheckoutEndpoint,
  syncPaymentEndpoint,
  reorderEndpoint,
]
