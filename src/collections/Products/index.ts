import { CallToAction } from '@/blocks/CallToAction/config'
import { Content } from '@/blocks/Content/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { slugField } from 'payload'
import { adminOrRestaurant } from '@/access/restaurantTenants'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { DefaultDocumentIDType, Where } from 'payload'

export const ProductsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  access: {
    ...defaultCollection.access,
    // Multi-tenant plugin scopes these to the user's restaurant tenants
    create: adminOrRestaurant,
    delete: adminOrRestaurant,
    update: adminOrRestaurant,
  },
  labels: {
    singular: 'Dish',
    plural: 'Dishes',
  },
  admin: {
    ...defaultCollection?.admin,
    group: 'Delivery',
    defaultColumns: ['title', 'section', 'isAvailable', 'isPopular', '_status'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'products',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'products',
        req,
      }),
    useAsTitle: 'title',
  },
  defaultPopulate: {
    ...defaultCollection?.defaultPopulate,
    title: true,
    slug: true,
    variantOptions: true,
    variants: true,
    enableVariants: true,
    gallery: true,
    priceInUSD: true,
    inventory: true,
    meta: true,
    section: true,
    isAvailable: true,
    isPopular: true,
    optionGroups: true,
    allergens: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 80 },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'description',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ]
                },
              }),
              label: false,
              required: false,
            },
            {
              name: 'gallery',
              type: 'array',
              minRows: 1,
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'variantOption',
                  type: 'relationship',
                  relationTo: 'variantOptions',
                  admin: {
                    condition: (data) => {
                      return data?.enableVariants === true && data?.variantTypes?.length > 0
                    },
                  },
                  filterOptions: ({ data }) => {
                    if (data?.enableVariants && data?.variantTypes?.length) {
                      const variantTypeIDs = data.variantTypes.map((item: any) => {
                        if (typeof item === 'object' && item?.id) {
                          return item.id
                        }
                        return item
                      }) as DefaultDocumentIDType[]

                      if (variantTypeIDs.length === 0)
                        return {
                          variantType: {
                            in: [],
                          },
                        }

                      const query: Where = {
                        variantType: {
                          in: variantTypeIDs,
                        },
                      }

                      return query
                    }

                    return {
                      variantType: {
                        in: [],
                      },
                    }
                  },
                },
              ],
            },
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock],
            },
          ],
          label: 'Content',
        },
        {
          label: 'Dish',
          fields: [
            {
              name: 'section',
              type: 'text',
              defaultValue: 'Popular',
              maxLength: 40,
              required: true,
              admin: {
                description: 'Menu list group: Popular, Mains, Sides, Drinks, …',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'isAvailable',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: { width: '33%' },
                },
                {
                  name: 'isPopular',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: { width: '33%' },
                },
                {
                  name: 'sortOrder',
                  type: 'number',
                  defaultValue: 0,
                  admin: { width: '33%' },
                },
              ],
            },
            {
              name: 'calories',
              type: 'number',
              min: 0,
            },
            {
              name: 'allergens',
              type: 'text',
              hasMany: true,
              admin: {
                description: 'e.g. Milk, Gluten, Sesame',
              },
            },
            {
              name: 'optionGroups',
              type: 'array',
              labels: {
                singular: 'Option Group',
                plural: 'Option Groups',
              },
              admin: {
                description:
                  'Add-ons and customizations (size, extras, removals). Priced as deltas from the dish base price.',
              },
              fields: [
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  maxLength: 60,
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'type',
                      type: 'select',
                      required: true,
                      defaultValue: 'single',
                      options: [
                        { label: 'Single (radio)', value: 'single' },
                        { label: 'Multiple (checkbox)', value: 'multiple' },
                      ],
                      admin: { width: '50%' },
                    },
                    {
                      name: 'required',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: { width: '50%' },
                    },
                  ],
                },
                {
                  name: 'options',
                  type: 'array',
                  minRows: 1,
                  labels: {
                    singular: 'Option',
                    plural: 'Options',
                  },
                  fields: [
                    {
                      name: 'name',
                      type: 'text',
                      required: true,
                      maxLength: 60,
                    },
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'priceDelta',
                          type: 'number',
                          defaultValue: 0,
                          min: 0,
                          admin: {
                            width: '50%',
                            description: 'Extra cost in minor units (cents)',
                          },
                        },
                        {
                          name: 'isDefault',
                          type: 'checkbox',
                          defaultValue: false,
                          admin: { width: '50%' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          fields: [
            ...defaultCollection.fields,
            {
              name: 'relatedProducts',
              type: 'relationship',
              filterOptions: ({ id }) => {
                if (id) {
                  return {
                    id: {
                      not_in: [id],
                    },
                  }
                }

                // ID comes back as undefined during seeding so we need to handle that case
                return {
                  id: {
                    exists: true,
                  },
                }
              },
              hasMany: true,
              relationTo: 'products',
            },
          ],
          label: 'Pricing & Inventory',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        position: 'sidebar',
        sortOptions: 'title',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    slugField(),
  ],
})
