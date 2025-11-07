import { Request, Response } from 'express'
import prisma from '../../config/database'

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const users = await prisma.users.findMany()
  res.json(users)
}
