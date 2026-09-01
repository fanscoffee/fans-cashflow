import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { checkRateLimit, requestAddress } from "./rate-limit"

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

if (process.env.NODE_ENV === "production" && (!authSecret || authSecret.length < 32)) {
  throw new Error("AUTH_SECRET debe tener al menos 32 caracteres en producción")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : ""
        const password = typeof credentials?.password === "string" ? credentials.password : ""

        if (!email || !password) return null
        const addressLimit = checkRateLimit(`password-login:${requestAddress(request)}`, 20, 60_000)
        const accountLimit = checkRateLimit(`password-account:${email}`, 10, 15 * 60_000)
        if (!addressLimit.allowed || !accountLimit.allowed) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authVersion: user.authVersion,
        }
      },
    }),
    Credentials({
      id: "passkey-credentials",
      name: "Passkey",
      credentials: {
        challenge: { label: "WebAuthn challenge", type: "text" },
      },
      async authorize(credentials) {
        const challenge = typeof credentials?.challenge === "string" ? credentials.challenge : ""
        if (!challenge) return null

        const now = new Date()
        const grant = await prisma.webAuthnChallenge.findFirst({
          where: {
            challenge,
            purpose: "AUTHENTICATION",
            expiresAt: { gt: now },
            verifiedAt: { not: null },
            consumedAt: null,
            verifiedUserId: { not: null },
          },
          select: { id: true, verifiedUserId: true },
        })
        if (!grant?.verifiedUserId) return null

        const consumed = await prisma.webAuthnChallenge.updateMany({
          where: {
            id: grant.id,
            expiresAt: { gt: now },
            verifiedAt: { not: null },
            consumedAt: null,
          },
          data: { consumedAt: now },
        })
        if (consumed.count !== 1) return null

        const user = await prisma.user.findUnique({ where: { id: grant.verifiedUserId } })
        if (!user) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authVersion: user.authVersion,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.authVersion = (user as typeof user & { authVersion?: number }).authVersion
      }

      if (typeof token.id === "string") {
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true, email: true, name: true, role: true, authVersion: true },
        })
        if (!currentUser) {
          token.id = undefined
          token.role = undefined
          token.sub = undefined
          return token
        }
        if (typeof token.authVersion === "number" && token.authVersion !== currentUser.authVersion) {
          token.id = undefined
          token.role = undefined
          token.sub = undefined
          token.authVersion = undefined
          return token
        }
        token.role = currentUser.role
        token.email = currentUser.email
        token.name = currentUser.name
        token.authVersion = currentUser.authVersion
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  ...(authSecret ? { secret: authSecret } : {}),
})
