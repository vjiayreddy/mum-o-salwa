import { APIError, type PayloadRequest } from 'payload'

import { parseSortOrderBatch, type SortOrderItem } from '@/commerce/opsHelpers'

const applySortOrders = async (
  req: PayloadRequest,
  collection: 'categories' | 'banners',
  items: SortOrderItem[],
): Promise<void> => {
  await Promise.all(
    items.map(({ id, sortOrder }) =>
      req.payload.update({
        collection,
        data: { sortOrder },
        depth: 0,
        id,
        overrideAccess: false,
        req,
      }),
    ),
  )
}

/** Batch-update category display order (admin DnD). */
export const reorderCategories = async (
  req: PayloadRequest,
  body: unknown,
): Promise<{ updated: number }> => {
  const raw =
    body && typeof body === 'object' && 'categories' in body
      ? (body as { categories: unknown }).categories
      : undefined
  const parsed = parseSortOrderBatch(raw, 'categories')
  if ('error' in parsed) throw new APIError(parsed.error, 400)

  try {
    await applySortOrders(req, 'categories', parsed.items)
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : 'Reorder failed', 400)
  }

  return { updated: parsed.items.length }
}

/** Batch-update banner display order (admin DnD). */
export const reorderBanners = async (
  req: PayloadRequest,
  body: unknown,
): Promise<{ updated: number }> => {
  const raw =
    body && typeof body === 'object' && 'banners' in body
      ? (body as { banners: unknown }).banners
      : undefined
  const parsed = parseSortOrderBatch(raw, 'banners')
  if ('error' in parsed) throw new APIError(parsed.error, 400)

  try {
    await applySortOrders(req, 'banners', parsed.items)
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : 'Reorder failed', 400)
  }

  return { updated: parsed.items.length }
}
