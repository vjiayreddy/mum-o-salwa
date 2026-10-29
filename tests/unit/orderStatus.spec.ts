import { describe, expect, it } from 'vitest'

import {
  appendStatusHistory,
  applyPaymentFailed,
  applyPaymentSucceeded,
  canKitchenTransition,
  generateOrderReference,
  newDeliveryCode,
} from '@/commerce/orderStatus'

describe('newDeliveryCode', () => {
  it('returns a 4-digit string', () => {
    const code = newDeliveryCode()
    expect(code).toMatch(/^\d{4}$/)
    expect(Number(code)).toBeGreaterThanOrEqual(1000)
    expect(Number(code)).toBeLessThanOrEqual(9999)
  })
})

describe('generateOrderReference', () => {
  it('returns CH-####', () => {
    expect(generateOrderReference()).toMatch(/^CH-\d{4}$/)
  })
})

describe('appendStatusHistory', () => {
  it('appends without mutating the prior list', () => {
    const prior = appendStatusHistory([], 'pending_payment', 'Waiting')
    const next = appendStatusHistory(prior, 'confirmed', 'Paid')
    expect(prior).toHaveLength(1)
    expect(next).toHaveLength(2)
    expect(next[1]?.status).toBe('confirmed')
    expect(next[1]?.note).toBe('Paid')
  })
})

describe('applyPaymentSucceeded', () => {
  it('moves pending_payment → confirmed + processing', () => {
    const result = applyPaymentSucceeded({
      fulfillmentStatus: 'pending_payment',
      statusHistory: [{ at: '2026-01-01T00:00:00.000Z', status: 'pending_payment' }],
    })
    expect(result.changed).toBe(true)
    expect(result.fulfillmentStatus).toBe('confirmed')
    expect(result.status).toBe('processing')
    expect(result.statusHistory.at(-1)?.status).toBe('confirmed')
  })

  it('is a no-op once already confirmed', () => {
    const result = applyPaymentSucceeded({
      fulfillmentStatus: 'confirmed',
      paidAt: '2026-01-01T00:00:00.000Z',
      status: 'processing',
      statusHistory: [{ at: '2026-01-01T00:00:00.000Z', status: 'confirmed' }],
    })
    expect(result.changed).toBe(false)
    expect(result.fulfillmentStatus).toBe('confirmed')
  })

  it('allows recovery from payment_failed', () => {
    const result = applyPaymentSucceeded({ fulfillmentStatus: 'payment_failed' })
    expect(result.changed).toBe(true)
    expect(result.fulfillmentStatus).toBe('confirmed')
  })
})

describe('applyPaymentFailed', () => {
  it('marks pending_payment as payment_failed', () => {
    const result = applyPaymentFailed({ fulfillmentStatus: 'pending_payment' })
    expect(result.changed).toBe(true)
    expect(result.fulfillmentStatus).toBe('payment_failed')
  })

  it('does not rewind a confirmed order', () => {
    const result = applyPaymentFailed({ fulfillmentStatus: 'confirmed' })
    expect(result.changed).toBe(false)
  })
})

describe('canKitchenTransition', () => {
  it('allows confirmed → preparing', () => {
    expect(canKitchenTransition('confirmed', 'preparing')).toBe(true)
  })

  it('blocks ready → preparing', () => {
    expect(canKitchenTransition('ready', 'preparing')).toBe(false)
  })
})
