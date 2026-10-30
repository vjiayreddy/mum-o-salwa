import type { CatalogueRestaurant } from '@/commerce/catalogue'
import { Price } from '@/components/Price'
import Link from 'next/link'
import React from 'react'
import clsx from 'clsx'

type Props = {
  restaurant: CatalogueRestaurant
}

export const RestaurantCard: React.FC<Props> = ({ restaurant }) => {
  const slug = restaurant.slug
  if (!slug) return null

  return (
    <Link className="group flex h-full flex-col gap-3" href={`/shop/${slug}`}>
      <div
        className={clsx(
          'relative aspect-[4/3] overflow-hidden rounded-2xl border bg-primary-foreground',
          !restaurant.isOpen && 'opacity-70',
        )}
      >
        {restaurant.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={restaurant.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            src={restaurant.imageUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-primary/40">
            No photo
          </div>
        )}
        {!restaurant.isOpen ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">
            Closed
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium leading-tight">{restaurant.name}</h2>
          {typeof restaurant.rating === 'number' && restaurant.rating > 0 ? (
            <span className="shrink-0 font-mono text-sm text-primary/60">
              {restaurant.rating.toFixed(1)}
            </span>
          ) : null}
        </div>
        <p className="line-clamp-2 text-sm text-primary/50">
          {restaurant.cuisines?.length
            ? restaurant.cuisines.join(' · ')
            : restaurant.description || restaurant.address}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-primary/50">
          <span>
            {restaurant.prepTimeMinMinutes}–{restaurant.prepTimeMaxMinutes} min
          </span>
          <span className="inline-flex items-center gap-1">
            Delivery <Price amount={restaurant.deliveryFee} as="span" className="inline" />
          </span>
        </div>
      </div>
    </Link>
  )
}
