import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function GET(_request: Request, context: { params: { did: string } }) {
  const { did } = context.params;
  const target = `${BACKEND_URL.replace(/\/$/, "")}/api/reputation/${encodeURIComponent(did)}`;
  const response = await fetch(target, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

