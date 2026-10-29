import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { checkRole } from '@/access/utilities'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: {
    singular: 'Restaurant',
    plural: 'Restaurants',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isOpen', 'isActive', 'updatedAt'],
    group: 'Delivery',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: ({ req: { user } }) => {
      if (!user) return true
      if (checkRole(['admin'], user)) return true
      if (checkRole(['restaurant'], user)) {
        return true
      }
      return true
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (checkRole(['admin'], user)) return true
      if (checkRole(['restaurant'], user)) {
        return true
      }
      return false
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 120,
    },
    slugField({
      fieldToUse: 'name',
    }),
    {
      name: 'description',
      type: 'textarea',
      maxLength: 400,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'cuisines',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'e.g. Italian, Grill, Sushi',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'rating',
          type: 'number',
          min: 0,
          max: 5,
          defaultValue: 0,
          admin: {
            width: '50%',
            description: 'Admin-entered rating (not customer reviews)',
          },
        },
        {
          name: 'ratingCount',
          type: 'number',
          min: 0,
          defaultValue: 0,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'prepTimeMinMinutes',
          type: 'number',
          required: true,
          defaultValue: 20,
          min: 0,
          admin: { width: '50%' },
        },
        {
          name: 'prepTimeMaxMinutes',
          type: 'number',
          required: true,
          defaultValue: 30,
          min: 0,
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Fees & commission',
      fields: [
        {
          name: 'deliveryFee',
          type: 'number',
          required: true,
          defaultValue: 490,
          min: 0,
          admin: {
            description: 'Delivery fee in minor units (cents). Default 490 = $4.90',
          },
        },
        {
          name: 'minOrder',
          type: 'number',
          required: true,
          defaultValue: 0,
          min: 0,
          admin: {
            description: 'Minimum order subtotal in minor units',
          },
        },
        {
          name: 'freeDeliveryThreshold',
          type: 'number',
          min: 0,
          admin: {
            description: 'Subtotal (cents) at which delivery becomes free. Empty = never free.',
          },
        },
        {
          name: 'commissionRate',
          type: 'number',
          min: 0,
          max: 0.5,
          admin: {
            description:
              'Override platform commission (0–0.5). Empty uses platform-settings default.',
            step: 0.01,
          },
        },
      ],
    },
    {
      name: 'address',
      type: 'text',
      required: true,
    },
    {
      name: 'location',
      type: 'point',
      required: true,
      label: 'Location',
      admin: {
        description: 'Restaurant coordinates [longitude, latitude]',
      },
    },
    {
      name: 'closesAt',
      type: 'text',
      defaultValue: '22:00',
      admin: {
        description: 'Closing time as HH:mm (24h)',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'isOpen',
          type: 'checkbox',
          defaultValue: true,
          label: 'Accepting orders',
          admin: { width: '50%' },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          label: 'Active on platform',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
