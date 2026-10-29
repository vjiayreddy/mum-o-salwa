import type { CollectionSlug, File, GlobalSlug, Payload, PayloadRequest } from 'payload'

import {
  remoteMediaUrls,
  seedBanners,
  seedCategories,
  seedRestaurants,
} from './catalogue-data'
import { plainTextToLexical } from './lexical'

const collections: CollectionSlug[] = [
  'categories',
  'banners',
  'media',
  'pages',
  'products',
  'forms',
  'form-submissions',
  'variants',
  'variantOptions',
  'variantTypes',
  'carts',
  'transactions',
  'addresses',
  'orders',
  'tenants',
]

const globals: GlobalSlug[] = ['header', 'footer', 'platform-settings']

const DEMO_EMAILS = [
  'admin@example.com',
  'customer@example.com',
  'driver@example.com',
  ...seedRestaurants.map((r) => r.ownerEmail),
]

// Next.js revalidation errors are normal when seeding without a running server.
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  payload.logger.info(`— Clearing collections and globals...`)

  await payload.updateGlobal({
    slug: 'header',
    data: { navItems: [] },
    depth: 0,
    context: { disableRevalidate: true },
  })

  await payload.updateGlobal({
    slug: 'footer',
    data: { navItems: [] },
    depth: 0,
    context: { disableRevalidate: true },
  })

  await payload.updateGlobal({
    slug: 'platform-settings',
    data: {
      driverBasePay: 490,
      driverPayPerKm: 120,
      commissionRate: 0.25,
      serviceFeeRate: 0.05,
    },
    depth: 0,
    context: { disableRevalidate: true },
  })

  for (const collection of collections) {
    await payload.db.deleteMany({ collection, req, where: {} })
    if (payload.collections[collection]?.config.versions) {
      await payload.db.deleteVersions({ collection, req, where: {} })
    }
  }

  payload.logger.info(`— Clearing demo users...`)

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: {
      email: {
        in: DEMO_EMAILS,
      },
    },
  })

  payload.logger.info(`— Seeding media...`)

  const mediaEntries = await Promise.all(
    Object.entries(remoteMediaUrls).map(async ([key, url]) => {
      const file = await fetchFileByURL(url)
      const doc = await payload.create({
        collection: 'media',
        data: {
          alt: key,
        },
        file,
      })
      return [key, doc] as const
    }),
  )

  const mediaByKey = Object.fromEntries(mediaEntries)

  payload.logger.info(`— Seeding platform users...`)

  const admin = await payload.create({
    collection: 'users',
    data: {
      name: 'Platform Admin',
      email: 'admin@example.com',
      password: 'password',
      roles: ['admin'],
      isActive: true,
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      name: 'Demo Customer',
      email: 'customer@example.com',
      password: 'password',
      roles: ['customer'],
      isActive: true,
      phone: '+44 7700 900111',
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      name: 'Kris Clent',
      email: 'driver@example.com',
      password: 'password',
      roles: ['driver'],
      isActive: true,
      phone: '+44 7700 900321',
      driverStatus: 'approved',
      isOnline: false,
      rating: 4.9,
      ratingCount: 214,
    },
  })

  payload.logger.info(`— Seeding categories...`)

  const categoryBySlug: Record<string, string> = {}

  for (const category of seedCategories) {
    const image = category.imageKey ? mediaByKey[category.imageKey] : undefined
    const parentId = category.parentSlug ? categoryBySlug[category.parentSlug] : undefined

    if (category.parentSlug && !parentId) {
      throw new Error(
        `Category "${category.slug}" references missing parentSlug "${category.parentSlug}". List parents first.`,
      )
    }

    const doc = await payload.create({
      collection: 'categories',
      data: {
        title: category.title,
        slug: category.slug,
        backgroundColor: category.backgroundColor,
        sortOrder: category.sortOrder,
        isActive: true,
        ...(parentId ? { parent: parentId } : {}),
        ...(image ? { image: image.id } : {}),
      },
    })
    categoryBySlug[category.slug] = doc.id
  }

  payload.logger.info(`— Seeding banners...`)

  for (const banner of seedBanners) {
    const image = banner.imageKey ? mediaByKey[banner.imageKey] : undefined
    await payload.create({
      collection: 'banners',
      data: {
        title: banner.title,
        subtitle: banner.subtitle,
        categorySlug: banner.categorySlug,
        sortOrder: banner.sortOrder,
        isActive: true,
        ...(image ? { image: image.id } : {}),
      },
    })
  }

  payload.logger.info(`— Seeding restaurants, owners, and dishes...`)

  for (const restaurant of seedRestaurants) {
    const cover = restaurant.imageKey ? mediaByKey[restaurant.imageKey] : mediaByKey.hero
    const categoryIds = restaurant.categorySlugs
      .map((slug) => categoryBySlug[slug])
      .filter(Boolean)

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        cuisines: restaurant.cuisines,
        categories: categoryIds,
        rating: restaurant.rating,
        ratingCount: restaurant.ratingCount,
        prepTimeMinMinutes: restaurant.prepTimeMinMinutes,
        prepTimeMaxMinutes: restaurant.prepTimeMaxMinutes,
        deliveryFee: restaurant.deliveryFee,
        minOrder: restaurant.minOrder,
        freeDeliveryThreshold: restaurant.freeDeliveryThreshold,
        address: restaurant.address,
        location: restaurant.location,
        closesAt: restaurant.closesAt,
        sortOrder: restaurant.sortOrder,
        isOpen: true,
        isActive: true,
        ...(cover ? { image: cover.id } : {}),
      },
    })

    await payload.create({
      collection: 'users',
      data: {
        name: restaurant.ownerName,
        email: restaurant.ownerEmail,
        password: 'password',
        roles: ['restaurant'],
        isActive: true,
        tenants: [
          {
            tenant: tenant.id,
            roles: ['owner'],
          },
        ],
      },
    })

    let dishSort = 0
    for (const dish of restaurant.dishes) {
      dishSort += 1
      const dishImage = dish.imageKey
        ? mediaByKey[dish.imageKey]
        : cover || mediaByKey.hero

      await payload.create({
        collection: 'products',
        data: {
          title: dish.name,
          slug: `${restaurant.slug}-${dish.slug}`,
          _status: 'published',
          tenant: tenant.id,
          description: plainTextToLexical(dish.description),
          gallery: dishImage ? [{ image: dishImage.id }] : undefined,
          priceInUSDEnabled: true,
          priceInUSD: dish.price,
          enableVariants: false,
          inventory: 999,
          section: dish.section,
          isAvailable: true,
          isPopular: Boolean(dish.isPopular),
          sortOrder: dishSort,
          calories: dish.calories,
          allergens: dish.allergens || [],
          optionGroups: (dish.optionGroups || []).map((group) => ({
            name: group.name,
            type: group.type,
            required: group.required,
            options: group.options.map((option) => ({
              name: option.name,
              priceDelta: option.priceDelta ?? 0,
              isDefault: Boolean(option.isDefault),
            })),
          })),
          categories: categoryIds,
          layout: [],
          meta: {
            title: `${dish.name} | ${restaurant.name}`,
            description: dish.description,
            ...(dishImage ? { image: dishImage.id } : {}),
          },
        },
      })
    }
  }

  payload.logger.info(`— Seeding home page and globals...`)

  const heroMedia = mediaByKey.hero

  await payload.create({
    collection: 'pages',
    data: {
      slug: 'home',
      title: 'Home',
      _status: 'published',
      hero: {
        type: 'lowImpact',
        richText: plainTextToLexical('Mum-o-Salwa — food delivery from neighbourhood restaurants.'),
        links: [
          {
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'Browse shop',
              url: '/shop',
            },
          },
        ],
      },
      layout: [],
      meta: {
        title: 'Mum-o-Salwa',
        description: 'Food delivery from neighbourhood restaurants.',
        ...(heroMedia ? { image: heroMedia.id } : {}),
      },
    },
  })

  await payload.updateGlobal({
    slug: 'header',
    data: {
      navItems: [
        {
          link: {
            type: 'custom',
            label: 'Shop',
            url: '/shop',
          },
        },
        {
          link: {
            type: 'custom',
            label: 'Account',
            url: '/account',
          },
        },
      ],
    },
  })

  await payload.updateGlobal({
    slug: 'footer',
    data: {
      navItems: [
        {
          link: {
            type: 'custom',
            label: 'Admin',
            url: '/admin',
          },
        },
      ],
    },
  })

  payload.logger.info('Seeded database successfully!')
  payload.logger.info(
    `Demo logins (password: "password"): admin@example.com, customer@example.com, driver@example.com, ${seedRestaurants.map((r) => r.ownerEmail).join(', ')}. Admin id: ${admin.id}`,
  )
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
