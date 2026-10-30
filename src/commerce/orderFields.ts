import type { Field, FieldAccess, Tab } from 'payload'

import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { checkRole } from '@/access/utilities'
import { deliveryCartItemFields } from '@/commerce/cartHooks'
import { FULFILLMENT_STATUSES } from '@/commerce/orderStatus'
import type { User } from '@/payload-types'

/** Admin or the customer who placed the order (for deliveryCode, etc.). */
const adminOrOrderCustomerFieldAccess: FieldAccess = ({ doc, req: { user } }) => {
  if (!user) return false
  if (checkRole(['admin'], user as User)) return true

  const customer =
    doc && typeof doc === 'object' && 'customer' in doc
      ? (doc as { customer?: unknown }).customer
      : undefined

  if (customer == null) return false
  if (typeof customer === 'object' && customer !== null && 'id' in customer) {
    return String((customer as { id: unknown }).id) === String(user.id)
  }
  return String(customer) === String(user.id)
}

/** Snapshot line fields beyond the plugin product/variant/quantity. */
const orderItemSnapshotFields: Field[] = [
  {
    name: 'name',
    type: 'text',
    admin: {
      description: 'Dish title snapshotted at checkout.',
      readOnly: true,
    },
  },
  {
    name: 'imageUrl',
    type: 'text',
    admin: {
      description: 'Dish image URL snapshotted at checkout.',
      readOnly: true,
    },
  },
  ...deliveryCartItemFields,
]


