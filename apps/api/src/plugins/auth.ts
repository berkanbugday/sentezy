import fp from "fastify-plugin";
import { type JWTPayload, createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: { id: string; email: string | null };
  }
}

/**
 * Verifies the Supabase user JWT locally (no network per request, no WebSocket dep).
 * Supabase issues asymmetric (ES256/RS256, via JWKS) or legacy HS256 (shared secret)
 * tokens — we support both, dispatching on the token's `alg` header.
 */
export default fp(async (app) => {
  const jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  const hsSecret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;
  const opts = { issuer: `${env.SUPABASE_URL}/auth/v1`, audience: "authenticated" };

  async function verify(token: string): Promise<JWTPayload> {
    const { alg } = decodeProtectedHeader(token);
    if (alg?.startsWith("HS")) {
      if (!hsSecret) throw new Error("hs256_secret_missing");
      return (await jwtVerify(token, hsSecret, opts)).payload;
    }
    return (await jwtVerify(token, jwks, opts)).payload;
  }

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      await reply.code(401).send({ error: "missing_token" });
      return;
    }
    try {
      const payload = await verify(token);
      req.user = { id: String(payload.sub), email: (payload.email as string) ?? null };
    } catch {
      await reply.code(401).send({ error: "invalid_token" });
    }
  });
});
