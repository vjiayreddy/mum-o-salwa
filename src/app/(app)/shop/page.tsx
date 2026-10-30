import { mapRestaurant } from '@/commerce/catalogue'
import { RestaurantCard } from '@/components/delivery/RestaurantCard'
import { Grid } from '@/components/Grid'
import { Categories } from '@/components/layout/search/Categories'
import { Search } from '@/components/Search'
import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
import React from 'react'

export const metadata = {
  description: 'Browse restaurants for delivery.',
  title: 'Restaurants',
}

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  searchParams: Promise<SearchParams>
}

const asString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams
  const searchValue = asString(params.q)?.trim() || ''
  const category = asString(params.category)?.trim() || ''
  const payload = await getPayload({ config: configPromise })

  const and: Where[] = [{ isActive: { equals: true } }]

  if (searchValue) {
    and.push({
      or: [
        { name: { contains: searchValue } },
        { cuisines: { contains: searchValue } },
        { description: { contains: searchValue } },
      ],
    })
  }

  if (category) {
    const categories = await payload.find({
      collection: 'categories',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      where: {
        or: [{ slug: { equals: category } }, { id: { equals: category } }],
      },
    })
    const categoryID = categories.docs[0] ? String(categories.docs[0].id) : null
    if (!categoryID) {
      return (
        <BrowseChrome>
          <p className="mb-4 text-primary/60">No restaurants match that category.</p>
        </BrowseChrome>
      )
    }
    and.push({ categories: { contains: categoryID } })
  }

  const restaurants = await payload.find({
    collection: 'tenants',
    depth: 1,
    limit: 50,
    overrideAccess: false,
    sort: 'sortOrder',
    where: { and },
  })

  const cards = restaurants.docs.map(mapRestaurant)
  const resultsText = cards.length === 1 ? 'restaurant' : 'restaurants'

  return (
    <BrowseChrome>
      {searchValue ? (
        <p className="mb-4">
          {cards.length === 0
            ? 'No restaurants match '
            : `Showing ${cards.length} ${resultsText} for `}
          <span className="font-bold">&quot;{searchValue}&quot;</span>
        </p>
      ) : null}

      {!searchValue && cards.length === 0 ? (
        <p className="mb-4 text-primary/60">
          No restaurants yet. Seed the admin dashboard to load demo kitchens.
        </p>
      ) : null}

      {cards.length > 0 ? (
        <Grid className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </Grid>
      ) : null}
    </BrowseChrome>
  )
}

function BrowseChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium tracking-tight">Restaurants</h1>
        <p className="text-primary/60">
          Browse neighbourhood kitchens, build a basket from one restaurant, and checkout.
        </p>
      </div>

      <Search className="mb-2" />

      <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:gap-12">
        <div className="flex w-full flex-none flex-col gap-4 basis-1/5 md:gap-8">
          <Categories />
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  )
}
