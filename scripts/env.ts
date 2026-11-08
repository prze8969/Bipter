/* Shared helpers for node scripts: load .env.local, read keypairs, update .env.local in place. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export const ENV_FILE = ".env.local";

export function loadEnv() {
  if (!existsSync(ENV_FILE)) throw new Error(`${ENV_FILE} not found. cp .env.example .env.local`);
  process.loadEnvFile(ENV_FILE);
}

export function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is empty in ${ENV_FILE}`);
  return v;
}

export function keypair(name: string): Keypair {
  const v = need(name);
  return Keypair.fromSecretKey(v.startsWith("[") ? Uint8Array.from(JSON.parse(v)) : bs58.decode(v));
}

export function setEnv(name: string, value: string) {
  const src = readFileSync(ENV_FILE, "utf8");
  const re = new RegExp(`^${name}=.*$`, "m");
  const next = re.test(src) ? src.replace(re, `${name}=${value}`) : `${src.trimEnd()}\n${name}=${value}\n`;
  writeFileSync(ENV_FILE, next);
  process.env[name] = value;
}
