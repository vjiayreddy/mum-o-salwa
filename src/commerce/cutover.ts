/**
 * Express (rsap/api `/api/v1`) → Payload route map for Expo cutover.
 * Mobile should set EXPO_PUBLIC_API_URL to the Payload origin + `/api`
 * (e.g. http://localhost:3000/api) and call these paths.
 */

export type CutoverRoute = {
  express: string
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  notes?: string
  payload: string
}

export const EXPO_API_BASE_HINT = 'http://localhost:3000/api'

/** Customer + driver routes needed for Expo against Payload only. */
export const EXPO_CUTOVER_ROUTES: CutoverRoute[] = [
  {
    express: '/auth/register',
    method: 'POST',
    notes: 'Body: email, password, name; add roles:["customer"]',
    payload: '/users',
  },
  {
    express: '/auth/login',
    method: 'POST',
    notes: 'Response token is `token` (Payload), not `data.accessToken`',
    payload: '/users/login',
  },
  {
    express: '/auth/me',
    method: 'GET',
    payload: '/users/me',
  },
  {
    express: '/auth/logout',
    method: 'POST',
    payload: '/users/logout',
  },
  {
    express: '/addresses',
    method: 'GET',
    payload: '/addresses',
  },
  {
    express: '/addresses',
    method: 'POST',
    payload: '/addresses',
  },
  {
    express: '/addresses/:id',
    method: 'PATCH',
    payload: '/addresses/:id',
  },
  {
    express: '/addresses/:id',
    method: 'DELETE',
    payload: '/addresses/:id',
  },
  {
    express: '/categories',
    method: 'GET',
    notes: 'Filter isActive client-side or via where query',
    payload: '/categories',
  },
  {
    express: '/banners/active',
    method: 'GET',
    payload: '/banners/active',
  },
  {
    express: '/restaurants',
    method: 'GET',
    payload: '/restaurants',
  },
  {
    express: '/restaurants/:slug',
    method: 'GET',
    payload: '/restaurants/:slug',
  },
  {
    express: '/dishes/:id',
    method: 'GET',
    payload: '/dishes/:id',
  },
  {
    express: '/search',
    method: 'GET',
    notes: 'Query param `q` (min 2 chars)',
    payload: '/search',
  },
  {
    express: '/basket',
    method: 'GET',
    notes: 'Use ecommerce carts REST for the signed-in customer',
    payload: '/carts',
  },
  {
    express: '/orders',
    method: 'POST',
    notes: 'Was create order; now create-checkout → PaymentIntent',
    payload: '/orders/create-checkout',
  },
  {
    express: '/orders',
    method: 'GET',
    payload: '/orders',
  },
  {
    express: '/orders/:id',
    method: 'GET',
    payload: '/orders/:id',
  },
  {
    express: '/orders/:id/sync',
    method: 'POST',
    payload: '/orders/:id/sync-payment',
  },
  {
    express: '/orders/:id/reorder',
    method: 'POST',
    payload: '/orders/:id/reorder',
  },
  {
    express: '/driver/home',
    method: 'GET',
    payload: '/drivers/home',
  },
  {
    express: '/driver/online',
    method: 'PATCH',
    payload: '/drivers/online',
  },
  {
    express: '/driver/deliveries/:id',
    method: 'GET',
    payload: '/drivers/deliveries/:id',
  },
  {
    express: '/driver/deliveries/:id/claim',
    method: 'POST',
    payload: '/drivers/deliveries/:id/claim',
  },
  {
    express: '/driver/deliveries/:id/pick-up',
    method: 'POST',
    payload: '/drivers/deliveries/:id/pick-up',
  },
  {
    express: '/driver/deliveries/:id/complete',
    method: 'POST',
    payload: '/drivers/deliveries/:id/complete',
  },
]

/** Resolve Payload path for an Express v1 path (method-aware). */
export const resolvePayloadPath = (
  expressPath: string,
  method: CutoverRoute['method'],
): string | null => {
  const normalized = expressPath.startsWith('/') ? expressPath : `/${expressPath}`
  const match = EXPO_CUTOVER_ROUTES.find(
    (route) => route.express === normalized && route.method === method,
  )
  return match?.payload ?? null
}

export const EXPRESS_RETIRED_NOTICE =
  'The Express API (rsap/api on :8000) is retired. Run Payload (`pnpm dev` on :3000) as the only backend.'
