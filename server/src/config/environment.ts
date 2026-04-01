// server/src/config/environment.ts
import { config as loadEnv } from 'dotenv'
import { z } from 'zod'
import path from 'path'

loadEnv()

const envSchema = z.looseObject({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce
    .number({
      message: 'PORT must be a valid number',
    })
    .int()
    .positive()
    .default(8001),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required to connect to the database'),

  // Marketplace APIs
  PROM_API_KEY: z.string().min(1, 'PROM_API_KEY is required'),
  PROM_API_BASE_URL: z
    .url({ message: 'PROM_API_BASE_URL must be a valid URL' })
    .default('https://my.prom.ua/api/v1'),

  ROZETKA_API_USERNAME: z.string().min(1, 'ROZETKA_API_USERNAME is required'),
  ROZETKA_API_PASSWORD: z.string().min(1, 'ROZETKA_API_PASSWORD is required'),

  HUGEPROFIT_API_KEY: z.string().min(1, 'HUGEPROFIT_API_KEY is required'),

  // Telegram
  TELEGRAM_API_ID: z.coerce
    .number({ message: 'TELEGRAM_API_ID must be a valid number' })
    .int()
    .positive(),
  TELEGRAM_API_HASH: z.string().min(1, 'TELEGRAM_API_HASH is required'),
  TELEGRAM_FORWARD_URL: z.url({
    message: 'TELEGRAM_FORWARD_URL must be a valid URL',
  }),

  // Nova Poshta
  NOVA_POSHTA_API_KEY: z.string().min(1, 'NOVA_POSHTA_API_KEY is required'),
  NOVA_POSHTA_API_URL: z
    .url({ message: 'NOVA_POSHTA_API_URL must be a valid URL' })
    .default('https://api.novaposhta.ua/v2.0/json/'),

  // Gmail API
  GMAIL_CLIENT_ID: z.string().min(1, 'GMAIL_CLIENT_ID is required'),
  GMAIL_CLIENT_SECRET: z.string().min(1, 'GMAIL_CLIENT_SECRET is required'),
  GMAIL_REDIRECT_URI: z.url({
    message: 'GMAIL_REDIRECT_URI must be a valid URL',
  }),
  GOOGLE_PUBSUB_TOPIC: z.string().min(1, 'GOOGLE_PUBSUB_TOPIC is required'),

  // JWT Configuration
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
})

const envResult = envSchema.safeParse(process.env)

if (!envResult.success) {
  const { fieldErrors, formErrors } = z.flattenError(envResult.error)
  const errorMessages = [
    ...Object.entries(fieldErrors).flatMap(
      ([key, messages]) =>
        messages?.map((message) => `${key}: ${message}`) ?? []
    ),
    ...formErrors,
  ].join('\n')

  throw new Error(`Invalid environment configuration:\n${errorMessages}`)
}

// Freeze the validated configuration so that callers cannot accidentally
// mutate the shared environment object at runtime.
export const env = Object.freeze(envResult.data)

/**
 * Type-safe environment variable access
 */
export type Env = typeof env

/**
 * Helper functions for common environment checks
 */
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/**
 * Derived configuration values
 */
export const config = {
  app: {
    port: env.PORT,
    env: env.NODE_ENV,
    isDevelopment,
    isProduction,
    isTest,
  },
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: '7d', // Optional: define a standard expiration time
  },
  marketplaces: {
    prom: {
      apiKey: env.PROM_API_KEY,
      baseUrl: env.PROM_API_BASE_URL,
    },
    rozetka: {
      username: env.ROZETKA_API_USERNAME,
      password: env.ROZETKA_API_PASSWORD,
    },
    hugeprofit: {
      apiKey: env.HUGEPROFIT_API_KEY,
    },
  },
  telegram: {
    apiId: env.TELEGRAM_API_ID,
    apiHash: env.TELEGRAM_API_HASH,
    forwardUrl: env.TELEGRAM_FORWARD_URL,
  },
  shipping: {
    novaPoshta: {
      apiKey: env.NOVA_POSHTA_API_KEY,
      baseUrl: env.NOVA_POSHTA_API_URL,
    },
  },
  gmail: {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    redirectUri: env.GMAIL_REDIRECT_URI,
    pubSubTopic: env.GOOGLE_PUBSUB_TOPIC,
  },
  paths: {
    root: process.cwd(),
    prisma: path.join(process.cwd(), 'prisma'),
    historyFile: path.join(
      process.cwd(),
      'src',
      'storage',
      'gmail-history.json',
    ),
    processedMessagesFile: path.join(
      process.cwd(),
      'src',
      'storage',
      'processed-messages.json',
    ),
    gmailTokenFile: path.join(
      process.cwd(),
      'src',
      'config',
      'credentials',
      'gmail-token.json',
    ),
  },
} as const

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
]

// Log successful initialization (only in development)
if (isDevelopment) {
  console.log('✅ Environment configuration loaded successfully')
}
