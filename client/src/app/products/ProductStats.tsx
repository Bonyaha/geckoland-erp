// client/src/app/products/ProductStats.tsx
import React from 'react'
import {
  Wallet,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { useGetProductStatsQuery } from '@/state/api'

const ProductStats = () => {
  // Defensive checks are added in the calculations below using (curr.field || 0)
  const { data: stats, isLoading } = useGetProductStatsQuery()

  const formatCurrency = (value: number) => {
    return (
      value.toLocaleString('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' грн.'
    )
  }

  // Helper to render a single stat card
  const StatCard = ({
    title,
    value,
    subValue,
    icon,
    loading,
  }: {
    title: string
    value: string | number
    subValue?: string
    icon: React.ReactNode
    loading: boolean
  }) => (
    <div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center h-28 w-full'>
      {/* Optional: You can uncomment the icon if you want visuals, though Image 2 is text-heavy */}
      <div className='mb-2 text-gray-400'>{icon}</div>

      <h3 className='text-xs font-bold text-gray-500 uppercase tracking-wider mb-1'>
        {title}
      </h3>
      {loading ? (
        <div className='h-8 w-24 bg-gray-200 animate-pulse rounded' />
      ) : (
        <div className='text-2xl font-extrabold text-gray-800'>{value}</div>
      )}
      {subValue && !loading && (
        <div className='text-sm font-semibold text-gray-500 mt-1'>
          {subValue}
        </div>
      )}
    </div>
  )

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 w-full'>
      <StatCard
        title='Усього товару:'
        value={stats?.totalGoods || 0}
        icon={<Package className='w-5 h-5' />}
        loading={isLoading}
      />
      <StatCard
        title='В наявності:'
        value={`${stats?.inStockCount || 0} товарів`}
        icon={<AlertCircle className='w-5 h-5' />}
        loading={isLoading}
      />
      <StatCard
        title='Доступно:'
        value={`${(stats?.totalUnits || 0).toFixed(2)} одиниць`}
        icon={<ShoppingCart className='w-5 h-5' />}
        loading={isLoading}
      />
      <StatCard
        title='Зберігається товарів на:'
        value={formatCurrency(stats?.totalValue || 0)}
        icon={<Wallet className='w-5 h-5' />}
        loading={isLoading}
      />
      <StatCard
        title='Можливий дохід:'
        value={formatCurrency(stats?.potentialProfit || 0)}
        icon={<TrendingUp className='w-5 h-5' />}
        loading={isLoading}
      />
    </div>
  )
}

export default ProductStats
