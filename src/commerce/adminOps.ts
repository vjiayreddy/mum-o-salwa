import { APIError, type PayloadRequest } from 'payload'

import { checkRole } from '@/access/utilities'
import type { User } from '@/payload-types'

export type DriverStatusValue = 'pending' | 'approved' | 'suspended'

const assertAdmin = (req: PayloadRequest): User => {
  const user = req.user as User | null
  if (!user) throw new APIError('Unauthorized', 401)
  if (!checkRole(['admin'], user)) throw new APIError('Forbidden', 403)
  return user
}

const loadUser = async (req: PayloadRequest, id: string): Promise<User> => {
  try {
    return (await req.payload.findByID({
      collection: 'users',
      depth: 0,
      id,
      overrideAccess: true,
      req,
    })) as User
  } catch {
    throw new APIError('User not found', 404)
  }
}

const hasRole = (user: User, role: NonNullable<User['roles']>[number]): boolean =>
  Array.isArray(user.roles) && user.roles.includes(role)

/**
 * Suspend / reinstate a customer. Login hooks refuse inactive accounts, so the
 * next request signs them out of the apps.
 */
export const setCustomerActive = async (
  req: PayloadRequest,
  customerID: string,
  isActive: boolean,
): Promise<User> => {
  assertAdmin(req)
  const customer = await loadUser(req, customerID)

  if (!hasRole(customer, 'customer')) {
    throw new APIError('Customer not found', 404)
  }

  return (await req.payload.update({
    collection: 'users',
    data: { isActive },
    depth: 0,
    id: customerID,
    overrideAccess: true,
    req,
  })) as User
}

/**
 * Approve, suspend, or reinstate a rider. Leaving approved status forces them
 * offline so they cannot sit in the claim queue.
 */
export const updateRiderAccount = async (
  req: PayloadRequest,
  riderID: string,
  input: { driverStatus?: DriverStatusValue; isActive?: boolean },
): Promise<User> => {
  assertAdmin(req)
  const rider = await loadUser(req, riderID)

  if (!hasRole(rider, 'driver')) {
    throw new APIError('Rider not found', 404)
  }

  if (input.driverStatus === undefined && input.isActive === undefined) {
    throw new APIError('Provide driverStatus and/or isActive', 400)
  }

  if (
    input.driverStatus !== undefined &&
    input.driverStatus !== 'pending' &&
    input.driverStatus !== 'approved' &&
    input.driverStatus !== 'suspended'
  ) {
    throw new APIError('Invalid driverStatus', 400)
  }

  const data: {
    driverStatus?: DriverStatusValue
    isActive?: boolean
    isOnline?: boolean
  } = {}

  if (input.driverStatus !== undefined) {
    data.driverStatus = input.driverStatus
    if (input.driverStatus !== 'approved') {
      data.isOnline = false
    }
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive
    if (input.isActive === false) {
      data.isOnline = false
    }
  }

  return (await req.payload.update({
    collection: 'users',
    data,
    depth: 0,
    id: riderID,
    overrideAccess: true,
    req,
  })) as User
}
