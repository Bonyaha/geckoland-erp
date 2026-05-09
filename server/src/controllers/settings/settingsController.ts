// server/src/controllers/settings/settingsController.ts
import { Request, Response } from 'express'
import { settingsService } from '../../services/settings/settingsService'
import { ErrorFactory } from '../../middleware/errorHandler'

export const setRozetkaStoreStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { active } = req.body

  if (typeof active !== 'boolean') {
    throw ErrorFactory.badRequest('active must be a boolean')
  }

  await settingsService.setRozetkaStoreActive(active)

  res.json({
    success: true,
    rozetkaStoreActive: active,
    message: `Rozetka store marked as ${active ? 'ACTIVE' : 'INACTIVE'}`,
  })
}

export const getRozetkaStoreStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const active = await settingsService.isRozetkaStoreActive()

  res.json({
    success: true,
    rozetkaStoreActive: active,
  })
}

export const getSyncStrategy = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const strategy = await settingsService.getSyncStrategy()
  res.json({ success: true, syncStrategy: strategy })
}

export const setSyncStrategy = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { strategy } = req.body

  if (strategy !== 'same_quantity' && strategy !== 'different_quantity') {
    throw ErrorFactory.badRequest('strategy must be "same_quantity" or "different_quantity"')
  }

  await settingsService.setSyncStrategy(strategy)
  res.json({ success: true, syncStrategy: strategy, message: `Sync strategy set to ${strategy}` })
}
