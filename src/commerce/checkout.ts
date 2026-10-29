import { APIError, type Payload, type PayloadRequest } from 'payload'
import Stripe from 'stripe'

import {
  priceSelection,
  optionIdsFromNames,
  CartRuleError,
} from '@/commerce/cartRules'
import {
  computeBasketTotals,
  computeCommissionSplit,
  geoPointToLatLng,
  type GeoPoint,
} from '@/commerce/money'
import {
  appendStatusHistory,
  applyPaymentFailed,
  applyPaymentSucceeded,
  generateOrderReference,
  newDeliveryCode,
} from '@/commerce/orderStatus'
import type { Address, Cart, Media, Product, Tenant, User } from '@/payload-types'

export type CreateCheckoutInput = {
  addressId?: string
  contactPhone?: string
  deliveryInstructions?: string
}

export type CheckoutResult = {
  orderID: string
  reference: string
  clientSecret: string
  paymentIntentID: string
  publishableKey: string
  amount: number
  currency: string
}

const CURRENCY = 'USD'
const relationID = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

const mediaURL = (media: string | Media | null | undefined): string => {
  if (!media || typeof media === 'string') return ''
  return media.url ?? ''
}

const productImageURL = (product: Product): string => {
  const galleryImage = product.gallery?.[0]?.image
  if (galleryImage) return mediaURL(galleryImage)
  return mediaURL(product.meta?.image)
}

const getStripe = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new APIError('Payments are not available right now', 503)
  }

  return new Stripe(secretKey, {
    // Match plugin-ecommerce stripe adapter default
    // @ts-expect-error Stripe typings lag account API versions
    apiVersion: '2025-03-31.basil',
  })
}

const nextReference = async (payload: Payload, req?: PayloadRequest): Promise<string> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const reference = generateOrderReference()
    const existing = await payload.find({
      collection: 'orders',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      where: { reference: { equals: reference } },
    })
    if (existing.totalDocs === 0) return reference
  }
  throw new APIError('Could not allocate an order reference', 500)
}

const resolveAddress = async (
  payload: Payload,
  userID: string,
  addressId: string | undefined,
  req?: PayloadRequest,
): Promise<Address> => {
  if (addressId) {
    const address = await payload.findByID({
      collection: 'addresses',
      depth: 0,
      id: addressId,
      overrideAccess: true,
      req,
    })
    if (relationID(address.customer) !== userID) {
      throw new APIError('Address not found', 404)
    }
    return address
  }

  const defaults = await payload.find({
    collection: 'addresses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    sort: '-updatedAt',
    where: {
      and: [{ customer: { equals: userID } }, { isDefault: { equals: true } }],
    },
  })

  const address = defaults.docs[0]
  if (!address) {
    throw new APIError('Add a delivery address before placing an order', 400)
  }
  return address
}

const resolveStripeCustomerId = async (
  payload: Payload,
  user: User,
  stripe: Stripe,
  req?: PayloadRequest,
): Promise<string> => {
  const existing = (user as User & { stripeCustomerId?: string | null }).stripeCustomerId
  if (existing) return existing

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: String(user.id) },
    name: user.name,
  })

  await payload.update({
    collection: 'users',
    data: { stripeCustomerId: customer.id },
    id: user.id,
    overrideAccess: true,
    req,
  })

  return customer.id
}

const findActiveCart = async (
  payload: Payload,
  userID: string,
  req?: PayloadRequest,
): Promise<Cart> => {
  const result = await payload.find({
    collection: 'carts',
    depth: 2,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        { customer: { equals: userID } },
        { status: { equals: 'active' } },
      ],
    },
  })

  const cart = result.docs[0]
  if (!cart?.items?.length) {
    throw new APIError('Your basket is empty', 400)
  }
  return cart
}

type SnapshotLine = {
  product: string
  name: string
  imageUrl: string
  unitPrice: number
  quantity: number
  optionIds: string[]
  optionNames: string[]
  note?: string
}

