import { APIError, type PayloadRequest, type Where } from 'payload'

import type { Banner, Category, Media, Product, Tenant } from '@/payload-types'

const RESTAURANT_LIMIT = 50
const DISH_LIMIT = 200

export type CatalogueRestaurant = {
  address: string
  categories: { id: string; name: string; slug?: string | null }[]
  closesAt?: string | null
  cuisines?: string[] | null
  deliveryFee: number
  description?: string | null
  id: string
  imageUrl: string | null
  isOpen: boolean
  minOrder: number
  name: string
  prepTimeMaxMinutes: number
  prepTimeMinMinutes: number
  rating?: number | null
  ratingCount?: number | null
  slug?: string | null
}

export type CatalogueDishOption = {
  id: string
  isDefault: boolean
  name: string
  priceDelta: number
}

export type CatalogueDishOptionGroup = {
  id: string
  name: string
  options: CatalogueDishOption[]
  required: boolean
  type: 'single' | 'multiple'
}

export type CatalogueDish = {
  allergens: string[]
  calories?: number | null
  description?: string | null
  id: string
  imageUrl: string | null
  isAvailable: boolean
  isPopular: boolean
  name: string
  optionGroups: CatalogueDishOptionGroup[]
  price: number
  restaurantId: string
  section?: string | null
  slug?: string | null
}

export type CatalogueBanner = {
  categorySlug?: string | null
  id: string
  imageUrl: string | null
  subtitle?: string | null
  title: string
}

export type RestaurantMenu = {
  dishes: CatalogueDish[]
  restaurant: CatalogueRestaurant
}

const mediaURL = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return null
  if (typeof value === 'object' && value !== null && 'url' in value) {
    const url = (value as Media).url
    return typeof url === 'string' ? url : null
  }
  return null
}

const relationID = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

const mapCategory = (
  value: string | number | Category,
): CatalogueRestaurant['categories'][number] | null => {
  if (!value || typeof value !== 'object') return null
  return {
    id: String(value.id),
    name: value.title || '',
    slug: value.slug,
  }
}

export const mapRestaurant = (tenant: Tenant): CatalogueRestaurant => {
  const categories = (tenant.categories || [])
    .map((entry) => mapCategory(entry as Category))
    .filter((entry): entry is CatalogueRestaurant['categories'][number] => Boolean(entry))

  return {
    address: tenant.address,
    categories,
    closesAt: tenant.closesAt,
    cuisines: tenant.cuisines,
    deliveryFee: tenant.deliveryFee,
    description: tenant.description,
    id: String(tenant.id),
    imageUrl: mediaURL(tenant.image),
    isOpen: tenant.isOpen !== false,
    minOrder: tenant.minOrder,
    name: tenant.name,
    prepTimeMaxMinutes: tenant.prepTimeMaxMinutes,
    prepTimeMinMinutes: tenant.prepTimeMinMinutes,
    rating: tenant.rating,
    ratingCount: tenant.ratingCount,
    slug: tenant.slug,
  }
}

const plainDescription = (description: Product['description']): string | null => {
  if (!description || typeof description !== 'object') return null
  const root = (description as { root?: { children?: unknown[] } }).root
  if (!root?.children?.length) return null

  const parts: string[] = []
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const n = node as { text?: unknown; children?: unknown[] }
      if (typeof n.text === 'string') parts.push(n.text)
      if (Array.isArray(n.children)) walk(n.children)
    }
  }
  walk(root.children)
  const text = parts.join('').trim()
  return text || null
}

export const mapDish = (product: Product): CatalogueDish | null => {
  const restaurantId = relationID(product.tenant)
  if (!restaurantId) return null

  const galleryImage = product.gallery?.[0]?.image
  const optionGroups: CatalogueDishOptionGroup[] = (product.optionGroups || []).map((group) => ({
    id: String(group.id ?? group.name),
    name: group.name,
    options: (group.options || []).map((option) => ({
      id: String(option.id ?? option.name),
      isDefault: Boolean(option.isDefault),
      name: option.name,
      priceDelta: typeof option.priceDelta === 'number' ? option.priceDelta : 0,
    })),
    required: Boolean(group.required),
    type: group.type === 'multiple' ? 'multiple' : 'single',
  }))

  return {
    allergens: product.allergens || [],
    calories: product.calories,
    description: plainDescription(product.description),
    id: String(product.id),
    imageUrl: mediaURL(galleryImage) || mediaURL(product.meta?.image),
    isAvailable: product.isAvailable !== false,
    isPopular: Boolean(product.isPopular),
    name: product.title,
    optionGroups,
    price: typeof product.priceInUSD === 'number' ? product.priceInUSD : 0,
    restaurantId,
    section: product.section,
    slug: product.slug,
  }
}

