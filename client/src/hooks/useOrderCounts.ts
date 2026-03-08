// client/src/hooks/useOrderCounts.ts
import { useGetOrderCountsQuery } from '@/state/api'

export interface OrderCounts {
  all: number
  RECEIVED: number
  PREPARED: number
  SHIPPED: number
  AWAITING_PICKUP: number
  DELIVERED: number
  CANCELED: number
  RETURN: number
}

const DEFAULT_COUNTS: OrderCounts = {
  all: 0,
  RECEIVED: 0,
  PREPARED: 0,
  SHIPPED: 0,
  AWAITING_PICKUP: 0,
  DELIVERED: 0,
  CANCELED: 0,
  RETURN: 0,
}

export function useOrderCounts(): OrderCounts {
  const { data } = useGetOrderCountsQuery(undefined, {
    pollingInterval: 60_000, // refresh every 60s
  })

  return data?.data ?? DEFAULT_COUNTS
}
