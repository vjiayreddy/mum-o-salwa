import { slugField } from 'payload'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import type { Category } from '@/payload-types'

const preventCircularParent: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (!data?.parent) return data

  const parentId = typeof data.parent === 'object' ? data.parent.id : data.parent
  const selfId = originalDoc?.id

  if (selfId && String(parentId) === String(selfId)) {
    throw new APIError('A category cannot be its own parent.', 400)
  }

  // Walk ancestors; if we hit self (or a loop), reject.
  const seen = new Set<string>(selfId ? [String(selfId)] : [])
  let currentId: string | null | undefined = String(parentId)

  while (currentId) {
    if (seen.has(currentId)) {
      throw new APIError('Circular category hierarchy is not allowed.', 400)
    }

    seen.add(currentId)

    const ancestor: Category = await req.payload.findByID({
      collection: 'categories',
      id: currentId,
      depth: 0,
      req,
      overrideAccess: true,
    })

    const next: Category['parent'] = ancestor.parent
    currentId = next ? String(typeof next === 'object' ? next.id : next) : null
  }

  return data
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: 'Category',
    plural: 'Categories',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'parent', 'isActive', 'sortOrder', 'updatedAt'],
    group: 'Delivery',
  },
  hooks: {
    beforeChange: [preventCircularParent],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 40,
    },
    slugField({
      position: undefined,
    }),
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Leave empty for a top-level (home strip) category. Set to nest under another.',
      },
      filterOptions: ({ id }) => {
        if (!id) return true
        return {
          id: {
            not_equals: id,
          },
        }
      },
    },
    {
      name: 'subcategories',
      type: 'join',
      collection: 'categories',
      on: 'parent',
      admin: {
        allowCreate: true,
        defaultColumns: ['title', 'slug', 'isActive', 'sortOrder'],
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'backgroundColor',
      type: 'text',
      defaultValue: '#F3F6F5',
      admin: {
        description: 'Tint behind the category image on the home strip, e.g. #FFE9D6',
        condition: (_, siblingData) => !siblingData?.parent,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sortOrder',
          type: 'number',
          defaultValue: 0,
          index: true,
          admin: { width: '50%' },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          index: true,
          admin: { width: '50%' },
        },
      ],
    },
  ],
}
