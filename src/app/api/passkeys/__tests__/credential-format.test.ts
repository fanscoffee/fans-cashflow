// @vitest-environment node

import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { isoCBOR } from "@simplewebauthn/server/helpers"
import type { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { POST as authenticate } from "../authenticate/route"
import { GET as register, POST as finishRegistration } from "../register/route"
import { POST as verify } from "../verify/route"

const user = { id: "staff-test", name: "Test", email: "staff@example.invalid", role: "EMPLOYEE", authVersion: 0 }
const { origin, rpID } = vi.hoisted(() => ({ origin: "http://localhost:3000", rpID: "localhost" }))
const credentialId = Buffer.from("example-credential").toString("base64url")
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
const { x, y } = publicKey.export({ format: "jwk" })
const credentialPublicKey = isoCBOR.encode(new Map<number, number | Buffer>([
  [1, 2], [3, -7], [-1, 1], [-2, Buffer.from(x!, "base64url")], [-3, Buffer.from(y!, "base64url")],
]))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user })),
}))

vi.mock("@/lib/webauthn", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/webauthn")>(),
  RP_ID: rpID,
  ORIGINS: [origin],
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    passkey: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    webAuthnChallenge: { deleteMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (run) => run(prisma)),
  },
}))

function request(path: string, body?: object) {
  return new Request(`${origin}/api/passkeys/${path}`, body && {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest
}

function clientData(type: "webauthn.create" | "webauthn.get", challenge: string) {
  return Buffer.from(JSON.stringify({ type, challenge, origin }))
}

function authenticatorData(flags: number, counter: number) {
  const data = Buffer.alloc(37)
  createHash("sha256").update(rpID).digest().copy(data)
  data[32] = flags
  data.writeUInt32BE(counter, 33)
  return data
}

describe("WebAuthn credential format", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...user,
      passkeys: [{ id: "stored-key", credentialId, transports: '["internal"]' }],
    } as any)
    vi.mocked(prisma.webAuthnChallenge.findFirst).mockResolvedValue({ id: "challenge-id" } as any)
    vi.mocked(prisma.webAuthnChallenge.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.passkey.updateMany).mockResolvedValue({ count: 1 })
  })

  it("preserves the user handle and stores newly verified passkeys in the same format", async () => {
    const options = await (await register(request("register"))).json()
    expect(Buffer.from(options.user.id, "base64url").toString("utf8")).toBe(user.id)
    expect(options.excludeCredentials).toEqual([{ id: credentialId, type: "public-key" }])
    expect(options.authenticatorSelection.userVerification).toBe("required")
    expect(options.pubKeyCredParams.map(({ alg }: { alg: number }) => alg)).toEqual([-8, -7, -257])

    const idBytes = Buffer.from("new-credential")
    const id = idBytes.toString("base64url")
    const length = Buffer.alloc(2)
    length.writeUInt16BE(idBytes.length)
    const authData = Buffer.concat([authenticatorData(0x45, 0), Buffer.alloc(16), length, idBytes, credentialPublicKey])
    const attestation = isoCBOR.encode(new Map<string, string | Uint8Array | Map<string, never>>([
      ["fmt", "none"], ["attStmt", new Map<string, never>()], ["authData", new Uint8Array(authData)],
    ]))
    const result = await finishRegistration(request("register", {
      challenge: options.challenge,
      credential: {
        id, rawId: id, type: "public-key", clientExtensionResults: {},
        response: {
          clientDataJSON: clientData("webauthn.create", options.challenge).toString("base64url"),
          attestationObject: Buffer.from(attestation).toString("base64url"),
        },
      },
    }))
    expect(result.status).toBe(200)
    expect(prisma.passkey.create).toHaveBeenCalledWith({
      data: {
        credentialId: id, userId: user.id, publicKey: credentialPublicKey, counter: BigInt(0), transports: null,
      },
    })
  })

  it("verifies a stored credential ID and public key without rewriting them", async () => {
    vi.mocked(prisma.passkey.findUnique).mockResolvedValue({
      id: "stored-key", userId: user.id, user, credentialId,
      publicKey: credentialPublicKey, counter: BigInt(1), transports: '["internal"]',
    } as any)
    const options = await (await authenticate(request("authenticate", { email: user.email }))).json()
    expect(options.allowCredentials).toEqual([{ id: credentialId, transports: ["internal"], type: "public-key" }])
    expect(options.userVerification).toBe("required")

    const client = clientData("webauthn.get", options.challenge)
    const authData = authenticatorData(0x05, 2)
    const signature = sign("sha256", Buffer.concat([authData, createHash("sha256").update(client).digest()]), privateKey)
    const result = await verify(request("verify", {
      challenge: options.challenge,
      credential: {
        id: credentialId, rawId: credentialId, type: "public-key", clientExtensionResults: {},
        response: {
          clientDataJSON: client.toString("base64url"),
          authenticatorData: authData.toString("base64url"),
          signature: signature.toString("base64url"),
        },
      },
    }))
    expect(result.status).toBe(200)
    expect(prisma.passkey.updateMany).toHaveBeenCalledWith({
      where: { id: "stored-key", counter: BigInt(1) }, data: { counter: BigInt(2) },
    })
  })
})
