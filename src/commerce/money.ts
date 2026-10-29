/**
 * Money helpers for food delivery.
 * All amounts are integer minor units (cents). Rates are decimals (0.25 = 25%).
 */

export type LatLng = {
  lat: number
  lng: number
}

/** Payload `point` fields store GeoJSON order: [longitude, latitude]. */
export type GeoPoint = [longitude: number, latitude: number]

export type BasketLine = {
  unitPrice: number
  quantity: number
}

export type RestaurantFees = {
  deliveryFee: number
  minOrder: number
  freeDeliveryThreshold?: number | null
}

export type BasketTotals = {
  subtotal: number
  deliveryFee: number
  serviceFee: number
  total: number
  itemCount: number
  minOrder: number
  belowMinimum: boolean
  freeDeliveryThreshold: number | null
  /** Extra cents needed to unlock free delivery, or null when not applicable. */
  amountToFreeDelivery: number | null
}

export type CommissionSplit = {
  commissionRate: number
  commission: number
  restaurantPayout: number
}

export type DriverPayRates = {
  basePay: number
  payPerKm: number
}

export type DriverPayout = {
  base: number
  distance: number
  distanceKm: number
  total: number
}

const EARTH_RADIUS_KM = 6371

const EMPTY_TOTALS: BasketTotals = {
  amountToFreeDelivery: null,
  belowMinimum: false,
  deliveryFee: 0,
  freeDeliveryThreshold: null,
  itemCount: 0,
  minOrder: 0,
  serviceFee: 0,
  subtotal: 0,
  total: 0,
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export const geoPointToLatLng = (point?: GeoPoint | null): LatLng | undefined => {
  if (!point || point.length < 2) return undefined
  const [lng, lat] = point
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined
  return { lat, lng }
}

/** Straight-line distance. Road distance needs a routing service. */
export const distanceKm = (from?: LatLng | null, to?: LatLng | null): number => {
  if (!from || !to) return 0

  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Customer-facing basket totals from stored unit prices and restaurant fees.
 * Never trust client-submitted totals.
 */
export const computeBasketTotals = (
  items: BasketLine[] | null | undefined,
  restaurant: RestaurantFees | null | undefined,
  serviceFeeRate: number,
): BasketTotals => {
  if (!items?.length || !restaurant) return EMPTY_TOTALS

  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
  const itemCount = items.reduce((count, item) => count + item.quantity, 0)

  const threshold = restaurant.freeDeliveryThreshold ?? null
  const earnedFreeDelivery = threshold !== null && subtotal >= threshold
  const deliveryFee = earnedFreeDelivery ? 0 : restaurant.deliveryFee
  const serviceFee = Math.round(subtotal * serviceFeeRate)

  return {
    amountToFreeDelivery:
      threshold !== null && !earnedFreeDelivery ? threshold - subtotal : null,
    belowMinimum: subtotal < restaurant.minOrder,
    deliveryFee,
    freeDeliveryThreshold: threshold,
    itemCount,
    minOrder: restaurant.minOrder,
    serviceFee,
    subtotal,
    total: subtotal + deliveryFee + serviceFee,
  }
}

/** Platform cut of food subtotal, and what the restaurant is owed after it. */
export const computeCommissionSplit = (
  subtotal: number,
  commissionRate: number,
): CommissionSplit => {
  const commission = Math.round(subtotal * commissionRate)

  return {
    commission,
    commissionRate,
    restaurantPayout: subtotal - commission,
  }
}

/**
 * Rider pay: flat fee + distance, snapshotted at claim time so later rate
 * changes never rewrite what a rider already earned.
 */
export const computeDriverPayout = (
  from: LatLng | null | undefined,
  to: LatLng | null | undefined,
  rates: DriverPayRates,
): DriverPayout => {
  const km = distanceKm(from, to)
  const distance = Math.round(km * rates.payPerKm)

  return {
    base: rates.basePay,
    distance,
    distanceKm: Math.round(km * 10) / 10,
    total: rates.basePay + distance,
  }
}