/** Extra delivery fields appended to the plugin orders collection. */
export const deliveryOrderFields: Field[] = [
  {
    name: 'reference',
    type: 'text',
    unique: true,
    index: true,
    admin: {
      description: 'Short customer-facing reference (e.g. CH-2481).',
      position: 'sidebar',
      readOnly: true,
    },
  },
  {
    name: 'fulfillmentStatus',
    type: 'select',
    defaultValue: 'pending_payment',
    index: true,
    options: FULFILLMENT_STATUSES.map((value) => ({
      label: value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      value,
    })),
    admin: {
      position: 'sidebar',
      description: 'Kitchen / rider lifecycle (separate from payment status).',
    },
  },
  {
    name: 'statusHistory',
    type: 'array',
    admin: {
      description: 'Append-only fulfillment timeline.',
      readOnly: true,
    },
    fields: [
      {
        name: 'status',
        type: 'select',
        required: true,
        options: FULFILLMENT_STATUSES.map((value) => ({ label: value, value })),
      },
      {
        name: 'at',
        type: 'date',
        required: true,
        admin: {
          date: {
            pickerAppearance: 'dayAndTime',
          },
        },
      },
      {
        name: 'note',
        type: 'text',
        maxLength: 200,
      },
    ],
  },
  {
    name: 'subtotal',
    type: 'number',
    min: 0,
    admin: {
      description: 'Food subtotal in minor units (cents), snapshotted at checkout.',
      readOnly: true,
    },
  },
  {
    name: 'deliveryFee',
    type: 'number',
    min: 0,
    admin: {
      description: 'Delivery fee charged (cents).',
      readOnly: true,
    },
  },
  {
    name: 'serviceFee',
    type: 'number',
    min: 0,
    admin: {
      description: 'Service fee charged (cents).',
      readOnly: true,
    },
  },
  {
    name: 'commission',
    type: 'number',
    min: 0,
    access: {
      read: adminOnlyFieldAccess,
      update: adminOnlyFieldAccess,
    },
    admin: {
      description: 'Platform cut of food subtotal (cents).',
      readOnly: true,
    },
  },
  {
    name: 'commissionRate',
    type: 'number',
    min: 0,
    max: 0.5,
    access: {
      read: adminOnlyFieldAccess,
      update: adminOnlyFieldAccess,
    },
    admin: {
      description: 'Commission rate locked at checkout (0.25 = 25%).',
      readOnly: true,
      step: 0.01,
    },
  },
  {
    name: 'restaurantPayout',
    type: 'number',
    min: 0,
    access: {
      read: adminOnlyFieldAccess,
      update: adminOnlyFieldAccess,
    },
    admin: {
      description: 'Restaurant share of food subtotal after commission (cents).',
      readOnly: true,
    },
  },
  {
    name: 'deliveryCode',
    type: 'text',
    access: {
      read: adminOrOrderCustomerFieldAccess,
      update: adminOnlyFieldAccess,
    },
    admin: {
      description: 'Customer reads this to the rider at the door. Auto-generated on create.',
      position: 'sidebar',
      readOnly: true,
    },
  },
  {
    name: 'paymentIntentId',
    type: 'text',
    index: true,
    access: {
      read: adminOnlyFieldAccess,
      update: adminOnlyFieldAccess,
    },
    admin: {
      description: 'Stripe PaymentIntent id.',
      position: 'sidebar',
      readOnly: true,
    },
  },
  {
    name: 'paidAt',
    type: 'date',
    admin: {
      date: { pickerAppearance: 'dayAndTime' },
      position: 'sidebar',
      readOnly: true,
    },
  },
  {
    name: 'includeCutlery',
    type: 'checkbox',
    defaultValue: false,
  },
  {
    name: 'orderNote',
    type: 'textarea',
    maxLength: 300,
  },
  {
    name: 'deliveryInstructions',
    type: 'textarea',
    maxLength: 200,
    admin: {
      description: 'Drop-off notes for the rider (from address or checkout).',
    },
  },
  {
    name: 'contactName',
    type: 'text',
    maxLength: 80,
  },
  {
    name: 'contactPhone',
    type: 'text',
    maxLength: 32,
  },
  {
    name: 'restaurantName',
    type: 'text',
    admin: { readOnly: true },
  },
  {
    name: 'restaurantImageUrl',
    type: 'text',
    admin: { readOnly: true },
  },
  {
    name: 'restaurantAddress',
    type: 'text',
    admin: { readOnly: true },
  },
  {
    name: 'restaurantLocation',
    type: 'group',
    fields: [
      { name: 'lat', type: 'number' },
      { name: 'lng', type: 'number' },
    ],
  },
  {
    name: 'deliveryLocation',
    type: 'group',
    fields: [
      { name: 'lat', type: 'number' },
      { name: 'lng', type: 'number' },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        name: 'prepTimeMinMinutes',
        type: 'number',
        min: 0,
        admin: { width: '50%', readOnly: true },
      },
      {
        name: 'prepTimeMaxMinutes',
        type: 'number',
        min: 0,
        admin: { width: '50%', readOnly: true },
      },
    ],
  },
  {
    name: 'estimatedDeliveryAt',
    type: 'date',
    admin: {
      date: { pickerAppearance: 'dayAndTime' },
      readOnly: true,
    },
  },
  {
    type: 'group',
    name: 'driver',
    admin: {
      description: 'Filled when a rider claims the order.',
    },
    fields: [
      {
        name: 'user',
        type: 'relationship',
        relationTo: 'users',
        admin: { description: 'Claiming rider.' },
      },
      { name: 'name', type: 'text', maxLength: 80 },
      { name: 'phone', type: 'text', maxLength: 32 },
      { name: 'avatarUrl', type: 'text' },
      { name: 'rating', type: 'number', min: 0, max: 5 },
      { name: 'ratingCount', type: 'number', min: 0 },
      {
        name: 'location',
        type: 'group',
        fields: [
          { name: 'lat', type: 'number' },
          { name: 'lng', type: 'number' },
        ],
      },
      {
        name: 'locationUpdatedAt',
        type: 'date',
        admin: { date: { pickerAppearance: 'dayAndTime' } },
      },
    ],
  },
  {
    type: 'group',
    name: 'driverPayout',
    access: {
      read: ({ doc, req: { user } }) => {
        if (!user) return false
        if (checkRole(['admin'], user as User)) return true
        if (!checkRole(['driver'], user as User)) return false
        const assigned =
          doc && typeof doc === 'object' && 'driver' in doc
            ? (doc as { driver?: { user?: unknown } }).driver?.user
            : undefined
        if (assigned == null) return false
        if (typeof assigned === 'object' && assigned !== null && 'id' in assigned) {
          return String((assigned as { id: unknown }).id) === String(user.id)
        }
        return String(assigned) === String(user.id)
      },
      update: adminOnlyFieldAccess,
    },
    admin: {
      description: 'Snapshotted when the delivery is claimed.',
    },
    fields: [
      { name: 'base', type: 'number', min: 0 },
      { name: 'distance', type: 'number', min: 0 },
      { name: 'distanceKm', type: 'number', min: 0 },
      { name: 'total', type: 'number', min: 0 },
    ],
  },
]

const enrichItemsArray = (field: Field): Field => {
  if (!('type' in field)) return field

  if (field.type === 'array' && 'name' in field && field.name === 'items') {
    return {
      ...field,
      fields: [...field.fields, ...orderItemSnapshotFields],
    }
  }

  if (field.type === 'tabs' && 'tabs' in field) {
    return {
      ...field,
      tabs: (field.tabs as Tab[]).map((tab) => ({
        ...tab,
        fields: tab.fields.map(enrichItemsArray),
      })),
    }
  }

  return field
}

/** Clear plugin status default so pending_payment orders are not "processing". */
const clearStatusDefault = (field: Field): Field => {
  if ('name' in field && field.name === 'status' && field.type === 'select') {
    return {
      ...field,
      defaultValue: undefined,
      admin: {
        ...field.admin,
        description: 'Payment settlement status. Set to processing when Stripe pays.',
      },
    }
  }

  if (field.type === 'tabs' && 'tabs' in field) {
    return {
      ...field,
      tabs: (field.tabs as Tab[]).map((tab) => ({
        ...tab,
        fields: tab.fields.map(clearStatusDefault),
      })),
    }
  }

  return field
}

export const mapDeliveryOrderFields = (fields: Field[]): Field[] =>
  fields.map(enrichItemsArray).map(clearStatusDefault)
