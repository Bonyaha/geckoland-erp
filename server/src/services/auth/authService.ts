import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../config/database'
import { config } from '../../config/environment'
import { ErrorFactory } from '../../middleware/errorHandler'

// Define types for the service inputs
interface LoginParams {
  email: string
  password: string
}

interface RegisterParams {
  name: string
  email: string
  password: string
}

interface AuthResult {
  success: boolean
  token: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

class AuthService {
  /**
   * Authenticate a user and return a JWT token
   */
  async login({ email, password }: LoginParams): Promise<AuthResult> {
    // 1. Find user
    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      throw ErrorFactory.unauthorized('Invalid email or password')
    }

    // 2. Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      throw ErrorFactory.unauthorized('Invalid email or password')
    }

    // 3. Generate Token
    const token = this.generateToken(user)

    return {
      success: true,
      token,
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  }

  /**
   * Register a new user
   */
  async register({
    name,
    email,
    password,
  }: RegisterParams): Promise<AuthResult> {
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
        role: 'admin', // Default role
      },
    })

    // 4. Generate token
    const token = this.generateToken(user)

    return {
      success: true,
      token,
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  }

  /**
   * Private helper to generate JWT tokens
   */
  private generateToken(user: { userId: string; email: string; role: string }) {
    return jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )
  }
}

export default new AuthService()
