import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { s3Storage } from '@payloadcms/storage-s3'
import type { Plugin } from 'payload'
import type { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { ecommercePlugin, USD } from '@payloadcms/plugin-ecommerce'
import { stripeAdapter } from '@payloadcms/plugin-ecommerce/payments/stripe'

import type { Config, Page, Product, User } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { ProductsCollection } from '@/collections/Products'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { customerOnlyFieldAccess } from '@/access/customerOnlyFieldAccess'
import { isAdmin } from '@/access/isAdmin'
import { isDocumentOwner } from '@/access/isDocumentOwner'
import {
  adminCustomerOrRestaurantOrder,
  adminOrRestaurantOrderUpdate,
} from '@/access/restaurantTenants'
import { checkRole } from '@/access/utilities'
import {
  addressAfterChange,
  addressAfterDelete,
  addressBeforeChange,
  cartBeforeChangeOneRestaurant,
  deliveryCartItemFields,
  deliveryCartItemMatcher,
  deliveryOrderEndpoints,
  deliveryOrderFields,
  deliveryStripeWebhooks,
  mapDeliveryOrderFields,
  orderAfterChangePaymentSync,
  orderBeforeChangeFulfillment,
  orderBeforeValidateDefaults,
} from '@/commerce'

const generateTitle: GenerateTitle<Product | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Mum-o-Salwa` : 'Mum-o-Salwa'
}

const generateURL: GenerateURL<Product | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

const r2Configured = Boolean(
  process.env.R2_BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT,
)

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      },
      admin: {
        group: 'Content',
      },
    },
    formOverrides: {
      access: {
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
        create: isAdmin,
      },
      admin: {
        group: 'Content',
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  ecommercePlugin({
    access: {
      adminOnlyFieldAccess,
      adminOrPublishedStatus,
      customerOnlyFieldAccess,
      isAdmin,
      isDocumentOwner,
    },
    addresses: {
      addressesCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection.admin,
          group: 'Delivery',
          hidden: false,
          useAsTitle: 'label',
          defaultColumns: ['label', 'addressLine1', 'city', 'isDefault', 'updatedAt'],
        },
        fields: [
          ...defaultCollection.fields,
          {
            name: 'label',
            type: 'select',
            defaultValue: 'Home',
            options: [
              { label: 'Home', value: 'Home' },
              { label: 'Work', value: 'Work' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            name: 'instructions',
            type: 'textarea',
            maxLength: 200,
            admin: {
              description: 'Delivery notes for the rider (buzzer, landmark, …).',
            },
          },
          {
            name: 'location',
            type: 'point',
            label: 'Location',
            admin: {
              description: 'Drop-off coordinates [longitude, latitude] for delivery routing.',
            },
          },
          {
            name: 'isDefault',
            type: 'checkbox',
            defaultValue: false,
            label: 'Default delivery address',
            admin: {
              position: 'sidebar',
            },
          },
        ],
        hooks: {
          ...defaultCollection.hooks,
          beforeChange: [
            ...(defaultCollection.hooks?.beforeChange || []),
            addressBeforeChange,
          ],
          afterChange: [...(defaultCollection.hooks?.afterChange || []), addressAfterChange],
          afterDelete: [...(defaultCollection.hooks?.afterDelete || []), addressAfterDelete],
        },
      }),
    },
    carts: {
      // Merge lines that share product + option ids + note
      cartItemMatcher: deliveryCartItemMatcher,
      cartsCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        admin: {
          ...defaultCollection.admin,
          group: 'Delivery',
        },
        fields: [
          ...defaultCollection.fields.map((field) => {
            if ('name' in field && field.name === 'items' && field.type === 'array') {
              return {
                ...field,
                fields: [...field.fields, ...deliveryCartItemFields],
              }
            }
            return field
          }),
          {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            index: true,
            filterOptions: () => true,
            admin: {
              position: 'sidebar',
              description: 'Restaurant this basket belongs to (one restaurant per cart).',
              readOnly: true,
            },
          },
          {
            name: 'includeCutlery',
            type: 'checkbox',
            defaultValue: false,
            label: 'Include cutlery',
          },
          {
            name: 'orderNote',
            type: 'textarea',
            maxLength: 300,
            admin: {
              description: 'Note for the whole order (allergies, leave at door, …).',
            },
          },
        ],
        hooks: {
          ...defaultCollection.hooks,
          beforeChange: [
            ...(defaultCollection.hooks?.beforeChange || []),
            cartBeforeChangeOneRestaurant,
          ],
        },
      }),
    },
    currencies: {
      defaultCurrency: 'USD',
      // USD first; add EUR/GBP/etc. here when expanding markets
      supportedCurrencies: [USD],
    },
    customers: {
      slug: 'users',
    },
    orders: {
      ordersCollectionOverride: ({ defaultCollection }) => ({
        ...defaultCollection,
        access: {
          ...defaultCollection.access,
          // Checkout uses Local API with overrideAccess; customers do not create via REST
          create: isAdmin,
          delete: isAdmin,
          read: adminCustomerOrRestaurantOrder,
          update: adminOrRestaurantOrderUpdate,
        },
        admin: {
          ...defaultCollection.admin,
          defaultColumns: [
            'reference',
            'fulfillmentStatus',
            'status',
            'customer',
            'amount',
            'createdAt',
          ],
          group: 'Delivery',
          useAsTitle: 'reference',
        },
        endpoints: [
          ...(defaultCollection.endpoints || []),
          ...deliveryOrderEndpoints,
        ],
        fields: [
          ...mapDeliveryOrderFields(defaultCollection.fields),
          ...deliveryOrderFields,
          {
            name: 'accessToken',
            type: 'text',
            unique: true,
            index: true,
            admin: {
              position: 'sidebar',
              readOnly: true,
            },
            hooks: {
              beforeValidate: [
                ({ value, operation }) => {
                  if (operation === 'create' || !value) {
                    return crypto.randomUUID()
                  }
                  return value
                },
              ],
            },
          },
        ],
        hooks: {
          ...defaultCollection.hooks,
          afterChange: [
            ...(defaultCollection.hooks?.afterChange || []),
            orderAfterChangePaymentSync,
          ],
          beforeChange: [
            ...(defaultCollection.hooks?.beforeChange || []),
            orderBeforeChangeFulfillment,
          ],
          beforeValidate: [
            ...(defaultCollection.hooks?.beforeValidate || []),
            orderBeforeValidateDefaults,
          ],
        },
      }),
    },
    payments: {
      paymentMethods: [
        stripeAdapter({
          secretKey: process.env.STRIPE_SECRET_KEY!,
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET!,
          webhooks: deliveryStripeWebhooks,
        }),
      ],
    },
    products: {
      productsCollectionOverride: ProductsCollection,
    },
  }),
  multiTenantPlugin<Config>({
    collections: {
      // Dishes only — orders use a custom `tenant` field (see deliveryOrderFields).
      // Keeping orders here re-applies tenant membership filters that break customer checkout.
      products: {},
    },
    tenantField: {
      access: {
        read: () => true,
        update: ({ req }) => checkRole(['admin', 'restaurant'], req.user as User | null),
      },
    },
    tenantsArrayField: {
      includeDefaultField: true,
      rowFields: [
        {
          name: 'roles',
          type: 'select',
          defaultValue: ['owner'],
          hasMany: true,
          options: [
            { label: 'Owner', value: 'owner' },
            { label: 'Kitchen', value: 'kitchen' },
          ],
          required: true,
        },
      ],
    },
    // Marketplace: customers must read restaurants; Tenants.ts already sets read: () => true
    useTenantsCollectionAccess: false,
    userHasAccessToAllTenants: (user) => checkRole(['admin'], user as User | null),
  }),
  s3Storage({
    collections: {
      media: {
        prefix: 'media',
      },
    },
    bucket: process.env.R2_BUCKET || '',
    config: {
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
      region: process.env.R2_REGION || 'auto',
      endpoint: process.env.R2_ENDPOINT || undefined,
      forcePathStyle: true,
    },
    // Keep local disk uploads when R2 env is not configured
    enabled: r2Configured,
    alwaysInsertFields: true,
  }),
]
