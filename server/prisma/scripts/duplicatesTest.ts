/* import data from '../data/products.json'

interface Product {
  sku: string | null
  // add other fields if needed
}

const products: Product[] = data as Product[]
const skus = products
  .map((item) => item.sku)
  .filter((sku): sku is string => sku !== null)
const duplicates = skus.filter((sku, index) => skus.indexOf(sku) !== index)
console.log('Duplicate SKUs:', [...new Set(duplicates)])
 */