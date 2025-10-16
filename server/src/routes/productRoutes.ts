// server/src/routes/productRoutes.ts
import { Router } from 'express'
import {
  createProduct,
  getProducts,
  updateProduct} from '../controllers/productController'

const router = Router()

router.get('/', getProducts)
router.post('/', createProduct)
router.patch('/:productId', updateProduct)
router.put('/:productId', updateProduct)

export default router

/**
 * USAGE EXAMPLES:
 * 
 * 1. Single Product Update:
 * -------------------------
 * PUT http://localhost:8001/products/2121361183
 * Content-Type: application/json
 * 
 * {
 *   "quantity": 3,
 *   "price": 30
 * }
 * 
 * Response:
 * {
 *   "message": "Product updated and synced successfully",
 *   "productId": "product_123",
 *   "updates": { "quantity": 15, "price": 299.99 },
 *   "syncedMarketplaces": ["Prom", "Rozetka"],
 *   "totalMarketplaces": 2
 * }
 * 
 * 
 * 2. Batch Product Update:
 * ------------------------
 * PUT http://localhost:8001/products/batch
 * Content-Type: application/json
 * 
 * {
 *   "products": [
 *     {
 *       "productId": "4654307_JtxCWn",
 *       "updates": { "quantity": 7, "price": 50 }
 *     },
 *     {
 *       "productId": "4654138_wg4jkU",
 *       "updates": { "quantity": 3 }
 *     }
 *   ]
 * }

curl -X PATCH http://localhost:8001/products/batch \
  -H "Content-Type: application/json" \
  -d '{"quantity": 2, "price": 30}'
 * 
 * Response:
 * {
 *   "message": "Batch update completed",
 *   "summary": {
 *     "totalRequested": 3,
 *     "successfulDatabaseUpdates": 3,
 *     "failedDatabaseUpdates": 0,
 *     "marketplacesSynced": ["Prom (2 products)", "Rozetka (3 products)"]
 *   },
 *   "details": {
 *     "successfulProducts": ["product_123", "product_456", "product_789"]
 *   }
 * }
 * 
 * 
 * 3. Update Only Quantity:
 * ------------------------
 * PUT http://localhost:8001/products/product_123
 * Content-Type: application/json
 * 
 * {
 *   "quantity": 20
 * }
 * 
 * 
 * 4. Update Only Price:
 * ---------------------
 * PUT http://localhost:8001/products/product_456
 * Content-Type: application/json
 * 
 * {
 *   "price": 399.99
 * }
 * 
 * 
 * 5. Batch Update with Mixed Parameters:
 * ---------------------------------------
 * PUT http://localhost:8001/products/batch
 * Content-Type: application/json
 * 
 * {
 *   "products": [
 *     {
 *       "productId": "product_001",
 *       "updates": { "quantity": 100, "price": 999 }
 *     },
 *     {
 *       "productId": "product_002",
 *       "updates": { "quantity": 50 }
 *     },
 *     {
 *       "productId": "product_003",
 *       "updates": { "price": 299 }
 *     },
 *     {
 *       "productId": "product_004",
 *       "updates": { "quantity": 0 }  // Mark as out of stock
 *     }
 *   ]
 * } */