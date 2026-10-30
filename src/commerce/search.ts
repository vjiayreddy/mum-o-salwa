import { APIError, type PayloadRequest } from 'payload'

import { normalizeSearchTerm } from '@/commerce/opsHelpers'
import type { Product, Tenant } from '@/payload-types'

const RESULT_LIMIT = 20

export type SearchDish = {
  id: string
  imageUrl?: string | null
  restaurant?: { id: string; name: string; slug?: string | null } | null
  section?: string | null
  title: string
}

export type SearchRestaurant = {
  cuisines?: string[] | null
  description?: string | null
  id: string
  name: string
  rating?: number | null
  slug?: string | null
}

export type SearchResults = {
  dishes: SearchDish[]
  restaurants: SearchRestaurant[]
  term: string
}

const mediaURL = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null
  const url = (value as { url?: unknown }).url
  return typeof url === 'string' ? url : null
}

const tenantSummary = (
  tenant: Product['tenant'],
): SearchDish['restaurant'] => {
  if (!tenant || typeof tenant !== 'object') return null
  const t = tenant as Tenant
  if (t.isActive === false) return null
  return {
    id: String(t.id),
    name: t.name,
    slug: t.slug,
  }
}

/** Public catalogue search: active restaurants + available dishes. */
export const searchCatalogue = async (
  req: PayloadRequest,
  rawTerm: unknown,
): Promise<SearchResults> => {
  const term = normalizeSearchTerm(rawTerm)
  if (term.length < 2) {
    throw new APIError('Enter at least 2 characters to search', 400)
  }

  const [restaurantsResult, dishesResult] = await Promise.all([
    req.payload.find({
      collection: 'tenants',
      depth: 0,
      limit: RESULT_LIMIT,
      overrideAccess: true,
      req,
      sort: '-rating',
      where: {
        and: [
          { isActive: { equals: true } },
          {
            or: [
              { name: { contains: term } },
              { cuisines: { contains: term } },
              { description: { contains: term } },
            ],
          },
        ],
      },
    }),
    req.payload.find({
      collection: 'products',
      depth: 1,
      limit: RESULT_LIMIT,
      overrideAccess: true,
      req,
      where: {
        and: [
          { isAvailable: { equals: true } },
          { _status: { equals: 'published' } },
          {
            or: [{ title: { contains: term } }, { section: { contains: term } }],
          },
        ],
      },
    }),
  ])

  const restaurants: SearchRestaurant[] = restaurantsResult.docs.map((doc) => ({
    cuisines: doc.cuisines,
    description: doc.description,
    id: String(doc.id),
    name: doc.name,
    rating: doc.rating,
    slug: doc.slug,
  }))

  const dishes: SearchDish[] = []
  for (const doc of dishesResult.docs) {
    const restaurant = tenantSummary(doc.tenant)
    if (!restaurant) continue

    const gallery = doc.gallery
    const firstImage =
      Array.isArray(gallery) && gallery[0] ? mediaURL(gallery[0].image) : null

    dishes.push({
      id: String(doc.id),
      imageUrl: firstImage,
      restaurant,
      section: doc.section,
      title: doc.title,
    })
  }

  return { dishes, restaurants, term }
}
