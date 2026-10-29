import { describe, expect, it } from 'vitest'

import {
  CartRuleError,
  cartLineKey,
  deliveryCartItemMatcher,
  enforceOneRestaurant,
  optionIdsFromNames,
  priceSelection,
} from '@/commerce/cartRules'

const dish = {
  optionGroups: [
    {
      name: 'Size',
      options: [
        { id: 'opt-s', name: 'Small', priceDelta: 0 },
        { id: 'opt-l', name: 'Large', priceDelta: 200 },
      ],
      required: true,
      type: 'single' as const,
    },
    {
      name: 'Extras',
      options: [
        { id: 'opt-c', name: 'Cheese', priceDelta: 150 },
        { id: 'opt-b', name: 'Bacon', priceDelta: 200 },
      ],
      required: false,
      type: 'multiple' as const,
    },
  ],
  price: 1000,
}

describe('priceSelection', () => {
  it('adds option deltas to the dish base price', () => {
    expect(priceSelection(dish, ['opt-l', 'opt-c'])).toEqual({
      optionIds: ['opt-l', 'opt-c'],
      optionNames: ['Large', 'Cheese'],
      unitPrice: 1350,
    })
  })

  it('requires a choice for required groups', () => {
    expect(() => priceSelection(dish, ['opt-c'])).toThrow(CartRuleError)
  })

  it('rejects more than one choice in a single group', () => {
    expect(() => priceSelection(dish, ['opt-s', 'opt-l'])).toThrow(/Only one choice/)
  })

  it('rejects unknown option ids', () => {
    expect(() => priceSelection(dish, ['opt-s', 'nope'])).toThrow(/not available/)
  })
})

describe('optionIdsFromNames', () => {
  it('maps snapshot names back to current ids', () => {
    expect(optionIdsFromNames(dish, ['Large', 'Bacon'])).toEqual(['opt-l', 'opt-b'])
  })
})

describe('cartLineKey / deliveryCartItemMatcher', () => {
  it('treats identical product+options+note as the same line', () => {
    expect(
      cartLineKey({ note: 'no onion', optionIds: ['b', 'a'], product: 'p1' }),
    ).toBe(cartLineKey({ note: 'no onion', optionIds: ['a', 'b'], product: 'p1' }))

    expect(
      deliveryCartItemMatcher({
        existingItem: {
          note: 'no onion',
          optionIds: ['a', 'b'],
          product: { id: 'p1' },
          quantity: 1,
        },
        newItem: { note: 'no onion', optionIds: ['b', 'a'], product: 'p1' },
      }),
    ).toBe(true)
  })

  it('does not merge different notes or option sets', () => {
    expect(
      deliveryCartItemMatcher({
        existingItem: { note: 'a', optionIds: ['x'], product: 'p1', quantity: 1 },
        newItem: { note: 'b', optionIds: ['x'], product: 'p1' },
      }),
    ).toBe(false)

    expect(
      deliveryCartItemMatcher({
        existingItem: { optionIds: ['x'], product: 'p1', quantity: 1 },
        newItem: { optionIds: ['y'], product: 'p1' },
      }),
    ).toBe(false)
  })
})

describe('enforceOneRestaurant', () => {
  it('keeps only lines from the newest item tenant', () => {
    const tenantByProductID = new Map([
      ['dish-a', 'rest-1'],
      ['dish-b', 'rest-1'],
      ['dish-c', 'rest-2'],
    ])

    const result = enforceOneRestaurant(
      [
        { product: 'dish-a', quantity: 1 },
        { product: 'dish-b', quantity: 2 },
        { product: 'dish-c', quantity: 1 },
      ],
      tenantByProductID,
    )

    expect(result.tenantID).toBe('rest-2')
    expect(result.items).toEqual([{ product: 'dish-c', quantity: 1 }])
  })

  it('returns empty when the cart has no items', () => {
    expect(enforceOneRestaurant([], new Map())).toEqual({ items: [], tenantID: null })
  })
})
