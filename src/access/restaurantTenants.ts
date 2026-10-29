import type { Access, Where } from 'payload'

import { checkRole } from '@/access/utilities'
import type { User } from '@/payload-types'

export type TenantStaffRole = 'owner' | 'kitchen'

type TenantRow = NonNullable<NonNullable<User['tenants']>[number]>

const relationID = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

const tenantRowID = (row: TenantRow): string | null => relationID(row.tenant)

/**
 * Tenant IDs the user belongs to. Optionally require an owner/kitchen role
 * on that membership row.
 */
export const getRestaurantTenantIDs = (
  user: User | null | undefined,
  roles?: TenantStaffRole[],
): string[] => {
  if (!user?.tenants?.length) return []

  return user.tenants.reduce<string[]>((ids, row) => {
    if (!row) return ids
    if (roles?.length) {
      const rowRoles = row.roles ?? []
      if (!roles.some((role) => rowRoles.includes(role))) return ids
    }
    const id = tenantRowID(row)
    if (id) ids.push(id)
    return ids
  }, [])
}

export const isRestaurantStaff = (user: User | null | undefined): boolean =>
  Boolean(user && checkRole(['restaurant'], user))

/** Admin, or any authenticated restaurant user (tenant scope applied by multi-tenant). */
export const adminOrRestaurant: Access = ({ req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user as User)) return true
  return isRestaurantStaff(user as User)
}

/**
 * Orders read: platform admin, the customer who placed it, or restaurant staff
 * for that order's tenant. Orders use `useTenantAccess: false`, so this query
 * constraint carries the restaurant scope.
 */
export const adminCustomerOrRestaurantOrder: Access = ({ req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user as User)) return true

  const constraints: Where[] = []

  if (user.id) {
    constraints.push({ customer: { equals: user.id } })
  }

  if (isRestaurantStaff(user as User)) {
    const tenantIDs = getRestaurantTenantIDs(user as User)
    if (tenantIDs.length) {
      constraints.push({ tenant: { in: tenantIDs } })
    }
  }

  if (constraints.length === 0) return false
  if (constraints.length === 1) return constraints[0]!
  return { or: constraints }
}

/** Orders update: admin or restaurant staff scoped to their tenants (kitchen path). */
export const adminOrRestaurantOrderUpdate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user as User)) return true

  if (isRestaurantStaff(user as User)) {
    const tenantIDs = getRestaurantTenantIDs(user as User)
    if (!tenantIDs.length) return false
    return { tenant: { in: tenantIDs } }
  }

  return false
}

/** True when the user may act on orders for this restaurant tenant. */
export const userCanAccessTenant = (
  user: User | null | undefined,
  tenantID: string | null | undefined,
): boolean => {
  if (!user || !tenantID) return false
  if (checkRole(['admin'], user)) return true
  if (!isRestaurantStaff(user)) return false
  return getRestaurantTenantIDs(user).includes(String(tenantID))
}
