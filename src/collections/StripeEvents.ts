import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Stripe webhook receipts for idempotency. Unique `eventId` means a retry
 * that lands twice is ignored after the first successful write.
 */
export const StripeEvents: CollectionConfig = {
  slug: 'stripe-events',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['eventId', 'type', 'processedAt'],
    description: 'Stripe webhook idempotency log (system-managed).',
    group: 'Ecommerce',
  },
  fields: [
    {
      name: 'eventId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'type',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'processedAt',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
  timestamps: false,
}
