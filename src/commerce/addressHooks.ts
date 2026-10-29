import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'

type AddressCustomer = string | number | { id?: string | number | null } | null | undefined

type AddressDoc = {
  id: string | number
  customer?: AddressCustomer
  isDefault?: boolean | null
  [key: string]: unknown
}

const customerID = (customer: AddressCustomer): string | null => {
  if (customer == null) return null
  if (typeof customer === 'string' || typeof customer === 'number') return String(customer)
  return customer.id != null ? String(customer.id) : null
}

/**
 * First address for a customer becomes default; explicitly default addresses
 * clear the flag on siblings.
 */
export const addressBeforeChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const draft = data as AddressDoc
  const ownerID = customerID(draft.customer ?? (originalDoc as AddressDoc | undefined)?.customer)
  if (!ownerID) return data

  if (operation === 'create') {
    const existing = await req.payload.find({
      collection: 'addresses',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      where: {
        customer: {
          equals: ownerID,
        },
      },
    })

    if (existing.totalDocs === 0) {
      draft.isDefault = true
    }
  }

  return data
}

export const addressAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  const address = doc as AddressDoc
  if (!address.isDefault) return doc

  const ownerID = customerID(address.customer)
  if (!ownerID) return doc

  const siblings = await req.payload.find({
    collection: 'addresses',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        {
          customer: {
            equals: ownerID,
          },
        },
        {
          id: {
            not_equals: address.id,
          },
        },
        {
          isDefault: {
            equals: true,
          },
        },
      ],
    },
  })

  await Promise.all(
    siblings.docs.map((sibling) =>
      req.payload.update({
        id: sibling.id,
        collection: 'addresses',
        data: {
          isDefault: false,
        },
        depth: 0,
        overrideAccess: true,
        req,
      }),
    ),
  )

  return doc
}

/** Keep exactly one default when the default address is removed. */
export const addressAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const address = doc as AddressDoc
  if (!address.isDefault) return

  const ownerID = customerID(address.customer)
  if (!ownerID) return

  const next = await req.payload.find({
    collection: 'addresses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    sort: '-createdAt',
    where: {
      customer: {
        equals: ownerID,
      },
    },
  })

  const promote = next.docs[0]
  if (!promote) return

  await req.payload.update({
    id: promote.id,
    collection: 'addresses',
    data: {
      isDefault: true,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })
}
