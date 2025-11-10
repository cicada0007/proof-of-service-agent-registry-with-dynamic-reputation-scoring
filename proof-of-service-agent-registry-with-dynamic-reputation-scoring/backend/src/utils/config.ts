const REQUIRED_VARS = ["DATABASE_URL", "SOLANA_CLUSTER", "X402_WEBHOOK_SECRET"] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

export interface AppConfig {
  port: number;
  databaseUrl: string;
  solanaCluster: string;
  x402Secret: string;
}

function ensureEnv(name: RequiredVar) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  for (const key of REQUIRED_VARS) {
    ensureEnv(key);
  }

  return {
    port: Number(process.env.PORT ?? 3001),
    databaseUrl: process.env.DATABASE_URL!,
    solanaCluster: process.env.SOLANA_CLUSTER ?? "devnet",
    x402Secret: process.env.X402_WEBHOOK_SECRET!
  };
}


