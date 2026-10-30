import { describe, expect, it } from 'vitest'

import {
  adminCustomerOrRestaurantOrder,
  adminOrRestaurant,
  adminOrRestaurantOrderUpdate,
  getRestaurantTenantIDs,
  userCanAccessTenant,
} from '@/access/restaurantTenants'
import type { User } from '@/payload-types'

const restaurantUser = {
  id: 'user-1',
  roles: ['restaurant'],
  tenants: [
    { roles: ['owner'], tenant: 'tenant-a' },
    { roles: ['kitchen'], tenant: 'tenant-b' },
  ],
} as unknown as User

const customerUser = {
  id: 'user-2',
  roles: ['customer'],
  tenants: [],
} as unknown as User

const adminUser = {
  id: 'admin-1',
  roles: ['admin'],
} as unknown as User

const driverUser = {
  id: 'driver-1',
  roles: ['driver'],
} as unknown as User

describe('getRestaurantTenantIDs', () => {
  it('returns all memberships', () => {
    expect(getRestaurantTenantIDs(restaurantUser)).toEqual(['tenant-a', 'tenant-b'])
  })

  it('filters by staff role', () => {
    expect(getRestaurantTenantIDs(restaurantUser, ['owner'])).toEqual(['tenant-a'])
    expect(getRestaurantTenantIDs(restaurantUser, ['kitchen'])).toEqual(['tenant-b'])
  })
})

describe('userCanAccessTenant', () => {
  it('allows admin for any tenant', () => {
    expect(userCanAccessTenant(adminUser, 'tenant-z')).toBe(true)
  })

  it('allows restaurant staff only for assigned tenants', () => {
    expect(userCanAccessTenant(restaurantUser, 'tenant-a')).toBe(true)
    expect(userCanAccessTenant(restaurantUser, 'tenant-z')).toBe(false)
    expect(userCanAccessTenant(customerUser, 'tenant-a')).toBe(false)
  })
})

describe('access helpers', () => {
  it('adminOrRestaurant allows restaurant staff', () => {
    expect(adminOrRestaurant({ req: { user: restaurantUser } } as never)).toBe(true)
    expect(adminOrRestaurant({ req: { user: customerUser } } as never)).toBe(false)
  })

  it('order read combines customer ownership and tenant scope', () => {
    expect(adminCustomerOrRestaurantOrder({ req: { user: adminUser } } as never)).toBe(true)
    expect(adminCustomerOrRestaurantOrder({ req: { user: customerUser } } as never)).toEqual({
      customer: { equals: 'user-2' },
    })
    expect(adminCustomerOrRestaurantOrder({ req: { user: restaurantUser } } as never)).toEqual({
      or: [
        { customer: { equals: 'user-1' } },
        { tenant: { in: ['tenant-a', 'tenant-b'] } },
      ],
    })
  })

  it('order read lets drivers see the ready queue and their claimed jobs', () => {
    expect(adminCustomerOrRestaurantOrder({ req: { user: driverUser } } as never)).toEqual({
      or: [
        { customer: { equals: 'driver-1' } },
        {
          and: [
            { fulfillmentStatus: { equals: 'ready' } },
            {
              or: [
                { 'driver.user': { exists: false } },
                { 'driver.user': { equals: null } },
              ],
            },
          ],
        },
        { 'driver.user': { equals: 'driver-1' } },
      ],
    })
  })

  it('order update is tenant-scoped for restaurant staff', () => {
    expect(adminOrRestaurantOrderUpdate({ req: { user: restaurantUser } } as never)).toEqual({
      tenant: { in: ['tenant-a', 'tenant-b'] },
    })
    expect(adminOrRestaurantOrderUpdate({ req: { user: customerUser } } as never)).toBe(false)
  })
})
