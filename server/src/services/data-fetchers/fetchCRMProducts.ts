// server/src/services/data-fetchers/fetchCRMProducts.ts
import axios from 'axios'
import * as fs from 'fs/promises'
import {config} from '../../config/environment'
import prisma, { Source } from '../../config/database'

/* 
  ------------------------------------------------------------------ 
      Function to fetch products from HugeProfit CRM API 
  ------------------------------------------------------------------
*/
export async function fetchCRMProducts() {
  const { apiKey } = config.marketplaces.hugeprofit

  const baseUrl = 'https://h-profit.com/bapi/products'
  const headers = { Authorization: `${apiKey}` }
  let allProducts: any[] = []

  console.log('Starting to fetch all products...')

  try {
    const response = await axios.get(baseUrl, { headers })
    //console.log('Sample product:', response.data.data[0])

    const { data: products } = response.data
    console.log(`Fetched ${products.length} products.`)

    allProducts.push(...products)
    
    const transformedProducts = allProducts.map((product: any) => {
      const stockInfo = product.stock?.[0] || {}
      const salePrice = stockInfo.sale_price;
      const regularPrice = stockInfo.price;
      const promoPrice = salePrice && salePrice !== regularPrice ? salePrice : null;

      return {
        productId: String(product.id),
        sku: product.sku || null,
        name: product.name || "Unnamed Product",
        price: String(regularPrice || '0.00'),
        stockQuantity: parseInt(stockInfo.quantity || 0, 10),
        source: Source.prom,
        externalIds: { prom: null, rozetka: null },
        description:
          product.description === 'None' ? null : product.description,
        mainImage: product.images?.[0] || null,
        images: product.images || [],
        inStock: parseInt(stockInfo.instock || 0, 10),
        available: Boolean(stockInfo.instock > 0),
        priceOld: null,
        pricePromo:
          promoPrice ? String(promoPrice) : null,
        updatedPrice: String(regularPrice || '0.00'),
        currency: 'UAH',
        dateModified: new Date(),
        lastSynced: new Date(),
        needsSync: false,        
        categoryData: { rawData: product.category || null },
        measureUnit: product.unit || 'шт.',
        status: 'active',
        lastPromSync: null,
        lastRozetkaSync: null,
        needsPromSync: false,
        needsRozetkaSync: false,
        promQuantity: parseInt(stockInfo.quantity || 0, 10),
        rozetkaQuantity: parseInt(stockInfo.quantity || 0, 10),
      }
    })
    
    await fs.writeFile(
      'prisma/data/productsFromHP.json',
      JSON.stringify(transformedProducts, null, 2)
    )

    console.log(`\nFinished! Total products fetched: ${allProducts.length}`)
    
    return transformedProducts
  } catch (error) {
    console.error('Error fetching products from HugeProfit API:', error)
    throw error
  }
}


/* 
  ------------------------------------------------------------------------------- 
      Function to fetch all products from my database and save to a JSON file
  --------------------------------------------------------------------------
*/

export async function fetchAllProductsFromDb() {
  console.log('🚀 Starting to fetch all products from the database...');
  try {    
    const allDbProducts = await prisma.products.findMany();

    console.log(`✅ Found ${allDbProducts.length} products in the database.`);
   
    await fs.writeFile(
      'prisma/data/productsFromDB.json',
      JSON.stringify(allDbProducts, null, 2)
    );

    console.log(
      '🎉 Success! Database products saved to prisma/data/products.json'
    );

    return allDbProducts;
  } catch (error) {
    console.error('❌ Error fetching products from the database:', error);
    throw error;
  } finally {
    // IMPORTANT: Always disconnect from the database when the script is done.
    await prisma.$disconnect();
    console.log('🔌 Database connection closed.');
  }
}

//fetchCRMProducts()