const snapshotCartItems = async (
  payload: Payload,
  cart: Cart,
  req?: PayloadRequest,
): Promise<SnapshotLine[]> => {
  const lines: SnapshotLine[] = []

  for (const item of cart.items ?? []) {
    const productID = relationID(item.product)
    if (!productID) continue

    const product =
      typeof item.product === 'object' && item.product
        ? (item.product as Product)
        : await payload.findByID({
            collection: 'products',
            depth: 1,
            id: productID,
            overrideAccess: true,
            req,
          })

    if (!product.isAvailable) {
      throw new APIError(`"${product.title}" is no longer available`, 400)
    }

    const optionIds = (item.optionIds ?? []).map(String)
    let unitPrice = item.unitPrice ?? 0
    let optionNames = (item.optionNames ?? []).map(String)

    try {
      const priced = priceSelection(
        {
          optionGroups: product.optionGroups as never,
          price: product.priceInUSD ?? 0,
        },
        optionIds,
      )
      unitPrice = priced.unitPrice
      optionNames = priced.optionNames
    } catch (error) {
      if (error instanceof CartRuleError) {
        throw new APIError(error.message, 400)
      }
      throw error
    }

    lines.push({
      imageUrl: productImageURL(product),
      name: product.title,
      note: item.note ?? undefined,
      optionIds,
      optionNames,
      product: productID,
      quantity: item.quantity,
      unitPrice,
    })
  }

  if (!lines.length) {
    throw new APIError('Your basket is empty', 400)
  }

  return lines
}

/**
 * Builds an order from the customer's active cart, opens a Stripe PaymentIntent,
 * and returns the client secret. Amounts are recomputed server-side.
 */
export const createCheckout = async (
  req: PayloadRequest,
  input: CreateCheckoutInput,
): Promise<CheckoutResult> => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey || !process.env.STRIPE_SECRET_KEY) {
    throw new APIError('Payments are not available right now', 503)
  }

  const { payload } = req
  const cart = await findActiveCart(payload, String(user.id), req)
  const tenantID = relationID(cart.tenant)
  if (!tenantID) {
    throw new APIError('Basket has no restaurant', 400)
  }

  const restaurant = (await payload.findByID({
    collection: 'tenants',
    depth: 1,
    id: tenantID,
    overrideAccess: true,
    req,
  })) as Tenant

  if (!restaurant.isActive) {
    throw new APIError('Restaurant not found', 404)
  }
  if (restaurant.isOpen === false) {
    throw new APIError('This restaurant is closed right now', 400)
  }

  const settings = await payload.findGlobal({
    slug: 'platform-settings',
    overrideAccess: true,
    req,
  })

  const lines = await snapshotCartItems(payload, cart, req)
  const totals = computeBasketTotals(
    lines,
    {
      deliveryFee: restaurant.deliveryFee,
      freeDeliveryThreshold: restaurant.freeDeliveryThreshold,
      minOrder: restaurant.minOrder,
    },
    settings.serviceFeeRate,
  )

  if (totals.belowMinimum) {
    throw new APIError("Your basket is below this restaurant's minimum order", 400)
  }

  const address = await resolveAddress(payload, String(user.id), input.addressId, req)
  const commissionRate =
    typeof restaurant.commissionRate === 'number'
      ? restaurant.commissionRate
      : settings.commissionRate
  const split = computeCommissionSplit(totals.subtotal, commissionRate)
  const reference = await nextReference(payload, req)
  const deliveryCode = newDeliveryCode()
  const restaurantPoint = geoPointToLatLng(restaurant.location as GeoPoint)
  const deliveryPoint = geoPointToLatLng(address.location as GeoPoint | null | undefined)
  const now = new Date()

  const orderData = {
    amount: totals.total,
    commission: split.commission,
    commissionRate: split.commissionRate,
    contactName: user.name,
    contactPhone: input.contactPhone ?? user.phone ?? address.phone ?? undefined,
    currency: CURRENCY,
    customer: user.id,
    customerEmail: user.email,
    deliveryCode,
    deliveryFee: totals.deliveryFee,
    deliveryInstructions:
      input.deliveryInstructions ?? address.instructions ?? undefined,
    ...(deliveryPoint ? { deliveryLocation: deliveryPoint } : {}),
    estimatedDeliveryAt: new Date(
      now.getTime() + restaurant.prepTimeMaxMinutes * 60_000,
    ).toISOString(),
    fulfillmentStatus: 'pending_payment' as const,
    includeCutlery: Boolean(cart.includeCutlery),
    items: lines,
    orderNote: cart.orderNote ?? undefined,
    prepTimeMaxMinutes: restaurant.prepTimeMaxMinutes,
    prepTimeMinMinutes: restaurant.prepTimeMinMinutes,
    reference,
    restaurantAddress: restaurant.address,
    restaurantImageUrl: mediaURL(restaurant.image),
    ...(restaurantPoint ? { restaurantLocation: restaurantPoint } : {}),
    restaurantName: restaurant.name,
    restaurantPayout: split.restaurantPayout,
    serviceFee: totals.serviceFee,
    shippingAddress: {
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      country: address.country,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: input.contactPhone ?? address.phone,
      postalCode: address.postalCode,
      state: address.state,
      title: address.title,
    },
    statusHistory: appendStatusHistory([], 'pending_payment', 'Waiting for payment', now),
    subtotal: totals.subtotal,
    tenant: tenantID,
  }

  const order = await payload.create({
    collection: 'orders',
    data: orderData as never,
    // Trusted checkout path — customers cannot create orders via REST directly
    overrideAccess: true,
    req,
  })

  const stripe = getStripe()
  let paymentIntent: Stripe.PaymentIntent

  try {
    const customerId = await resolveStripeCustomerId(payload, user, stripe, req)
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totals.total,
        automatic_payment_methods: { enabled: true },
        currency: CURRENCY.toLowerCase(),
        customer: customerId,
        metadata: {
          cartID: String(cart.id),
          orderId: String(order.id),
          reference,
          userId: String(user.id),
        },
      },
      { idempotencyKey: `order_${order.id}` },
    )
  } catch (error) {
    await payload.delete({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      req,
    })
    throw error
  }

  await payload.update({
    collection: 'orders',
    data: { paymentIntentId: paymentIntent.id },
    id: order.id,
    overrideAccess: true,
    req,
  })

  // Also create a plugin transaction so admin payment history stays useful
  try {
    await payload.create({
      collection: 'transactions',
      data: {
        amount: totals.total,
        cart: cart.id,
        currency: CURRENCY,
        customer: user.id,
        items: lines.map(({ product, quantity }) => ({ product, quantity })),
        paymentMethod: 'stripe',
        status: 'pending',
        stripe: {
          customerID: paymentIntent.customer
            ? String(paymentIntent.customer)
            : undefined,
          paymentIntentID: paymentIntent.id,
        },
      },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to create checkout transaction row' })
  }

  return {
    amount: totals.total,
    clientSecret: paymentIntent.client_secret ?? '',
    currency: CURRENCY,
    orderID: String(order.id),
    paymentIntentID: paymentIntent.id,
    publishableKey,
    reference,
  }
}

const clearCustomerCart = async (
  payload: Payload,
  userID: string,
  req?: PayloadRequest,
): Promise<void> => {
  const carts = await payload.find({
    collection: 'carts',
    depth: 0,
    limit: 10,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [{ customer: { equals: userID } }, { status: { equals: 'active' } }],
    },
  })

  for (const cart of carts.docs) {
    await payload.update({
      collection: 'carts',
      data: {
        items: [],
        purchasedAt: new Date().toISOString(),
        status: 'purchased',
      } as never,
      id: cart.id,
      overrideAccess: true,
      req,
    })
  }
}

