import type { CatalogueDish } from '@/commerce/catalogue'
import { Price } from '@/components/Price'
import Link from 'next/link'
import React from 'react'

type Props = {
  dish: CatalogueDish
  restaurantSlug: string
}

export const DishRow: React.FC<Props> = ({ dish, restaurantSlug }) => {
  const href = dish.slug ? `/products/${dish.slug}` : `/shop/${restaurantSlug}`

  return (
    <Link
      className="group flex items-start gap-4 border-b border-border py-4 last:border-b-0"
      href={href}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium group-hover:underline">{dish.name}</h3>
          {dish.isPopular ? (
            <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary/60">
              Popular
            </span>
          ) : null}
        </div>
        {dish.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-primary/50">{dish.description}</p>
        ) : null}
        <div className="mt-2 font-mono text-sm">
          <Price amount={dish.price} />
        </div>
      </div>
      {dish.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl object-cover bg-primary-foreground"
          src={dish.imageUrl}
        />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-xl bg-primary-foreground" />
      )}
    </Link>
  )
}