export type ListRestaurantsInput = {
  category?: string | null
  search?: string | null
}

/** Public restaurant catalogue for storefront + Expo. */
export const listRestaurants = async (
  req: PayloadRequest,
  input: ListRestaurantsInput = {},
): Promise<CatalogueRestaurant[]> => {
  const and: Where[] = [{ isActive: { equals: true } }]

  const search = typeof input.search === 'string' ? input.search.trim() : ''
  if (search) {
    and.push({
      or: [
        { name: { contains: search } },
        { cuisines: { contains: search } },
        { description: { contains: search } },
      ],
    })
  }

  const category = typeof input.category === 'string' ? input.category.trim() : ''
  if (category) {
    const categories = await req.payload.find({
      collection: 'categories',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      where: {
        or: [{ slug: { equals: category } }, { id: { equals: category } }],
      },
    })
    const categoryID = categories.docs[0] ? String(categories.docs[0].id) : null
    if (!categoryID) return []
    and.push({ categories: { contains: categoryID } })
  }

  const result = await req.payload.find({
    collection: 'tenants',
    depth: 1,
    limit: RESTAURANT_LIMIT,
    overrideAccess: true,
    req,
    sort: 'sortOrder',
    where: { and },
  })

  return result.docs.map(mapRestaurant)
}

/** Restaurant + published available dishes by slug. */
export const getRestaurantMenu = async (
  req: PayloadRequest,
  slug: string,
): Promise<RestaurantMenu> => {
  const normalized = slug.trim()
  if (!normalized) {
    throw new APIError('Restaurant slug required', 400)
  }

  const restaurants = await req.payload.find({
    collection: 'tenants',
    depth: 1,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      and: [{ slug: { equals: normalized } }, { isActive: { equals: true } }],
    },
  })

  const restaurant = restaurants.docs[0]
  if (!restaurant) {
    throw new APIError('Restaurant not found', 404)
  }

  const dishesResult = await req.payload.find({
    collection: 'products',
    depth: 1,
    limit: DISH_LIMIT,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'sortOrder',
    where: {
      and: [
        { tenant: { equals: restaurant.id } },
        { _status: { equals: 'published' } },
        { isAvailable: { equals: true } },
      ],
    },
  })

  const dishes = dishesResult.docs
    .map(mapDish)
    .filter((dish): dish is CatalogueDish => Boolean(dish))

  return {
    dishes,
    restaurant: mapRestaurant(restaurant),
  }
}

/** Single dish for Expo / deep links. */
export const getDishByID = async (
  req: PayloadRequest,
  id: string,
): Promise<{ dish: CatalogueDish; restaurant: CatalogueRestaurant }> => {
  if (!id) throw new APIError('Dish id required', 400)

  const product = await req.payload.findByID({
    collection: 'products',
    depth: 1,
    id,
    overrideAccess: true,
    req,
  })

  if (!product || product._status !== 'published' || product.isAvailable === false) {
    throw new APIError('Dish not found', 404)
  }

  const dish = mapDish(product)
  if (!dish) throw new APIError('Dish not found', 404)

  const tenant =
    product.tenant && typeof product.tenant === 'object'
      ? (product.tenant as Tenant)
      : await req.payload.findByID({
          collection: 'tenants',
          depth: 1,
          id: dish.restaurantId,
          overrideAccess: true,
          req,
        })

  if (!tenant || tenant.isActive === false) {
    throw new APIError('Restaurant not found', 404)
  }

  return { dish, restaurant: mapRestaurant(tenant) }
}

/** Banners currently within their schedule window. */
export const listActiveBanners = async (req: PayloadRequest): Promise<CatalogueBanner[]> => {
  const now = new Date().toISOString()
  const result = await req.payload.find({
    collection: 'banners',
    depth: 1,
    limit: 20,
    overrideAccess: true,
    req,
    sort: 'sortOrder',
    where: {
      and: [
        { isActive: { equals: true } },
        {
          or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }],
        },
        {
          or: [{ endsAt: { exists: false } }, { endsAt: { greater_than_equal: now } }],
        },
      ],
    },
  })

  return result.docs.map((banner: Banner) => ({
    categorySlug: banner.categorySlug,
    id: String(banner.id),
    imageUrl: mediaURL(banner.image),
    subtitle: banner.subtitle,
    title: banner.title,
  }))
}
