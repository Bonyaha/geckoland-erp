// server/src/utils/helpers/mapCsvProductToEnriched.ts

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
  promId?: string
  rozetkaItemId?: string
  rozetkaRzItemId?: string
}

/**
 * ============================================================
 * SHARED HELPERS
 * ============================================================
 */

function parseNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value

  return ['true', '1', 'yes'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseDate(value: unknown): Date | null {
  if (!value) return null

  const date = new Date(String(value))

  return Number.isNaN(date.getTime()) ? null : date
}

function parseImages(value: unknown): string[] {
  if (!value) return []

  const parsed = parseJson<unknown>(value, null)

  if (Array.isArray(parsed)) {
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .filter(Boolean)
  }

  // Fallback for CSV exports where images are comma-separated.
  return String(value)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
}

/**
 * ============================================================
 * HUGEProfit CSV MAPPER
 * ============================================================
 *
 * Maps products.csv from HugeProfit CRM.
 *
 * The ID is stable across imports. This is important because
 * generating a random ID on every import creates duplicates.
 */

export function mapHPCsvToProduct(
  row: ProductFromHPCSV,
): Record<string, any> | null {
  const externalId = String(row.ID ?? '').trim()

  if (!externalId) {
    console.warn('⚠️ Skipping HugeProfit CSV row without ID.')
    return null
  }

  const quantity = Math.max(0, Math.trunc(parseNumber(row['Кількість'])))

  const price = Math.max(0, parseNumber(row['Ціна']))

  const costPrice =
    row['Собівр.']?.trim() !== ''
      ? Math.max(0, parseNumber(row['Собівр.']))
      : undefined

  const images = row['Зображення']
    ? row['Зображення']
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)
    : []

  return {
    // Stable ID; existing records can also be matched by SKU.
    productId: `hp_${externalId}`,

    sku: row['Артикул']?.trim() || null,

    name: row['Назва']?.trim() || 'Unnamed Product',

    price: String(price),

    costPrice: costPrice !== undefined ? String(costPrice) : undefined,

    stockQuantity: quantity,

    available: quantity > 0,

    description: row['Опис']?.trim() || null,

    mainImage: images[0] || null,

    images,

    currency: 'UAH',

    measureUnit: row['Од.вим.']?.trim() || 'шт.',

    categoryData: row['Категорія']?.trim()
      ? {
          hugeprofit: {
            name: row['Категорія'].trim(),
          },
        }
      : undefined,

    lastSynced: new Date(),

    needsSync: false,
  }
}

/**
 * ============================================================
 * DATABASE CSV MAPPER
 * ============================================================
 *
 * Maps productsFromDB.csv.
 *
 * This mapper restores the database fields, including marketplace
 * identifiers and existing internal product IDs.
 */

export function mapDbCsvToProduct(
  row: ProductFromDbCSV,
): Record<string, any> | null {
  const productId = String(row.productId ?? '').trim()

  if (!productId) {
    console.warn('⚠️ Skipping database CSV row without productId.')
    return null
  }

  const images = parseImages(row.images)

  return {
    productId,

    sku: row.sku || null,

    name: row.name || 'Unnamed Product',

    price: String(Math.max(0, parseNumber(row.price))),

    stockQuantity: Math.max(0, Math.trunc(parseNumber(row.stockQuantity))),

    promId: row.promId || undefined,

    rozetkaItemId: row.rozetkaItemId || undefined,

    rozetkaRzItemId: row.rozetkaRzItemId || undefined,

    description: row.description || null,

    mainImage: row.mainImage || images[0] || null,

    images,

    available: parseBoolean(row.available),

    priceOld:
      row.priceOld !== '' && row.priceOld !== null
        ? String(parseNumber(row.priceOld))
        : null,

    pricePromo:
      row.pricePromo !== '' && row.pricePromo !== null
        ? String(parseNumber(row.pricePromo))
        : null,

    updatedPrice:
      row.updatedPrice !== '' && row.updatedPrice !== null
        ? String(parseNumber(row.updatedPrice))
        : null,

    currency: row.currency || 'UAH',

    dateModified: parseDate(row.dateModified),

    lastSynced: parseDate(row.lastSynced) ?? new Date(),

    needsSync: parseBoolean(row.needsSync),

    categoryData: parseJson(row.categoryData, null),

    measureUnit: row.measureUnit || 'шт.',

    lastPromSync: parseDate(row.lastPromSync),

    lastRozetkaSync: parseDate(row.lastRozetkaSync),

    needsPromSync: parseBoolean(row.needsPromSync),

    needsRozetkaSync: parseBoolean(row.needsRozetkaSync),

    promQuantity:
      row.promQuantity !== '' && row.promQuantity !== null
        ? Math.trunc(parseNumber(row.promQuantity))
        : null,

    rozetkaQuantity:
      row.rozetkaQuantity !== '' && row.rozetkaQuantity !== null
        ? Math.trunc(parseNumber(row.rozetkaQuantity))
        : null,

    costPrice:
      row.costPrice !== '' && row.costPrice !== null
        ? String(parseNumber(row.costPrice))
        : null,
  }
}
