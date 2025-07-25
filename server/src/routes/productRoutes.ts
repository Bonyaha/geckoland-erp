import { Router } from 'express'
import {
  createProduct,
  getProducts,
  updateProduct} from '../controllers/productController'

const router = Router()

router.get('/', getProducts)
router.post('/', createProduct)
router.patch('/:productId', updateProduct)

export default router
