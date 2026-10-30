/**
 * Resolve the restaurant tenant for marketplace orders.
 * Ecommerce plugin confirm-order does not set `tenant`; we infer it from line items.
 */

export const relationID = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

export const productIDsFromOrderItems = (
  items: { product?: unknown }[] | null | undefined,
): string[] => {
  if (!items?.length) return []
  const ids = new Set<string>()
  for (const item of items) {
    const id = relationID(item.product)
    if (id) ids.add(id)
  }
  return [...ids]
}

/**
 * Pick the first known product→tenant mapping (carts already enforce one restaurant).
 */
export const tenantIDFromProductMap = (
  productIDs: string[],
  tenantByProductID: Map<string, string>,
): string | null => {
  for (const productID of productIDs) {
    const tenantID = tenantByProductID.get(productID)
    if (tenantID) return tenantID
  }
  return null
}

/** Tenant nested on a populated product doc (depth ≥ 1 snapshots). */
export const tenantIDFromPopulatedProduct = (product: unknown): string | null => {
  if (!product || typeof product !== 'object') return null
  return relationID((product as { tenant?: unknown }).tenant)
}
