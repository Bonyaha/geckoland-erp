// server/src/utils/helpers/mapCsvProductToEnriched.ts
import { nanoid } from 'nanoid'
import { Source } from '../../config/database'

/**
 * ============================================================
 * CSV ROW INTERFACES
 * ============================================================
 */

export interface ProductFromHPCSV {
  ID: string
  Назва: string
  Артикул: string
  Кількість: string
  Ціна: string
  'Собівр.': string
  Зображення: string
  Категорія: string
  Опис: string
  'Од.вим.': string
}

export interface ProductFromDbCSV {
  productId: string
  sku: string
  name: string
  price: string
  stockQuantity: string
  source: string
  externalIds: string
  description: string
  mainImage: string
  images: string
  available: string
  priceOld: string
  pricePromo: string
  updatedPrice: string
  currency: string
  dateModified: string
  lastSynced: string
  needsSync: string
  categoryData: string
  measureUnit: string
  lastPromSync: string
  lastRozetkaSync: string
  needsPromSync: string
  needsRozetkaSync: string
  promQuantity: string
  rozetkaQuantity: string
  costPrice: string
}

/**
 * ============================================================
 * MAPPER FUNCTIONS
 * ============================================================
 */

/**
 * Maps a row from the HugeProfit CSV export ('products.csv') to the product
 * shape expected by enrichAndInsertProducts().
 */
export function mapHPCsvToProduct(row: ProductFromHPCSV): any {
  const quantity = parseInt(row['Кількість'], 10) || 0
  const price = String(parseFloat(row['Ціна']) || '0.00')
  const costPrice = row['Собівр.'] ? String(parseFloat(row['Собівр.'])) : null

  const imageUrls = row['Зображення']
    ? row['Зображення']
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url)
    : []

  return {
    productId: `${row.ID}_${nanoid(6)}`,
    sku: row['Артикул'] || null,
    name: row['Назва'] || 'Unnamed Product',
    price,
    costPrice,
    stockQuantity: quantity,
    source: Source.crm,
    externalIds: { prom: null, rozetka: null },
    description: row['Опис'] || null,
    mainImage: imageUrls[0] || null,
    images: imageUrls,
    available: quantity > 0,
    currency: 'UAH',
    lastSynced: new Date(),
    needsSync: false,
    categoryData: row['Категорія'] ? { name: row['Категорія'] } : null,
    measureUnit: row['Од.вим.'] || 'шт',
    promQuantity: null,
    rozetkaQuantity: null,
    priceOld: null,
    pricePromo: null,
    updatedPrice: null,
    dateModified: new Date(),
    lastPromSync: null,
    lastRozetkaSync: null,
    needsPromSync: false,
    needsRozetkaSync: false,
  }
}

/**
 * Maps a row from the database CSV export ('productsFromDB.csv') to the
 * product shape expected by enrichAndInsertProducts().
 */
export function mapDbCsvToProduct(row: ProductFromDbCSV): any {
  const safeJsonParse = (jsonString: string) => {
    try {
      return JSON.parse(jsonString)
    } catch {
      return null
    }
  }

  return {
    productId: row.productId,
    sku: row.sku || null,
    name: row.name || 'Unnamed Product',
    price: String(row.price || '0.00'),
    costPrice: row.costPrice ? String(row.costPrice) : null,
    stockQuantity: parseInt(row.stockQuantity, 10) || 0,
    source: (row.source as Source) || Source.crm,
    externalIds: safeJsonParse(row.externalIds),
    description: row.description || null,
    mainImage: row.mainImage || null,
    images: safeJsonParse(row.images) || [],
    available: row.available === 'true',
    priceOld: row.priceOld ? String(row.priceOld) : null,
    pricePromo: row.pricePromo ? String(row.pricePromo) : null,
    updatedPrice: row.updatedPrice ? String(row.updatedPrice) : null,
    currency: row.currency || 'UAH',
    dateModified: row.dateModified ? new Date(row.dateModified) : null,
    lastSynced: row.lastSynced ? new Date(row.lastSynced) : new Date(),
    needsSync: row.needsSync === 'true',
    categoryData: safeJsonParse(row.categoryData),
    measureUnit: row.measureUnit || 'шт',
    lastPromSync: row.lastPromSync ? new Date(row.lastPromSync) : null,
    lastRozetkaSync: row.lastRozetkaSync ? new Date(row.lastRozetkaSync) : null,
    needsPromSync: row.needsPromSync === 'true',
    needsRozetkaSync: row.needsRozetkaSync === 'true',
    promQuantity: null,
    rozetkaQuantity: null,
  }
}
