import { describe, expect, it } from 'vitest'

import {
  computeBasketTotals,
  computeCommissionSplit,
  computeDriverPayout,
  distanceKm,
  geoPointToLatLng,
} from '@/commerce/money'

describe('geoPointToLatLng', () => {
  it('converts Payload [lng, lat] to lat/lng', () => {
    expect(geoPointToLatLng([-0.1276, 51.5072])).toEqual({ lat: 51.5072, lng: -0.1276 })
  })

  it('returns undefined for empty points', () => {
    expect(geoPointToLatLng(null)).toBeUndefined()
    expect(geoPointToLatLng([] as never)).toBeUndefined()
  })
})

describe('distanceKm', () => {
  it('returns 0 when either point is missing', () => {
    expect(distanceKm(undefined, { lat: 0, lng: 0 })).toBe(0)
  })

  it('measures ~same point as ~0 km', () => {
    const p = { lat: 51.5072, lng: -0.1276 }
    expect(distanceKm(p, p)).toBe(0)
  })

  it('is roughly correct for a known London span', () => {
    // Trafalgar Square → London Eye is about 1 km
    const from = { lat: 51.5081, lng: -0.1281 }
    const to = { lat: 51.5033, lng: -0.1195 }
    const km = distanceKm(from, to)
    expect(km).toBeGreaterThan(0.7)
    expect(km).toBeLessThan(1.4)
  })
})

describe('computeBasketTotals', () => {
  const restaurant = {
    deliveryFee: 490,
    freeDeliveryThreshold: 2500,
    minOrder: 1000,
  }

  it('returns empty totals for an empty basket', () => {
    expect(computeBasketTotals([], restaurant, 0.05)).toMatchObject({
      deliveryFee: 0,
      itemCount: 0,
      subtotal: 0,
      total: 0,
    })
  })

  it('charges delivery + rounded service fee under the free threshold', () => {
    const totals = computeBasketTotals(
      [
        { quantity: 2, unitPrice: 800 },
        { quantity: 1, unitPrice: 400 },
      ],
      restaurant,
      0.05,
    )

    // subtotal 2000; serviceFee round(100)=100; delivery 490
    expect(totals).toEqual({
      amountToFreeDelivery: 500,
      belowMinimum: false,
      deliveryFee: 490,
      freeDeliveryThreshold: 2500,
      itemCount: 3,
      minOrder: 1000,
      serviceFee: 100,
      subtotal: 2000,
      total: 2590,
    })
  })

  it('waives delivery at/above free threshold and flags below-minimum', () => {
    const totals = computeBasketTotals([{ quantity: 1, unitPrice: 2500 }], restaurant, 0.05)

    expect(totals.deliveryFee).toBe(0)
    expect(totals.amountToFreeDelivery).toBeNull()
    expect(totals.serviceFee).toBe(125)
    expect(totals.total).toBe(2625)

    const small = computeBasketTotals([{ quantity: 1, unitPrice: 500 }], restaurant, 0.05)
    expect(small.belowMinimum).toBe(true)
  })

  it('rounds service fee with Math.round', () => {
    // 999 * 0.05 = 49.95 → 50
    expect(computeBasketTotals([{ quantity: 1, unitPrice: 999 }], restaurant, 0.05).serviceFee).toBe(
      50,
    )
  })
})

describe('computeCommissionSplit', () => {
  it('splits food subtotal between platform and restaurant', () => {
    expect(computeCommissionSplit(2000, 0.25)).toEqual({
      commission: 500,
      commissionRate: 0.25,
      restaurantPayout: 1500,
    })
  })

  it('rounds commission', () => {
    // 1001 * 0.25 = 250.25 → 250
    expect(computeCommissionSplit(1001, 0.25).commission).toBe(250)
  })
})

describe('computeDriverPayout', () => {
  it('pays base + rounded distance fee', () => {
    const from = { lat: 51.5081, lng: -0.1281 }
    const to = { lat: 51.5033, lng: -0.1195 }
    const payout = computeDriverPayout(from, to, { basePay: 490, payPerKm: 120 })

    expect(payout.base).toBe(490)
    expect(payout.distanceKm).toBeGreaterThan(0)
    expect(payout.total).toBe(payout.base + payout.distance)
    expect(Number.isInteger(payout.distance)).toBe(true)
  })

  it('falls back to base-only when locations are missing', () => {
    expect(computeDriverPayout(null, null, { basePay: 490, payPerKm: 120 })).toEqual({
      base: 490,
      distance: 0,
      distanceKm: 0,
      total: 490,
    })
  })
})
