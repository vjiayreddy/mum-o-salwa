import { addDataAndFileToRequest, type Endpoint } from 'payload'

import { checkRole } from '@/access/utilities'
import { getAnalyticsOverview } from '@/commerce/analytics'
import { setCustomerActive, updateRiderAccount } from '@/commerce/adminOps'
import { reorderBanners, reorderCategories } from '@/commerce/reorder'
import { searchCatalogue } from '@/commerce/search'
import type { User } from '@/payload-types'

const jsonError = (error: unknown) => {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status) || 500
      : 500
  const message = error instanceof Error ? error.message : 'Request failed'
  return Response.json({ message }, { status })
}

const assertAdmin = (req: { user?: unknown }) => {
  const user = req.user as User | null
  if (!user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }
  if (!checkRole(['admin'], user)) {
    return Response.json({ message: 'Forbidden' }, { status: 403 })
  }
  return null
}

const routeID = (req: { routeParams?: Record<string, unknown> }): string | null => {
  const id = req.routeParams?.id
  return typeof id === 'string' && id ? id : null
}

/** GET /api/admin/analytics/overview?days=7 */
export const analyticsOverviewEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const denied = assertAdmin(req)
      if (denied) return denied
      const url = req.url ? new URL(req.url, 'http://localhost') : null
      const days = url?.searchParams.get('days')
      const data = await getAnalyticsOverview(req, days)
      return Response.json({ data, message: 'Overview' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'analytics overview failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/admin/analytics/overview',
}

/** POST /api/admin/categories/reorder — { categories: [{ id, sortOrder }] } */
export const reorderCategoriesEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const denied = assertAdmin(req)
      if (denied) return denied
      await addDataAndFileToRequest(req)
      const data = await reorderCategories(req, req.data)
      return Response.json({ data, message: 'Display order saved' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'category reorder failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/admin/categories/reorder',
}

/** POST /api/admin/banners/reorder — { banners: [{ id, sortOrder }] } */
export const reorderBannersEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const denied = assertAdmin(req)
      if (denied) return denied
      await addDataAndFileToRequest(req)
      const data = await reorderBanners(req, req.data)
      return Response.json({ data, message: 'Display order saved' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'banner reorder failed' })
      return jsonError(error)
    }
  },
  method: 'post',
  path: '/admin/banners/reorder',
}

/** PATCH /api/admin/customers/:id — { isActive: boolean } */
export const updateCustomerEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const denied = assertAdmin(req)
      if (denied) return denied
      await addDataAndFileToRequest(req)
      const id = routeID(req)
      if (!id) return Response.json({ message: 'Customer id required' }, { status: 400 })

      const body = (req.data ?? {}) as { isActive?: unknown }
      if (typeof body.isActive !== 'boolean') {
        return Response.json({ message: 'isActive boolean required' }, { status: 400 })
      }

      const customer = await setCustomerActive(req, id, body.isActive)
      return Response.json({
        data: {
          email: customer.email,
          id: customer.id,
          isActive: customer.isActive,
          name: customer.name,
        },
        message: body.isActive ? 'Customer reinstated' : 'Customer suspended',
      })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'customer update failed' })
      return jsonError(error)
    }
  },
  method: 'patch',
  path: '/admin/customers/:id',
}

/** PATCH /api/admin/riders/:id — { driverStatus?, isActive? } */
export const updateRiderEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const denied = assertAdmin(req)
      if (denied) return denied
      await addDataAndFileToRequest(req)
      const id = routeID(req)
      if (!id) return Response.json({ message: 'Rider id required' }, { status: 400 })

      const body = (req.data ?? {}) as {
        driverStatus?: unknown
        isActive?: unknown
      }

      const rider = await updateRiderAccount(req, id, {
        driverStatus:
          typeof body.driverStatus === 'string'
            ? (body.driverStatus as 'pending' | 'approved' | 'suspended')
            : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      })

      return Response.json({
        data: {
          driverStatus: rider.driverStatus,
          email: rider.email,
          id: rider.id,
          isActive: rider.isActive,
          isOnline: rider.isOnline,
          name: rider.name,
        },
        message: 'Rider updated',
      })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'rider update failed' })
      return jsonError(error)
    }
  },
  method: 'patch',
  path: '/admin/riders/:id',
}

/** GET /api/search?q=term — public restaurant + dish search */
export const searchEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const url = req.url ? new URL(req.url, 'http://localhost') : null
      const term = url?.searchParams.get('q') ?? url?.searchParams.get('term')
      const data = await searchCatalogue(req, term)
      return Response.json({ data, message: 'Search results' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'search failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/search',
}

export const deliveryOpsEndpoints: Endpoint[] = [
  analyticsOverviewEndpoint,
  reorderCategoriesEndpoint,
  reorderBannersEndpoint,
  updateCustomerEndpoint,
  updateRiderEndpoint,
  searchEndpoint,
]
