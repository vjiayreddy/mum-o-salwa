import type { CollectionBeforeChangeHook, Field } from 'payload'

import { enforceOneRestaurant } from '@/commerce/cartRules'

type CartItem = {
  product?: unknown
  [key: string]: unknown
}

type CartDoc = {
  id?: string | number
  items?: CartItem[] | null
  tenant?: string | number | null
}

const productID = (product: unknown): string | null => {
  if (product == null) return null
  if (typeof product === 'string' || typeof product === 'number') return String(product)
  if (typeof product === 'object' && product !== null && 'id' in product) {
    const id = (product as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

const tenantIDFromProduct = (product: unknown): string | null => {
  if (!product || typeof product !== 'object') return null
  const tenant = (product as { tenant?: unknown }).tenant
  if (tenant == null) return null
  if (typeof tenant === 'string' || typeof tenant === 'number') return String(tenant)
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    const id = (tenant as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

/**
 * Lock the cart to a single restaurant tenant. Adding a dish from another
 * restaurant replaces the previous restaurant's lines.
 */
export const cartBeforeChangeOneRestaurant: CollectionBeforeChangeHook = async ({ data, req }) => {
  const items = (data as CartDoc).items
  if (!items?.length) {
    ;(data as CartDoc).tenant = null
    return data
  }

  const productIDs = [
    ...new Set(
      items.map((item) => productID(item.product)).filter((id): id is string => Boolean(id)),
    ),
  ]

  if (productIDs.length === 0) return data

  const products = await req.payload.find({
    collection: 'products',
    depth: 0,
    limit: productIDs.length,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      id: {
        in: productIDs,
      },
    },
  })

  const tenantByProductID = new Map<string, string>()
  for (const product of products.docs) {
    const tenantID = tenantIDFromProduct(product)
    if (tenantID) tenantByProductID.set(String(product.id), tenantID)
  }

  const enforced = enforceOneRestaurant(
    items.filter((item): item is CartItem & { product: unknown } => item.product != null),
    tenantByProductID,
  )
  ;(data as CartDoc).items = enforced.items
  ;(data as CartDoc).tenant = enforced.tenantID

  return data
}

/** Extra line fields for dish options / notes (merged into plugin `items` array). */
export const deliveryCartItemFields: Field[] = [
  {
    name: 'optionIds',
    type: 'text',
    hasMany: true,
    admin: {
      description: 'Selected dish option row IDs (from product.optionGroups.options).',
    },
  },
  {
    name: 'optionNames',
    type: 'text',
    hasMany: true,
    admin: {
      description: 'Snapshot of option labels at add-to-cart time.',
      readOnly: true,
    },
  },
  {
    name: 'note',
    type: 'text',
    maxLength: 200,
    admin: {
      description: 'Per-item kitchen note (e.g. no onions).',
    },
  },
  {
    name: 'unitPrice',
    type: 'number',
    min: 0,
    admin: {
      description: 'Server-priced unit in minor units (dish base + option deltas).',
      readOnly: true,
    },
  },
]
