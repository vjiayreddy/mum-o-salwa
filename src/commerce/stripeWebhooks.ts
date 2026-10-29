import type { PayloadRequest } from 'payload'
import type Stripe from 'stripe'

import { markOrderPaid, markOrderPaymentFailed } from '@/commerce/checkout'

type StripeWebhookHandler = (args: {
  event: Stripe.Event
  req: PayloadRequest
  stripe: Stripe
}) => Promise<void> | void

/**
 * Record the event id first so Stripe retries are no-ops. If handling fails,
 * delete the receipt so Stripe can retry into a clean state.
 */
const withIdempotency = async (
  req: PayloadRequest,
  event: Stripe.Event,
  handle: () => Promise<void>,
): Promise<void> => {
  try {
    await req.payload.create({
      collection: 'stripe-events',
      data: {
        eventId: event.id,
        processedAt: new Date().toISOString(),
        type: event.type,
      },
      overrideAccess: true,
      req,
    })
  } catch {
    // Unique constraint → already processed
    req.payload.logger.info({ eventId: event.id, msg: 'Duplicate Stripe event skipped' })
    return
  }

  try {
    await handle()
  } catch (error) {
    const existing = await req.payload.find({
      collection: 'stripe-events',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      where: { eventId: { equals: event.id } },
    })
    if (existing.docs[0]) {
      await req.payload.delete({
        collection: 'stripe-events',
        id: existing.docs[0].id,
        overrideAccess: true,
        req,
      })
    }
    throw error
  }
}

const paymentIntentSucceeded: StripeWebhookHandler = async ({ event, req }) => {
  await withIdempotency(req, event, async () => {
    const intent = event.data.object as Stripe.PaymentIntent
    await markOrderPaid(req.payload, intent.id, req)
  })
}

const paymentIntentFailed: StripeWebhookHandler = async ({ event, req }) => {
  await withIdempotency(req, event, async () => {
    const intent = event.data.object as Stripe.PaymentIntent
    await markOrderPaymentFailed(req.payload, intent.id, req)
  })
}

/** Handlers passed to `stripeAdapter({ webhooks })` — plugin keeps signature verify. */
export const deliveryStripeWebhooks: Record<string, StripeWebhookHandler> = {
  'payment_intent.payment_failed': paymentIntentFailed,
  'payment_intent.succeeded': paymentIntentSucceeded,
}