const findOrderByPaymentIntent = async (
  payload: Payload,
  paymentIntentId: string,
  req?: PayloadRequest,
) => {
  const result = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { paymentIntentId: { equals: paymentIntentId } },
  })
  return result.docs[0] ?? null
}

/** Called from a signature-verified Stripe webhook (or sync). Idempotent. */
export const markOrderPaid = async (
  payload: Payload,
  paymentIntentId: string,
  req?: PayloadRequest,
): Promise<void> => {
  const order = await findOrderByPaymentIntent(payload, paymentIntentId, req)
  if (!order) {
    payload.logger.warn({ msg: 'Paid intent has no matching order', paymentIntentId })
    return
  }

  const next = applyPaymentSucceeded({
    fulfillmentStatus: order.fulfillmentStatus,
    paidAt: order.paidAt,
    status: order.status,
    statusHistory: order.statusHistory as never,
  })

  if (!next.changed) return

  await payload.update({
    collection: 'orders',
    data: {
      fulfillmentStatus: next.fulfillmentStatus,
      paidAt: next.paidAt,
      status: next.status,
      statusHistory: next.statusHistory,
    },
    id: order.id,
    overrideAccess: true,
    req,
  })

  // Link transaction → succeeded + attach to order
  const tx = await payload.find({
    collection: 'transactions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { 'stripe.paymentIntentID': { equals: paymentIntentId } },
  })

  if (tx.docs[0]) {
    await payload.update({
      collection: 'transactions',
      data: { status: 'succeeded' },
      id: tx.docs[0].id,
      overrideAccess: true,
      req,
    })

    const existingTx = Array.isArray(order.transactions)
      ? order.transactions
          .map((t) => relationID(t))
          .filter((id): id is string => Boolean(id))
      : []
    if (!existingTx.includes(String(tx.docs[0].id))) {
      await payload.update({
        collection: 'orders',
        data: { transactions: [...existingTx, String(tx.docs[0].id)] },
        id: order.id,
        overrideAccess: true,
        req,
      })
    }
  }

  const customerID = relationID(order.customer)
  if (customerID) await clearCustomerCart(payload, customerID, req)
}

