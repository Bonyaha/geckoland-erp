import { Router } from 'express'
import { createProduct, getProducts,updateProductQuantity } from '../controllers/productController'

const router = Router()

router.get('/', getProducts)
router.post('/', createProduct)
router.patch('/:productId/quantity', updateProductQuantity)

export default router
