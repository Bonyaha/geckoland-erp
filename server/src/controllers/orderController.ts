// server/src/controllers/orderController.ts
import { Request, Response } from 'express'
import OrderService from '../services/orderService'
import { Source } from '@prisma/client'

const orderService = new OrderService()

/**
 * Fetch new orders from Prom marketplace and create them in database
 */
export const fetchNewPromOrders = async (req: Request, res: Response) => {
  try {
    console.log('Received request to fetch new Prom orders')

    const result = await orderService.fetchAndCreateNewPromOrders()

    // Adjust response based on errors
    const hasErrors = result.errors > 0

    res.status(hasErrors ? 207 : 200).json({
      success: !hasErrors,
      message: hasErrors
        ? `Processed Prom orders with ${result.errors} errors`
        : 'Successfully processed all Prom orders',
      data: result,
    })
  } catch (error: any) {
    console.error('Error in fetchNewPromOrders controller:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to fetch new Prom orders',
      error: error.message,
    })
  }
}


/**
 * Create new manual order from frontend (CRM)
 * @route POST /api/orders/create-crm
 */
export const createCRMOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderData = req.body
    if (!orderData || Object.keys(orderData).length === 0) {
      res.status(400).json({ error: 'Order data is required' })
      return
    }

    const orderId = await orderService.createOrderFromCRM(orderData)

    res.status(201).json({
      message: 'CRM order created successfully',
      orderId,
    })
  } catch (error: any) {
    console.error('❌ Error creating CRM order:', error)
    res.status(500).json({
      error: 'Failed to create CRM order',
      details: error.message,
    })
  }
}


/**
 * Get orders with filtering and pagination
 */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { page, limit, source, status } = req.query

    const params: any = {}
    if (page) params.page = parseInt(page as string)
    if (limit) params.limit = parseInt(limit as string)
    if (source && (source === 'prom' || source === 'rozetka')) {
      params.source = source as Source
    }
    if (status) params.status = status as string

    const result = await orderService.getOrders(params)

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error in getOrders controller:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    })
  }
}

/**
 * Get a specific order by ID
 */
export const getOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params

    const order = await orderService.getOrderById(orderId)

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: order,
    })
  } catch (error: any) {
    console.error('Error in getOrderById controller:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message,
    })
  }
}

/**
 * Manual trigger to sync orders from all marketplaces
 */
export const syncOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { marketplace } = req.body

    let result

    if (!marketplace || marketplace === 'prom') {
      result = await orderService.fetchAndCreateNewPromOrders()
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid marketplace. Currently only "prom" is supported.',
      })
      return
    }

    res.status(200).json({
      success: true,
      message: `Successfully synced orders from ${marketplace || 'prom'}`,
      data: result,
    })
  } catch (error: any) {
    console.error('Error in syncOrders controller:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to sync orders',
      error: error.message,
    })
  }
}
