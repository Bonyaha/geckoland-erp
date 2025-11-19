// server/src/controllers/auth/authController.ts
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../config/database'
import { config } from '../../config/environment'
import { ErrorFactory } from '../../middleware/errorHandler'

/**
 * Log in a user and return a JWT token
 */
export const login = async (req: Request, res: Response) => {
  // The validate middleware guarantees these exist
  const { email, password } = req.body

  // 1. Find user
  const user = await prisma.users.findUnique({
    where: { email },
  })

  if (!user) {
    // Generic error message for security (so attackers can't enumerate emails)
    throw ErrorFactory.unauthorized('Invalid email or password')
  }

  // 2. Verify password
  const isValidPassword = await bcrypt.compare(password, user.password)

  if (!isValidPassword) {
    throw ErrorFactory.unauthorized('Invalid email or password')
  }

  // 3. Generate Token
  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )

  // 4. Send response
  res.json({
    success: true,
    token,
    user: {
      id: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  })
}

/**
 * Register a new user (Helper to create your first users)
 */
export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body

  // 1. Check if user exists
  const existingUser = await prisma.users.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw ErrorFactory.conflict('User with this email already exists')
  }

  // 2. Hash password
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)

  // 3. Create user
  const user = await prisma.users.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'admin', // Defaulting to admin since it's just you two
    },
  })

  // 4. Generate token immediately so they are logged in
  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )

  res.status(201).json({
    success: true,
    token,
    user: {
      id: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  })
}
