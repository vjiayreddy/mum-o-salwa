import type { Endpoint } from 'payload'

import {
  getDishByID,
  getRestaurantMenu,
  listActiveBanners,
  listRestaurants,
} from '@/commerce/catalogue'

const jsonError = (error: unknown) => {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: number }).status) || 500
      : 500
  const message = error instanceof Error ? error.message : 'Request failed'
  return Response.json({ message }, { status })
}

/** GET /api/restaurants — public restaurant list (?category=&search=). */
export const listRestaurantsEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const url = new URL(req.url || '', 'http://localhost')
      const restaurants = await listRestaurants(req, {
        category: url.searchParams.get('category'),
        search: url.searchParams.get('search'),
      })
      return Response.json({ data: { restaurants }, message: 'Restaurants' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'list restaurants failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/restaurants',
}

/** GET /api/restaurants/:slug — restaurant + menu dishes. */
export const getRestaurantEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const slug = req.routeParams?.slug
      if (typeof slug !== 'string' || !slug) {
        return Response.json({ message: 'Restaurant slug required' }, { status: 400 })
      }
      const data = await getRestaurantMenu(req, slug)
      return Response.json({ data, message: 'Restaurant' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'get restaurant failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/restaurants/:slug',
}

/** GET /api/dishes/:id — single dish + parent restaurant. */
export const getDishEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const id = req.routeParams?.id
      if (typeof id !== 'string' || !id) {
        return Response.json({ message: 'Dish id required' }, { status: 400 })
      }
      const data = await getDishByID(req, id)
      return Response.json({ data, message: 'Dish' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'get dish failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/dishes/:id',
}

/** GET /api/banners/active — scheduled live banners. */
export const activeBannersEndpoint: Endpoint = {
  handler: async (req) => {
    try {
      const banners = await listActiveBanners(req)
      return Response.json({ data: { banners }, message: 'Active banners' })
    } catch (error) {
      req.payload.logger.error({ err: error, msg: 'active banners failed' })
      return jsonError(error)
    }
  },
  method: 'get',
  path: '/banners/active',
}

export const deliveryCatalogueEndpoints: Endpoint[] = [
  listRestaurantsEndpoint,
  getRestaurantEndpoint,
  getDishEndpoint,
  activeBannersEndpoint,
]
