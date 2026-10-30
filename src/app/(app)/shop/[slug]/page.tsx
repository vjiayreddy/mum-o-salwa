import { mapDish, mapRestaurant } from '@/commerce/catalogue'
import { DishRow } from '@/components/delivery/DishRow'
import { Price } from '@/components/Price'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'
import type { Metadata } from 'next'
import { ChevronLeftIcon } from 'lucide-react'

type Args = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'tenants',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    where: {
      and: [{ slug: { equals: slug } }, { isActive: { equals: true } }],
    },
  })
  const restaurant = result.docs[0]
  if (!restaurant) return { title: 'Restaurant' }

  return {
    description: restaurant.description || `Order from ${restaurant.name}`,
    title: restaurant.name,
  }
}

export default async function RestaurantMenuPage({ params }: Args) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const restaurants = await payload.find({
    collection: 'tenants',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    where: {
      and: [{ slug: { equals: slug } }, { isActive: { equals: true } }],
    },
  })

  const tenant = restaurants.docs[0]
  if (!tenant) return notFound()

  const restaurant = mapRestaurant(tenant)

  const dishesResult = await payload.find({
    collection: 'products',
    depth: 1,
    limit: 200,
    overrideAccess: false,
    pagination: false,
    sort: 'sortOrder',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { _status: { equals: 'published' } },
        { isAvailable: { equals: true } },
      ],
    },
  })

  const dishes = dishesResult.docs
    .map(mapDish)
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish))

  const sections = new Map<string, typeof dishes>()
  for (const dish of dishes) {
    const section = dish.section?.trim() || 'Menu'
    const list = sections.get(section) || []
    list.push(dish)
    sections.set(section, list)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary/60 hover:text-primary"
          href="/shop"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All restaurants
        </Link>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-medium tracking-tight">{restaurant.name}</h1>
            {restaurant.description ? (
              <p className="mt-2 max-w-2xl text-primary/60">{restaurant.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-primary/50">
              <span>
                {restaurant.prepTimeMinMinutes}–{restaurant.prepTimeMaxMinutes} min
              </span>
              <span className="inline-flex items-center gap-1">
                Delivery from <Price amount={restaurant.deliveryFee} as="span" className="inline" />
              </span>
              {restaurant.minOrder > 0 ? (
                <span className="inline-flex items-center gap-1">
                  Min <Price amount={restaurant.minOrder} as="span" className="inline" />
                </span>
              ) : null}
              {!restaurant.isOpen ? <span className="text-destructive">Currently closed</span> : null}
            </div>
          </div>
          {restaurant.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="h-36 w-full rounded-2xl object-cover md:h-40 md:w-56"
              src={restaurant.imageUrl}
            />
          ) : null}
        </div>
      </div>

      {dishes.length === 0 ? (
        <p className="text-primary/60">No dishes on the menu right now.</p>
      ) : (
        [...sections.entries()].map(([section, sectionDishes]) => (
          <section key={section}>
            <h2 className="mb-2 text-xl font-medium">{section}</h2>
            <div className="rounded-2xl border px-4">
              {sectionDishes.map((dish) => (
                <DishRow
                  dish={dish}
                  key={dish.id}
                  restaurantSlug={restaurant.slug || slug}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