export const markOrderPaymentFailed = async (
  payload: Payload,
  paymentIntentId: string,
  req?: PayloadRequest,
): Promise<void> => {
  const order = await findOrderByPaymentIntent(payload, paymentIntentId, req)
  if (!order) return

  const next = applyPaymentFailed({
    fulfillmentStatus: order.fulfillmentStatus,
    statusHistory: order.statusHistory as never,
  })
  if (!next.changed) return

  await payload.update({
    collection: 'orders',
    data: {
      fulfillmentStatus: next.fulfillmentStatus,
      statusHistory: next.statusHistory,
    },
    id: order.id,
    overrideAccess: true,
    req,
  })
}

/**
 * Reconcile one order against Stripe when the app returns before the webhook.
 */
export const syncOrderPayment = async (
  req: PayloadRequest,
  orderID: string,
): Promise<{ orderID: string; fulfillmentStatus: string }> => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)

  const order = await req.payload.findByID({
    collection: 'orders',
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
  })

  if (relationID(order.customer) !== String(user.id) && !checkIsAdmin(user)) {
    throw new APIError('Order not found', 404)
  }

  if (order.fulfillmentStatus !== 'pending_payment' || !order.paymentIntentId) {
    return {
      fulfillmentStatus: String(order.fulfillmentStatus ?? 'pending_payment'),
      orderID: String(order.id),
    }
  }

  const intent = await getStripe().paymentIntents.retrieve(order.paymentIntentId)

  if (intent.status === 'succeeded') {
    await markOrderPaid(req.payload, order.paymentIntentId, req)
  } else if (intent.status === 'canceled') {
    await markOrderPaymentFailed(req.payload, order.paymentIntentId, req)
  }

  const refreshed = await req.payload.findByID({
    collection: 'orders',
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
  })

  return {
    fulfillmentStatus: String(refreshed.fulfillmentStatus ?? 'pending_payment'),
    orderID: String(refreshed.id),
  }
}

const checkIsAdmin = (user: User) =>
  Array.isArray(user.roles) && user.roles.includes('admin')

export type ReorderResult = { added: number; skipped: string[] }

/**
 * Rebuilds the basket from a past order. Items are re-priced from current dishes.
 */
export const reorderFromOrder = async (
  req: PayloadRequest,
  orderID: string,
): Promise<ReorderResult> => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)

  const order = await req.payload.findByID({
    collection: 'orders',
    depth: 0,
    id: orderID,
    overrideAccess: true,
    req,
  })

  if (relationID(order.customer) !== String(user.id)) {
    throw new APIError('Order not found', 404)
  }

  const additions: {
    product: string
    quantity: number
    optionIds: string[]
    optionNames: string[]
    note?: string
    unitPrice: number
  }[] = []
  const skipped: string[] = []

  for (const item of order.items ?? []) {
    const productID = relationID(item.product)
    const label = ('name' in item && item.name) || 'Item'
    if (!productID) {
      skipped.push(String(label))
      continue
    }

    let product: Product
    try {
      product = await req.payload.findByID({
        collection: 'products',
        depth: 0,
        id: productID,
        overrideAccess: true,
        req,
      })
    } catch {
      skipped.push(String(label))
      continue
    }

    if (!product.isAvailable) {
      skipped.push(product.title)
      continue
    }

    const optionIds =
      item.optionIds?.length
        ? item.optionIds.map(String)
        : optionIdsFromNames(
            { optionGroups: product.optionGroups as never },
            (item.optionNames ?? []).map(String),
          )

    try {
      const priced = priceSelection(
        {
          optionGroups: product.optionGroups as never,
          price: product.priceInUSD ?? 0,
        },
        optionIds,
      )
      additions.push({
        note: item.note ?? undefined,
        optionIds: priced.optionIds,
        optionNames: priced.optionNames,
        product: productID,
        quantity: item.quantity,
        unitPrice: priced.unitPrice,
      })
    } catch {
      skipped.push(product.title)
    }
  }

  if (!additions.length) {
    throw new APIError('None of those dishes are available right now', 400)
  }

  await clearCustomerCart(req.payload, String(user.id), req)

  const tenantID = relationID(order.tenant)
  await req.payload.create({
    collection: 'carts',
    data: {
      currency: CURRENCY,
      customer: user.id,
      items: additions,
      status: 'active',
      tenant: tenantID,
    },
    overrideAccess: true,
    req,
  })

  return { added: additions.length, skipped }
}
