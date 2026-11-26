// server/src/services/data-fetchers/fetchCRMProducts.ts

import axios from 'axios'
import { config } from '../../config/environment'

interface HugeProfitStock {
  quantity?: number | string
  price?: number | string
  sale_price?: number | string
  net_price?: number | string
  instock?: number | string | boolean
}

interface HugeProfitProduct {
  id: number | string
  sku?: string | null
  name?: string
  description?: string | null
  images?: string[]
  category?: unknown
  unit?: string
  stock?: HugeProfitStock[]
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

function toImageArray(images: unknown): string[] {
  if (!Array.isArray(images)) return []

  return images.filter(
    (image): image is string => typeof image === 'string' && image.length > 0,
  )
}

/**
 * Fetches products directly from HugeProfit CRM API and transforms
 * them into the structure expected by the Products table.
 *
 * No intermediate JSON files are created.
 */
export async function fetchCRMProducts(): Promise<Record<string, any>[]> {
  const { apiKey } = config.marketplaces.hugeprofit

  const baseUrl = 'https://h-profit.com/bapi/products'

  console.log('🌐 Fetching products from HugeProfit API...')

  try {
    const response = await axios.get(baseUrl, {
      headers: {
        Authorization: apiKey,
      },
      timeout: 60_000,
    })

    const products = response.data?.data

    if (!Array.isArray(products)) {
      throw new Error(
        'Unexpected HugeProfit API response: expected data to be an array.',
      )
    }

    if (products.length === 0) {
      throw new Error('HugeProfit API returned an empty product catalogue.')
    }

    const transformedProducts = products.map((product: HugeProfitProduct) => {
      const stockInfo = product.stock?.[0] ?? {}

      const quantity = Math.max(0, Math.trunc(toNumber(stockInfo.quantity)))

      const regularPrice = toNumber(stockInfo.price)

      const salePrice = toNumber(stockInfo.sale_price)

      const costPrice = toNumber(stockInfo.net_price)

      const promoPrice =
        salePrice > 0 && salePrice !== regularPrice ? String(salePrice) : null

      const images = toImageArray(product.images)

      return {
        // Stable ID. Existing records can also be matched by SKU.
        productId: `hp_${product.id}`,

        sku: product.sku || null,

        name: product.name || 'Unnamed Product',

        price: String(regularPrice),

        stockQuantity: quantity,

        available: quantity > 0,

        description:
          product.description === 'None' ? null : product.description || null,

        mainImage: images[0] || null,

        images,

        priceOld: null,

        pricePromo: promoPrice,

        updatedPrice: String(regularPrice),

        currency: 'UAH',

        dateModified: new Date(),

        lastSynced: new Date(),

        needsSync: false,

        categoryData: product.category
          ? {
              hugeprofit: product.category,
            }
          : null,

        measureUnit: product.unit || 'шт.',

        promQuantity: null,

        rozetkaQuantity: null,

        lastPromSync: null,

        lastRozetkaSync: null,

        needsPromSync: false,

        needsRozetkaSync: false,

        costPrice: costPrice > 0 ? String(costPrice) : undefined,
      }
    })

    console.log(`✅ HugeProfit products fetched: ${transformedProducts.length}`)

    return transformedProducts
  } catch (error) {
    console.error('❌ Error fetching products from HugeProfit API:')

    if (axios.isAxiosError(error)) {
      console.error(error.response?.data ?? error.message)
    } else {
      console.error(error)
    }

    throw error
  }
}
