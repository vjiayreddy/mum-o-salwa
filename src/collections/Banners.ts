import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const Banners: CollectionConfig = {
  slug: 'banners',
  labels: {
    singular: 'Banner',
    plural: 'Banners',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'categorySlug', 'isActive', 'sortOrder', 'updatedAt'],
    group: 'Delivery',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 80,
    },
    {
      name: 'subtitle',
      type: 'text',
      maxLength: 120,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'categorySlug',
      type: 'text',
      maxLength: 40,
      admin: {
        description:
          'Optional category slug to filter by when the customer taps the banner. Empty = artwork only.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Optional. Empty = active immediately when isActive.',
          },
        },
        {
          name: 'endsAt',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Optional. Empty = no end.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: { width: '50%' },
        },
        {
          name: 'sortOrder',
          type: 'number',
          defaultValue: 0,
          admin: { width: '50%' },
        },
      ],
    },
  ],
  timestamps: true,
}
