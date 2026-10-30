import { describe, expect, it } from 'vitest'

import {
  applyClaimDelivery,
  applyCompleteDelivery,
  applyPickupDelivery,
  orderDriverID,
  orderHasDriver,
} from '@/commerce/orderStatus'

const payout = { base: 490, distance: 120, distanceKm: 1, total: 610 }
const driver = {
  name: 'Alex',
  phone: '+15551212',
  rating: 4.8,
  ratingCount: 12,
  user: 'driver-1',
}

describe('orderHasDriver / orderDriverID', () => {
  it('detects assigned riders', () => {
    expect(orderHasDriver({})).toBe(false)
    expect(orderHasDriver({ driver: { name: 'Alex' } })).toBe(true)
    expect(orderDriverID({ driver: { user: 'driver-1' } })).toBe('driver-1')
  })
})

describe('applyClaimDelivery', () => {
  it('snapshots rider + payout on a ready order', () => {
    const result = applyClaimDelivery(
      {
        fulfillmentStatus: 'ready',
        statusHistory: [{ at: '2026-01-01T00:00:00.000Z', status: 'ready' }],
      },
      driver,
      payout,
    )
    expect(result.driver.user).toBe('driver-1')
    expect(result.driverPayout.total).toBe(610)
    expect(result.statusHistory.at(-1)?.note).toContain('Alex')
    expect(result.statusHistory.at(-1)?.status).toBe('ready')
  })

  it('rejects non-ready orders', () => {
    expect(() =>
      applyClaimDelivery({ fulfillmentStatus: 'preparing' }, driver, payout),
    ).toThrow(/not ready/)
  })

  it('rejects when another rider already claimed', () => {
    expect(() =>
      applyClaimDelivery(
        {
          driver: { name: 'Sam', user: 'driver-2' },
          fulfillmentStatus: 'ready',
        },
        driver,
        payout,
      ),
    ).toThrow(/Another rider/)
  })

  it('rejects double-claim by the same rider', () => {
    expect(() =>
      applyClaimDelivery(
        {
          driver: { name: 'Alex', user: 'driver-1' },
          fulfillmentStatus: 'ready',
        },
        driver,
        payout,
      ),
    ).toThrow(/already claimed/)
  })
})

describe('applyPickupDelivery', () => {
  it('moves ready → out_for_delivery for the assigned rider', () => {
    const result = applyPickupDelivery(
      {
        driver: { name: 'Alex', user: 'driver-1' },
        fulfillmentStatus: 'ready',
        statusHistory: [],
      },
      'driver-1',
    )
    expect(result.fulfillmentStatus).toBe('out_for_delivery')
    expect(result.statusHistory.at(-1)?.note).toContain('picked up')
  })

  it('rejects other riders', () => {
    expect(() =>
      applyPickupDelivery(
        {
          driver: { user: 'driver-1' },
          fulfillmentStatus: 'ready',
        },
        'driver-2',
      ),
    ).toThrow(/not found/)
  })

  it('rejects when already en route', () => {
    expect(() =>
      applyPickupDelivery(
        {
          driver: { user: 'driver-1' },
          fulfillmentStatus: 'out_for_delivery',
        },
        'driver-1',
      ),
    ).toThrow(/already on its way/)
  })
})

describe('applyCompleteDelivery', () => {
  it('completes with a matching door code', () => {
    const result = applyCompleteDelivery(
      {
        deliveryCode: '4242',
        driver: { user: 'driver-1' },
        fulfillmentStatus: 'out_for_delivery',
        statusHistory: [],
      },
      'driver-1',
      '4242',
    )
    expect(result.fulfillmentStatus).toBe('delivered')
    expect(result.status).toBe('completed')
  })

  it('rejects a wrong code', () => {
    expect(() =>
      applyCompleteDelivery(
        {
          deliveryCode: '4242',
          driver: { user: 'driver-1' },
          fulfillmentStatus: 'out_for_delivery',
        },
        'driver-1',
        '9999',
      ),
    ).toThrow(/does not match/)
  })

  it('requires pickup first', () => {
    expect(() =>
      applyCompleteDelivery(
        {
          deliveryCode: '4242',
          driver: { user: 'driver-1' },
          fulfillmentStatus: 'ready',
        },
        'driver-1',
        '4242',
      ),
    ).toThrow(/Pick the order up/)
  })
})
