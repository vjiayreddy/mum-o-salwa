/**
 * One-restaurant basket rules, option pricing, and line merging.
 * Pure helpers — wire into Payload cart hooks / endpoints.
 */

export type DishOption = {
  id?: string | null
  name: string
  priceDelta?: number | null
}

export type DishOptionGroup = {
  name: string
  type: 'single' | 'multiple'
  required?: boolean | null
  options?: DishOption[] | null
}

export type PricedSelection = {
  optionIds: string[]
  optionNames: string[]
  unitPrice: number
}

export type CartLineIdentity = {
  product: string
  optionIds?: string[] | null
  note?: string | null
}

export class CartRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CartRuleError'
  }
}

const relationID = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (id == null) return null
    return String(id)
  }
  return null
}

/** Stable key so the same dish + options + note merge into one line. */
export const cartLineKey = (item: CartLineIdentity): string => {
  const optionKey = [...(item.optionIds ?? [])].map(String).sort().join('|')
  return [item.product, optionKey, item.note?.trim() ?? ''].join('::')
}

/**
 * Matcher for `@payloadcms/plugin-ecommerce` cartItemMatcher.
 * Matches product + selected option ids + per-line note (ignores quantity).
 */
export const deliveryCartItemMatcher = ({
  existingItem,
  newItem,
}: {
  existingItem: {
    product: unknown
    optionIds?: string[] | null
    note?: string | null
    [key: string]: unknown
  }
  newItem: {
    product: string
    optionIds?: string[] | null
    note?: string | null
    [key: string]: unknown
  }
}): boolean => {
  const existingProductID = relationID(existingItem.product)
  if (!existingProductID || existingProductID !== String(newItem.product)) return false

  return (
    cartLineKey({
      note: existingItem.note,
      optionIds: existingItem.optionIds,
      product: existingProductID,
    }) ===
    cartLineKey({
      note: newItem.note,
      optionIds: newItem.optionIds,
      product: String(newItem.product),
    })
  )
}

/**
 * Prices chosen options against the dish so clients cannot invent options
 * or underpay required groups.
 */
export const priceSelection = (
  dish: { price: number; optionGroups?: DishOptionGroup[] | null },
  optionIds: string[] = [],
): PricedSelection => {
  const chosen = new Set(optionIds.map(String))
  const names: string[] = []
  const ids: string[] = []
  let extra = 0

  for (const group of dish.optionGroups ?? []) {
    const selectedInGroup = (group.options ?? []).filter((option) => chosen.has(String(option.id)))

    if (group.required && selectedInGroup.length === 0) {
      throw new CartRuleError(`Choose an option for "${group.name}"`)
    }

    if (group.type === 'single' && selectedInGroup.length > 1) {
      throw new CartRuleError(`Only one choice is allowed for "${group.name}"`)
    }

    for (const option of selectedInGroup) {
      names.push(option.name)
      ids.push(String(option.id))
      extra += option.priceDelta ?? 0
      chosen.delete(String(option.id))
    }
  }

  if (chosen.size > 0) {
    throw new CartRuleError('That option is not available for this dish')
  }

  return {
    optionIds: ids,
    optionNames: names,
    unitPrice: dish.price + extra,
  }
}

/**
 * Resolve option names back to current option ids (reorder of older snapshots).
 */
export const optionIdsFromNames = (
  dish: { optionGroups?: DishOptionGroup[] | null },
  optionNames: string[],
): string[] => {
  const wanted = new Set(optionNames)
  const ids: string[] = []

  for (const group of dish.optionGroups ?? []) {
    for (const option of group.options ?? []) {
      if (wanted.has(option.name)) ids.push(String(option.id))
    }
  }

  return ids
}

export type TenantScopedItem = {
  product: unknown
  [key: string]: unknown
}

/**
 * One basket holds one restaurant. When the newest line belongs to another
 * tenant, drop lines from the previous restaurant (RSAP behaviour).
 */
export const enforceOneRestaurant = <T extends TenantScopedItem>(
  items: T[],
  tenantByProductID: Map<string, string>,
): { items: T[]; tenantID: string | null } => {
  if (!items.length) return { items: [], tenantID: null }

  const tenantOf = (item: T): string | null => {
    const productID = relationID(item.product)
    if (!productID) return null
    return tenantByProductID.get(productID) ?? null
  }

  // Newest line wins (plugin appends on add-item).
  let activeTenant: string | null = null
  for (let i = items.length - 1; i >= 0; i--) {
    activeTenant = tenantOf(items[i]!)
    if (activeTenant) break
  }

  if (!activeTenant) return { items, tenantID: null }

  return {
    items: items.filter((item) => tenantOf(item) === activeTenant),
    tenantID: activeTenant,
  }
}
