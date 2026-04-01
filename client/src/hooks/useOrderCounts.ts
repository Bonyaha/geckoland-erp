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

const ONE_HOUR = 60 * 60 * 1000

export function useOrderCounts(): OrderCounts {
  const { data } = useGetOrderCountsQuery(undefined, {
    pollingInterval: ONE_HOUR, // refresh every 1 hour     
    refetchOnReconnect: true, // refetch when network reconnects
  })

  return data?.data ?? DEFAULT_COUNTS
}
