// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/environment'
import { ErrorFactory } from './errorHandler'

/**
 * Extended Request interface with user property
 * This matches the data you will pack into the JWT token
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    email: string
    role: string
    // Add more user properties as needed
  }
}

/**
 * Authentication middleware
 * 1. Checks for Authorization header
 * 2. Verifies the JWT token
 * 3. Attaches the decoded user to req.user
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization

    // Check if header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Throwing here sends us straight to the catch block
      throw new Error('Missing or invalid Authorization header')
    }

    // Extract the token string
    const token = authHeader.split(' ')[1]

    // Verify the token
    // This throws an error if the token is invalid or expired
    const decoded = jwt.verify(token, config.jwt.secret)

    // Ensure the token payload is an object (not a string)
    if (typeof decoded === 'string' || !decoded) {
      throw new Error('Invalid token structure')
    }

    // Attach user data to the request object
    // We cast it because we know what we put in the token
    req.user = decoded as AuthenticatedRequest['user']
    next()
  } catch (error) {
    next(
      // If token is expired or invalid, jwt.verify throws an error
      // We catch it and normalize it to a 401 Unauthorized
      ErrorFactory.unauthorized('Invalid or expired authentication token')
    )
  }
}

/**
 * Role-based authorization middleware
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ErrorFactory.unauthorized('Authentication required'))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ErrorFactory.forbidden('Insufficient permissions'))
    }

    next()
  }
}

/**
 * Optional authentication middleware
 * Doesn't fail if no token is provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const decoded = jwt.verify(token, config.jwt.secret)

      if (typeof decoded !== 'string' && decoded) {
        req.user = decoded as AuthenticatedRequest['user']
      }
    }

    // Whether token was found/valid or not, we proceed
    next()
  } catch (error) {
    // Continue without authentication
    next()
  }
}
