'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { OverviewPayload } from '@/commerce/analytics'

import './index.scss'

const baseClass = 'ops-overview'

const cents = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
  }).format((value || 0) / 100)

const deltaLabel = (today: number, yesterday: number): string => {
  const diff = today - yesterday
  if (diff === 0) return 'same as yesterday'
  const sign = diff > 0 ? '+' : '−'
  return `${sign}${cents(Math.abs(diff))} vs yesterday`
}

type LoadState =
  | { kind: 'error'; message: string }
  | { kind: 'loading' }
  | { kind: 'ready'; data: OverviewPayload }

export const OpsOverview: React.FC = () => {
  const [days, setDays] = useState(7)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = useCallback(async (windowDays: number) => {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/analytics/overview?days=${windowDays}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message || `Overview failed (${res.status})`)
      }
      const json = (await res.json()) as { data: OverviewPayload }
      setState({ data: json.data, kind: 'ready' })
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not load overview',
      })
    }
  }, [])

  useEffect(() => {
    void load(days)
  }, [days, load])

  return (
    <section className={baseClass}>
      <div className={`${baseClass}__header`}>
        <div>
          <h4 className={`${baseClass}__title`}>Operations overview</h4>
          <p className={`${baseClass}__subtitle`}>Paid orders only · UTC day boundaries</p>
        </div>
        <div className={`${baseClass}__days`}>
          {[7, 14, 30].map((value) => (
            <button
              className={`${baseClass}__day${days === value ? ` ${baseClass}__day--active` : ''}`}
              key={value}
              onClick={() => setDays(value)}
              type="button"
            >
              {value}d
            </button>
          ))}
        </div>
      </div>

      {state.kind === 'loading' && <p className={`${baseClass}__muted`}>Loading figures…</p>}
      {state.kind === 'error' && <p className={`${baseClass}__error`}>{state.message}</p>}

      {state.kind === 'ready' && (
        <>
          <div className={`${baseClass}__cards`}>
            <article className={`${baseClass}__card`}>
              <span className={`${baseClass}__label`}>Revenue today</span>
              <strong className={`${baseClass}__value`}>{cents(state.data.today.revenue)}</strong>
              <span className={`${baseClass}__meta`}>
                {deltaLabel(state.data.today.revenue, state.data.yesterday.revenue)}
              </span>
            </article>
            <article className={`${baseClass}__card`}>
              <span className={`${baseClass}__label`}>Orders today</span>
              <strong className={`${baseClass}__value`}>{state.data.today.orders}</strong>
              <span className={`${baseClass}__meta`}>
                {state.data.today.orders - state.data.yesterday.orders >= 0 ? '+' : ''}
                {state.data.today.orders - state.data.yesterday.orders} vs yesterday
              </span>
            </article>
            <article className={`${baseClass}__card`}>
              <span className={`${baseClass}__label`}>Commission today</span>
              <strong className={`${baseClass}__value`}>
                {cents(state.data.today.commission)}
              </strong>
              <span className={`${baseClass}__meta`}>
                AOV {cents(state.data.today.averageOrderValue)}
              </span>
            </article>
            <article className={`${baseClass}__card`}>
              <span className={`${baseClass}__label`}>Live orders</span>
              <strong className={`${baseClass}__value`}>{state.data.liveOrders}</strong>
              <span className={`${baseClass}__meta`}>confirmed → out for delivery</span>
            </article>
          </div>

          <div className={`${baseClass}__grid`}>
            <div>
              <h5 className={`${baseClass}__section`}>Revenue ({days}d)</h5>
              <ul className={`${baseClass}__series`}>
                {state.data.series.map((point) => {
                  const max = Math.max(...state.data.series.map((p) => p.revenue), 1)
                  const width = Math.round((point.revenue / max) * 100)
                  return (
                    <li key={point.date}>
                      <span className={`${baseClass}__series-date`}>{point.date.slice(5)}</span>
                      <span className={`${baseClass}__bar-track`}>
                        <span className={`${baseClass}__bar`} style={{ width: `${width}%` }} />
                      </span>
                      <span className={`${baseClass}__series-value`}>{cents(point.revenue)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <h5 className={`${baseClass}__section`}>By status</h5>
              <ul className={`${baseClass}__status`}>
                {state.data.byStatus.map((row) => (
                  <li key={row.status}>
                    <span>{row.status.replaceAll('_', ' ')}</span>
                    <strong>{row.count}</strong>
                  </li>
                ))}
              </ul>

              <h5 className={`${baseClass}__section`}>Recent</h5>
              <ul className={`${baseClass}__recent`}>
                {state.data.recent.length === 0 && (
                  <li className={`${baseClass}__muted`}>No paid orders yet.</li>
                )}
                {state.data.recent.map((order) => (
                  <li key={order.id}>
                    <span>
                      {order.reference || order.id.slice(-6)} · {order.restaurantName || '—'}
                    </span>
                    <strong>{cents(order.total)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
