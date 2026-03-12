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
