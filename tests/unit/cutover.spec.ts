import { describe, expect, it } from 'vitest'

import {
  EXPRESS_RETIRED_NOTICE,
  EXPO_API_BASE_HINT,
  EXPO_CUTOVER_ROUTES,
  resolvePayloadPath,
} from '@/commerce/cutover'

describe('EXPO_CUTOVER_ROUTES', () => {
  it('maps customer checkout and driver claim onto Payload paths', () => {
    expect(resolvePayloadPath('/orders', 'POST')).toBe('/orders/create-checkout')
    expect(resolvePayloadPath('/orders/:id/sync', 'POST')).toBe('/orders/:id/sync-payment')
    expect(resolvePayloadPath('/driver/home', 'GET')).toBe('/drivers/home')
    expect(resolvePayloadPath('/driver/deliveries/:id/claim', 'POST')).toBe(
      '/drivers/deliveries/:id/claim',
    )
    expect(resolvePayloadPath('/restaurants/:slug', 'GET')).toBe('/restaurants/:slug')
    expect(resolvePayloadPath('/banners/active', 'GET')).toBe('/banners/active')
  })

  it('returns null for unknown Express paths', () => {
    expect(resolvePayloadPath('/legacy/unknown', 'GET')).toBeNull()
  })

  it('keeps every route unique per method+express path', () => {
    const keys = EXPO_CUTOVER_ROUTES.map((route) => `${route.method} ${route.express}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('cutover constants', () => {
  it('documents Payload API base and Express retirement', () => {
    expect(EXPO_API_BASE_HINT).toContain('3000/api')
    expect(EXPRESS_RETIRED_NOTICE).toMatch(/retired/i)
    expect(EXPRESS_RETIRED_NOTICE).toMatch(/8000/)
  })
})
