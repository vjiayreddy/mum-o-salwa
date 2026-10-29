import { describe, expect, it } from 'vitest'

import {
  applyKitchenTransition,
  applyReleaseRider,
  canKitchenTransition,
  canReleaseRider,
  canSystemTransition,
} from '@/commerce/orderStatus'

describe('canKitchenTransition', () => {
  it('allows the kitchen path', () => {
    expect(canKitchenTransition('confirmed', 'preparing')).toBe(true)
    expect(canKitchenTransition('confirmed', 'cancelled')).toBe(true)
    expect(canKitchenTransition('preparing', 'ready')).toBe(true)
    expect(canKitchenTransition('preparing', 'cancelled')).toBe(true)
    expect(canKitchenTransition('ready', 'cancelled')).toBe(true)
  })

  it('blocks driver and reverse moves', () => {
    expect(canKitchenTransition('ready', 'preparing')).toBe(false)
    expect(canKitchenTransition('ready', 'out_for_delivery')).toBe(false)
    expect(canKitchenTransition('out_for_delivery', 'delivered')).toBe(false)
  })
})

describe('canSystemTransition', () => {
  it('allows payment and release-rider moves', () => {
    expect(canSystemTransition('pending_payment', 'confirmed')).toBe(true)
    expect(canSystemTransition('pending_payment', 'payment_failed')).toBe(true)
    expect(canSystemTransition('payment_failed', 'confirmed')).toBe(true)
    expect(canSystemTransition('out_for_delivery', 'ready')).toBe(true)
  })
})

describe('applyKitchenTransition', () => {
  it('moves confirmed → preparing and appends history', () => {
    const result = applyKitchenTransition(
      {
        fulfillmentStatus: 'confirmed',
        statusHistory: [{ at: '2026-01-01T00:00:00.000Z', status: 'confirmed' }],
      },
      'preparing',
      'Kitchen Staff',
    )
    expect(result.fulfillmentStatus).toBe('preparing')
    expect(result.status).toBeUndefined()
    expect(result.statusHistory.at(-1)?.status).toBe('preparing')
    expect(result.statusHistory.at(-1)?.note).toContain('Kitchen Staff')
  })

  it('cancels plugin settlement status when cancelling', () => {
    const result = applyKitchenTransition(
      { fulfillmentStatus: 'preparing', status: 'processing' },
      'cancelled',
      'Admin',
    )
    expect(result.fulfillmentStatus).toBe('cancelled')
    expect(result.status).toBe('cancelled')
  })

  it('rejects illegal transitions', () => {
    expect(() =>
      applyKitchenTransition({ fulfillmentStatus: 'ready' }, 'preparing', 'Admin'),
    ).toThrow(/cannot be moved/)
  })
})

describe('applyReleaseRider', () => {
  it('clears the rider and returns ready', () => {
    const result = applyReleaseRider(
      {
        driver: { name: 'Alex', user: 'driver-1' },
        fulfillmentStatus: 'out_for_delivery',
        statusHistory: [{ at: '2026-01-01T00:00:00.000Z', status: 'out_for_delivery' }],
      },
      'Ops Admin',
    )
    expect(result.driver).toBeNull()
    expect(result.driverPayout).toBeNull()
    expect(result.fulfillmentStatus).toBe('ready')
    expect(result.statusHistory.at(-1)?.note).toContain('Alex')
    expect(result.statusHistory.at(-1)?.note).toContain('Ops Admin')
  })

  it('allows release while still ready with an assigned rider', () => {
    expect(canReleaseRider('ready')).toBe(true)
    const result = applyReleaseRider(
      {
        driver: { name: 'Sam', user: 'driver-2' },
        fulfillmentStatus: 'ready',
      },
      'Admin',
    )
    expect(result.fulfillmentStatus).toBe('ready')
  })

  it('rejects when no rider is assigned', () => {
    expect(() =>
      applyReleaseRider({ fulfillmentStatus: 'out_for_delivery' }, 'Admin'),
    ).toThrow(/No rider/)
  })

  it('rejects delivered orders', () => {
    expect(() =>
      applyReleaseRider(
        {
          driver: { name: 'Alex', user: 'driver-1' },
          fulfillmentStatus: 'delivered',
        },
        'Admin',
      ),
    ).toThrow(/on its way/)
  })
})
