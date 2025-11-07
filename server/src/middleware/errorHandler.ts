import { Request, Response, NextFunction } from 'express'
import { config } from '../config/environment'
import { Prisma } from '../config/database'
/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number
  isOperational: boolean
  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Common error factory functions
 */
export class ErrorFactory {
  static badRequest(message: string) {
    return new AppError(message, 400)
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401)
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403)
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404)
  }

  static conflict(message: string) {
    return new AppError(message, 409)
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500)
  }

  static validationError(message: string) {
    return new AppError(message, 422)
  }
}

/**
 * Global error handling middleware
 * Must be registered AFTER all routes
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default to 500 server error
  let statusCode = 500
  let message = 'Internal Server Error'
  let isOperational = false

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = err as any
    isOperational = true

    switch (prismaError.code) {
      // Unique constraint violation
      case 'P2002': {
        statusCode = 409
        message = `Duplicate entry: ${
          prismaError.meta?.target || 'field'
        } already exists`
        break
      }
      // Record not found
      case 'P2025': {
        statusCode = 404
        message = 'Record not found'
        break
      }
      // Foreign key constraint failed
      case 'P2003': {
        statusCode = 400
        message = 'Invalid reference: related record does not exist'
        break
      }
    }
  }

  // Handle validation errors (from Zod or other validators)
  else if (err.name === 'ZodError') {
    const zodError = err as any
    statusCode = 400
    message = 'Validation error'

    const errorResponse: any = {
      message,
      statusCode,
      details: zodError.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    }

    if (config.app.isDevelopment) {
      errorResponse.stack = err.stack
      errorResponse.context = {
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
      }
    }
    //We send the response immediately for Zod errors because
    //Zod errors are fully self-contained and don’t need any shared logic (like logging, fallback formatting, or operational flags).
    return res.status(statusCode).json(errorResponse)
  }

  // Handle custom AppError
  else if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    isOperational = err.isOperational
  } else {
    message = err.message || message
  }

  // Log error (in production, you'd send this to a logging service)
  if (!isOperational || statusCode >= 500) {
    console.error('💥 Error:', {
      message: err.message,
      stack: err.stack,
      statusCode,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    })
  }

  // Prepare error response
  const errorResponse: any = {
    message,
    statusCode,
  }

  // Include stack trace in development
  if (config.app.isDevelopment) {
    errorResponse.stack = err.stack
    errorResponse.context = {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    }
  }

  res.status(statusCode).json(errorResponse)
}

/**
 * 404 Not Found handler
 * Must be registered AFTER all routes but BEFORE error handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = ErrorFactory.notFound(
    `Route ${req.method} ${req.originalUrl} not found`
  )
  next(error)
}
