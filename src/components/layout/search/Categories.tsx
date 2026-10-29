import configPromise from '@payload-config'
import { getPayload } from 'payload'
import clsx from 'clsx'
import React, { Suspense } from 'react'

import type { Category } from '@/payload-types'
import { CategoryItem } from './Categories.client'

type CategoryNode = {
  category: Category
  children: CategoryNode[]
}

function buildCategoryTree(docs: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()

  for (const category of docs) {
    byId.set(String(category.id), { category, children: [] })
  }

  const roots: CategoryNode[] = []

  for (const category of docs) {
    const node = byId.get(String(category.id))
    if (!node) continue

    const parentId =
      category.parent == null
        ? null
        : String(typeof category.parent === 'object' ? category.parent.id : category.parent)

    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort(
      (a, b) =>
        (a.category.sortOrder ?? 0) - (b.category.sortOrder ?? 0) ||
        a.category.title.localeCompare(b.category.title),
    )
    for (const child of nodes) sortNodes(child.children)
  }

  sortNodes(roots)
  return roots
}

function CategoryTreeList({ nodes, depth = 0 }: { nodes: CategoryNode[]; depth?: number }) {
  return (
    <ul className={depth > 0 ? 'ml-3 border-l border-neutral-200 pl-2 dark:border-neutral-700' : undefined}>
      {nodes.map((node) => (
        <li key={node.category.id} className="py-0.5">
          <CategoryItem category={node.category} />
          {node.children.length > 0 ? (
            <CategoryTreeList nodes={node.children} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

async function CategoryList() {
  const payload = await getPayload({ config: configPromise })

  const categories = await payload.find({
    collection: 'categories',
    sort: 'sortOrder',
    limit: 200,
    depth: 0,
    where: {
      isActive: {
        equals: true,
      },
    },
  })

  const tree = buildCategoryTree(categories.docs)

  return (
    <div>
      <h3 className="text-xs mb-2 text-neutral-500 dark:text-neutral-400">Category</h3>
      <CategoryTreeList nodes={tree} />
    </div>
  )
}

const skeleton = 'mb-3 h-4 w-5/6 animate-pulse rounded'
const activeAndTitles = 'bg-neutral-800 dark:bg-neutral-300'
const items = 'bg-neutral-400 dark:bg-neutral-700'

export function Categories() {
  return (
    <Suspense
      fallback={
        <div className="col-span-2 hidden h-[400px] w-full flex-none py-4 lg:block">
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, activeAndTitles)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
          <div className={clsx(skeleton, items)} />
        </div>
      }
    >
      <CategoryList />
    </Suspense>
  )
}
