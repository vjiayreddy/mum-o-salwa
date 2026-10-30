# Expo API cutover (Express → Payload)

Mum-o-Salwa’s only backend is **Payload** (`pnpm dev` → `http://localhost:3000`).
The legacy Chowly Express API (`rsap/api` on `:8000`) is **retired** — do not run it for product traffic.

## Mobile env

In `rsap/mobile/.env` (or EAS secrets):

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

- Android emulator: `adb reverse tcp:3000 tcp:3000`
- Physical device: use your machine LAN IP, e.g. `http://192.168.1.10:3000/api`

Auth: send Payload JWT as `Authorization: Bearer <token>` (from `POST /api/users/login` → `token`).

## Route map

Source of truth in code: [`src/commerce/cutover.ts`](../src/commerce/cutover.ts).

| Express (`/api/v1…`) | Payload (`/api…`) |
|----------------------|-------------------|
| `POST /auth/login` | `POST /users/login` |
| `POST /auth/register` | `POST /users` |
| `GET /auth/me` | `GET /users/me` |
| `GET/POST /addresses` | `GET/POST /addresses` |
| `GET /categories` | `GET /categories` |
| `GET /banners/active` | `GET /banners/active` |
| `GET /restaurants` | `GET /restaurants` |
| `GET /restaurants/:slug` | `GET /restaurants/:slug` |
| `GET /dishes/:id` | `GET /dishes/:id` |
| `GET /search?q=` | `GET /search?q=` |
| `GET /basket` | `GET /carts` (ecommerce plugin) |
| `POST /orders` | `POST /orders/create-checkout` |
| `POST /orders/:id/sync` | `POST /orders/:id/sync-payment` |
| `POST /orders/:id/reorder` | `POST /orders/:id/reorder` |
| `GET /driver/home` | `GET /drivers/home` |
| `PATCH /driver/online` | `PATCH /drivers/online` |
| `POST /driver/deliveries/:id/claim` | `POST /drivers/deliveries/:id/claim` |
| `POST /driver/deliveries/:id/pick-up` | `POST /drivers/deliveries/:id/pick-up` |
| `POST /driver/deliveries/:id/complete` | `POST /drivers/deliveries/:id/complete` |

Response envelopes differ (Payload returns collection docs or `{ data, message }` on custom endpoints). Prefer a thin adapter in the Expo `api.ts` layer rather than changing every screen.

## Web storefront

- `/shop` — restaurant browse
- `/shop/[slug]` — menu
- `/products/[slug]` — dish detail + add to cart
- `/checkout` — Stripe checkout (existing ecommerce flow + delivery create-checkout)

## Tracking

Order status polling against `GET /api/orders/:id` is enough for v1. Realtime (SSE/websockets) is deferred.

## Retire Express checklist

- [ ] Mobile `.env` points at Payload `:3000/api`
- [ ] No process listening on `:8000` for delivery traffic
- [ ] Vite admin not used — Payload Admin at `/admin`
- [ ] `rsap/` remains local reference only (gitignored)
