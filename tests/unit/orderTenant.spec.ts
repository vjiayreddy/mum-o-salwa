import { describe, expect, it } from 'vitest'

import {
  productIDsFromOrderItems,
  relationID,
  tenantIDFromPopulatedProduct,
  tenantIDFromProductMap,
} from '@/commerce/orderTenant'

describe('relationID', () => {
  it('reads string, number, and populated docs', () => {
    expect(relationID('abc')).toBe('abc')
    expect(relationID(42)).toBe('42')
    expect(relationID({ id: 'x' })).toBe('x')
    expect(relationID(null)).toBeNull()
  })
})

describe('productIDsFromOrderItems', () => {
  it('collects unique product ids from order lines', () => {
    expect(
      productIDsFromOrderItems([
        { product: 'p1' },
        { product: { id: 'p2' } },
        { product: 'p1' },
        { product: null },
      ]),
    ).toEqual(['p1', 'p2'])
  })
})

describe('tenantIDFromProductMap', () => {
  it('returns the first mapped tenant', () => {
    const map = new Map([
      ['p1', 'tenant-a'],
      ['p2', 'tenant-b'],
    ])
    expect(tenantIDFromProductMap(['p2', 'p1'], map)).toBe('tenant-b')
    expect(tenantIDFromProductMap(['missing'], map)).toBeNull()
  })
})

describe('tenantIDFromPopulatedProduct', () => {
  it('reads nested tenant on a product doc', () => {
    expect(tenantIDFromPopulatedProduct({ id: 'p1', tenant: 't1' })).toBe('t1')
    expect(tenantIDFromPopulatedProduct({ id: 'p1', tenant: { id: 't2' } })).toBe('t2')
    expect(tenantIDFromPopulatedProduct('p1')).toBeNull()
  })
})
