//server/src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express'
import { config } from '../config/environment'

/**
 * Enhanced request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now()

  // Log request
  if (config.app.isDevelopment) {
    console.log(`📥 ${req.method} ${req.path}`, {
      params: req.params,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    })
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start
    const statusColor = res.statusCode >= 400 ? '🔴' : '🟢'

    if (config.app.isDevelopment) {
      console.log(
        `${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      )
    }
  })

  next()
}
