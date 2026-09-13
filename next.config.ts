import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * schema.sql is read at runtime by src/lib/schema.ts, but nothing imports it,
   * so file tracing would leave it out of the serverless bundle. Every route
   * here talks to the database, so include it for all of them.
   */
  outputFileTracingIncludes: {
    "/**": ["./schema.sql"],
  },
};

export default nextConfig;
