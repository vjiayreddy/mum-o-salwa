import { describe, expect, it } from 'vitest'

import { mapDish, mapRestaurant } from '@/commerce/catalogue'
import type { Product, Tenant } from '@/payload-types'

const baseTenant = {
  address: '12 High St',
  categories: [],
  closesAt: '22:00',
  createdAt: '2026-01-01T00:00:00.000Z',
  cuisines: ['Grill'],
  deliveryFee: 490,
  description: 'Neighbourhood grill',
  id: 'rest-1',
  isActive: true,
  isOpen: true,
  location: [0, 0],
  minOrder: 1000,
  name: 'Smoke House',
  prepTimeMaxMinutes: 40,
  prepTimeMinMinutes: 25,
  rating: 4.5,
  ratingCount: 12,
  slug: 'smoke-house',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Tenant

describe('mapRestaurant', () => {
  it('exposes catalogue fields for storefront cards', () => {
    const mapped = mapRestaurant({
      ...baseTenant,
      image: { id: 'm1', url: 'https://cdn.example/rest.jpg' } as Tenant['image'],
    })

    expect(mapped).toMatchObject({
      deliveryFee: 490,
      id: 'rest-1',
      imageUrl: 'https://cdn.example/rest.jpg',
      isOpen: true,
      name: 'Smoke House',
      slug: 'smoke-house',
    })
  })

  it('treats missing isOpen as open', () => {
    expect(mapRestaurant({ ...baseTenant, isOpen: null }).isOpen).toBe(true)
  })
})

describe('mapDish', () => {
  it('maps dish pricing and option groups', () => {
    const dish = mapDish({
      allergens: ['dairy'],
      gallery: [{ image: { id: 'img', url: 'https://cdn.example/dish.jpg' } }],
      id: 'dish-1',
      isAvailable: true,
      isPopular: true,
      optionGroups: [
        {
          id: 'g1',
          name: 'Size',
          options: [
            { id: 'o1', isDefault: true, name: 'Regular', priceDelta: 0 },
            { id: 'o2', isDefault: false, name: 'Large', priceDelta: 200 },
          ],
          required: true,
          type: 'single',
        },
      ],
      priceInUSD: 1290,
      section: 'Mains',
      slug: 'smoke-house-brisket',
      tenant: 'rest-1',
      title: 'Brisket Bowl',
    } as Product)

    expect(dish).toMatchObject({
      id: 'dish-1',
      imageUrl: 'https://cdn.example/dish.jpg',
      name: 'Brisket Bowl',
      price: 1290,
      restaurantId: 'rest-1',
      section: 'Mains',
    })
    expect(dish?.optionGroups[0]?.options).toHaveLength(2)
  })

  it('returns null when tenant is missing', () => {
    expect(
      mapDish({
        id: 'orphan',
        priceInUSD: 100,
        title: 'Orphan',
      } as Product),
    ).toBeNull()
  })
})
