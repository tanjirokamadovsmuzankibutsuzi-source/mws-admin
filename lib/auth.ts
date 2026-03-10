// lib/auth.ts

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'mws-super-secret-key-change-in-prod'
)
const COOKIE_NAME = 'mws_session'

export interface SessionUser {
  id: string
  username: string
  role: 'owner' | 'auth'
}

export async function signToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(req?: NextRequest): Promise<SessionUser | null> {
  let token: string | undefined

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value
  } else {
    const cookieStore = cookies()
    token = cookieStore.get(COOKIE_NAME)?.value
  }

  if (!token) return null
  return verifyToken(token)
}

// ─── USERS (stored in env for simplicity, or a separate GitHub file) ─────────
// Format: USERS env = JSON array of {id, username, passwordHash, role}

export interface MwsUser {
  id: string
  username: string
  passwordHash: string
  role: 'owner' | 'auth'
}

export function getUsers(): MwsUser[] {
  try {
    const raw = process.env.MWS_USERS || '[]'
    return JSON.parse(raw)
  } catch {
    return []
  }
}
