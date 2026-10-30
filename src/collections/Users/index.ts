import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { publicAccess } from '@/access/publicAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { checkRole } from '@/access/utilities'

import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'

/** Suspended / inactive accounts never receive a session. */
const rejectInactiveLogin: NonNullable<
  NonNullable<CollectionConfig['hooks']>['beforeLogin']
>[number] = async ({ user }) => {
  if (user && user.isActive === false) {
    throw new APIError('Your account has been suspended. Contact support.', 403)
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Platform admins and restaurant staff use Payload Admin
    admin: ({ req: { user } }) => checkRole(['admin', 'restaurant'], user),
    create: publicAccess,
    delete: adminOnly,
    read: adminOrSelf,
    unlock: adminOnly,
    update: adminOrSelf,
  },
  admin: {
    group: 'Users',
    defaultColumns: ['name', 'email', 'roles', 'driverStatus', 'isActive'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 1209600, // 14 days — matches mobile session needs
  },
  hooks: {
    beforeLogin: [rejectInactiveLogin],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      maxLength: 32,
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Customer', value: 'customer' },
        { label: 'Driver', value: 'driver' },
        { label: 'Restaurant', value: 'restaurant' },
      ],
      saveToJWT: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      access: {
        create: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      admin: {
        position: 'sidebar',
        description: 'Inactive users cannot sign in (beforeLogin rejects them).',
      },
    },
    {
      type: 'collapsible',
      label: 'Driver',
      admin: {
        condition: (_, siblingData) =>
          Array.isArray(siblingData?.roles) && siblingData.roles.includes('driver'),
        initCollapsed: true,
      },
      fields: [
        {
          name: 'isOnline',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether the driver is currently accepting deliveries',
          },
        },
        {
          name: 'driverStatus',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending approval', value: 'pending' },
            { label: 'Approved', value: 'approved' },
            { label: 'Suspended', value: 'suspended' },
          ],
          access: {
            create: adminOnlyFieldAccess,
            update: adminOnlyFieldAccess,
          },
          index: true,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'rating',
              type: 'number',
              min: 0,
              max: 5,
              admin: { width: '50%' },
            },
            {
              name: 'ratingCount',
              type: 'number',
              min: 0,
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      admin: {
        description: 'Stripe Customer id (created lazily at checkout).',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'reference', 'fulfillmentStatus', 'amount', 'createdAt'],
      },
    },
    {
      name: 'cart',
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
  ],
}
