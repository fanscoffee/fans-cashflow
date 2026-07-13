import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials as {
          email: string
          password: string
        }

        console.log("[Auth] Intento de login:", email)

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          console.log("[Auth] Usuario no encontrado:", email)
          return null
        }

        console.log("[Auth] Usuario encontrado, verificando contraseña...")
        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
          console.log("[Auth] Contraseña incorrecta para:", email)
          return null
        }

        console.log("[Auth] Login exitoso:", email, "rol:", user.role)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
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
})
