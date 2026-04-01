// server/src/controllers/auth/authController.ts
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../config/database'
import { config } from '../../config/environment'
import { ErrorFactory } from '../../middleware/errorHandler'
import authService from '../../services/auth/authService'

/**
 * Log in a user and return a JWT token
 */
export const login = async (req: Request, res: Response) => {
  /// Req body is already validated by middleware
  const result = await authService.login(req.body)
  res.json(result)
}

/**
 * Register a new user (Helper to create your first users)
 */
export const register = async (req: Request, res: Response) => {
  // Req body is already validated by middleware
  const result = await authService.register(req.body)
  res.status(201).json(result)
}
