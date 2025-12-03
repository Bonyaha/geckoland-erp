import React from 'react'
import {
  Wallet,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

// Corrected Type Definition: Making calculated/optional fields optional
// Note: We only include fields needed for the statistics calculation.
type ProductFormData = {
  price?: number // Made optional
  stockQuantity?: number // Made optional
  inStock?: number // <-- FIX: Made this field optional
  // If your Product object from the API doesn't guarantee these fields,
  // they should be marked optional here.
}

type ProductStatsProps = {
  // The 'products' array is what comes from the API, so its type should be what the API returns.
  // We use ProductFormData[] as the component expects a list of objects matching this shape.
  products: ProductFormData[] | undefined
}

const ProductStats = ({ products = [] }: ProductStatsProps) => {
  // Defensive checks are added in the calculations below using (curr.field || 0)

  // 1. Total Goods: Total number of items in the array
  const totalGoods = products.length

  // 2. In Stock: Number of products where stock > 0
  // Note: We use stockQuantity for this check, as 'inStock' might be missing from the API data
  const itemsInStock = products.filter((p) => (p.stockQuantity || 0) > 0).length

  // 3. Available: Sum of all stock quantities
  const totalUnits = products.reduce(
    (acc, curr) => acc + (curr.stockQuantity || 0),
    0
  )

  // 4. Goods Value: Sum of (Price * Stock)
  const totalValue = products.reduce((acc, curr) => {
    return acc + (curr.price || 0) * (curr.stockQuantity || 0)
  }, 0)

  // 5. Potential Profit:
  const potentialProfit = totalValue * 0.3 // Mock margin of 30%

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
  }: {
    title: string
    value: string | number
    subValue?: string
    icon: React.ReactNode
  }) => (
    <div className='bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center h-28 w-full'>
      {/* Optional: You can uncomment the icon if you want visuals, though Image 2 is text-heavy */}
      <div className="mb-2 text-gray-400">{icon}</div>

      <h3 className='text-xs font-bold text-gray-500 uppercase tracking-wider mb-1'>
        {title}
      </h3>
      <div className='text-2xl font-extrabold text-gray-800'>{value}</div>
      {subValue && (
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
        value={totalGoods}
        icon={<Package className='w-5 h-5' />}
      />
      <StatCard
        title='В наявності:'
        value={`${itemsInStock} товарів`}
        icon={<AlertCircle className='w-5 h-5' />}
      />
      <StatCard
        title='Доступно:'
        value={`${totalUnits.toFixed(2)} одиниць`}
        icon={<ShoppingCart className='w-5 h-5' />}
      />
      <StatCard
        title='Зберігається товарів на:'
        value={formatCurrency(totalValue)}
        icon={<Wallet className='w-5 h-5' />}
      />
      <StatCard
        title='Можливий дохід:'
        value={formatCurrency(potentialProfit)}
        icon={<TrendingUp className='w-5 h-5' />}
      />
    </div>
  )
}

export default ProductStats
