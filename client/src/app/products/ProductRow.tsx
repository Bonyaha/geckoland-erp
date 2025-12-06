// client/src/app/products/ProductRow.tsx
import React from 'react'
import Image from 'next/image'
import { Pencil, Copy, Trash2 } from 'lucide-react'

// Define the type for a single product, ensuring all required fields are present
type ProductType = {
  productId: string
  name: string
  price: number
  stockQuantity: number
  sku: string
  mainImage?: string
  lastSynced?: string
  // Add other fields you might need for display (e.g., source, category)
}

type ProductRowProps = {
  product: ProductType
  // Actions that the parent page needs to handle
  onEdit: (id: string) => void
  onCopy: (id: string) => void
  onDelete: (id: string) => void
}

// --- Mock Data Functions (Replace with your actual business logic) ---

// In a real app, this would come from your database or state management
const calculateCost = (price: number): number => {
  // Mock: Assume cost is 70% of the price
  return price * 0.7
}

// In a real app, this would be fetched from your sales data
const calculateSales = (productId: string): number => {
console.log('product is: ', productId);

  // Mock: Random sales between 1 and 200 for variety
  return Math.floor(Math.random() * 200) + 1
}

// --- Component Definition ---

const ProductRow = ({ product, onEdit, onCopy, onDelete }: ProductRowProps) => {
  // Calculations based on mock data
  const cost = calculateCost(product.price)
  const sales = calculateSales(product.productId)
  const margin = product.price - cost

  // Utility for formatting currency
  const formatCurrency = (value: number) => value.toFixed(2)

  return (
    <tr key={product.productId} className='hover:bg-gray-50 transition-colors'>
      {/* 1. PRODUCT / ID / DATE (Wider Column) */}
      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
        <div className='flex items-center'>
          {/* Image Placeholder/Thumbnail */}
          <div className='flex-shrink-0 h-10 w-10 mr-3'>
            <Image
              src={
                product.mainImage ||
                'https://placehold.co/40x40/f1f1f1/999.png?text=IMG'
              }
              alt={product.name}
              width={40}
              height={40}
              className='rounded-md object-cover border border-gray-200'
            />
          </div>
          {/* Product Name & SKU/Date */}
          <div className='flex flex-col'>
            <div className='text-sm font-semibold text-gray-800 line-clamp-2'>
              {product.name}
            </div>
            <div className='text-xs text-gray-500 mt-0.5'>
              ID: {product.productId}
            </div>
            <div className='text-xs text-gray-500 mt-0.5'>
              SKU: {product.sku}
            </div>
            <div className='text-xs text-gray-400 mt-0.5'>
              Оновлено:{' '}
              {product.lastSynced || new Date().toLocaleDateString('uk-UA')}
            </div>
          </div>
        </div>
      </td>

      {/* 2. AVAILABLE (Green/Red text) */}
      <td className='px-6 py-4 whitespace-nowrap text-sm text-right'>
        <span
          className={`font-semibold ${
            product.stockQuantity > 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {product.stockQuantity} одиниць
        </span>
      </td>

      {/* 3. SALES (Red text) */}
      <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-semibold'>
        {sales} продажів
      </td>

      {/* 4. COST (Default text) */}
      <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 font-medium'>
        {formatCurrency(cost)}
      </td>

      {/* 5. PRICE (Bold text) */}
      <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 font-bold'>
        {formatCurrency(product.price)}
      </td>

      {/* 6. MARGIN (Blue/Red text, Bold) */}
      <td className='px-6 py-4 whitespace-nowrap text-sm text-right'>
        <span
          className={`font-bold ${
            margin > 0 ? 'text-blue-600' : 'text-red-600'
          }`}
        >
          {formatCurrency(margin)}
        </span>
      </td>

      {/* 7. ACTIONS (Icons) */}
      <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
        <div className='flex justify-end gap-2'>
          <button
            title='Edit'
            onClick={() => onEdit(product.productId)}
            className='text-gray-400 hover:text-blue-600 p-1 rounded-full'
          >
            <Pencil className='w-4 h-4' />
          </button>
          <button
            title='Copy'
            onClick={() => onCopy(product.productId)}
            className='text-gray-400 hover:text-blue-600 p-1 rounded-full'
          >
            <Copy className='w-4 h-4' />
          </button>
          <button
            title='Delete'
            onClick={() => onDelete(product.productId)}
            className='text-gray-400 hover:text-red-600 p-1 rounded-full'
          >
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default ProductRow
