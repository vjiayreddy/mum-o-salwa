import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const PlatformSettings: GlobalConfig = {
  slug: 'platform-settings',
  label: 'Platform Settings',
  admin: {
    group: 'Delivery',
  },
  access: {
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'driverBasePay',
      type: 'number',
      required: true,
      defaultValue: 490,
      min: 0,
      max: 100_000,
      admin: {
        description: 'Flat rider pay per delivery in minor units (cents). Default 490 = $4.90',
      },
    },
    {
      name: 'driverPayPerKm',
      type: 'number',
      required: true,
      defaultValue: 120,
      min: 0,
      max: 100_000,
      admin: {
        description: 'Added per km between pickup and drop-off, in minor units. Default 120 = $1.20',
      },
    },
    {
      name: 'commissionRate',
      type: 'number',
      required: true,
      defaultValue: 0.25,
      min: 0,
      max: 0.5,
      admin: {
        description: "Platform share of food subtotal (0.25 = 25%). Tenants may override.",
        step: 0.01,
      },
    },
    {
      name: 'serviceFeeRate',
      type: 'number',
      required: true,
      defaultValue: 0.05,
      min: 0,
      max: 0.2,
      admin: {
        description: 'Service fee charged to the customer on subtotal (0.05 = 5%).',
        step: 0.01,
      },
    },
  ],
}
