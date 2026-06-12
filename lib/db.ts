import { neon } from "@neondatabase/serverless";

// DATABASE_URL comes from .env.local (local) and Vercel env vars (production)
export const sql = neon(process.env.DATABASE_URL!);