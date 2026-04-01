// server/src/controllers/users/userController.ts
import { Request, Response } from 'express'
import prisma from '../../config/database'
import { ErrorFactory } from '../../middleware/errorHandler'

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const users = await prisma.users.findMany()
  if (!users || users.length === 0) {
    throw ErrorFactory.notFound('No users found')
  }
  res.json(users)
}
