import type { Ctx, Session } from "./bot.js";

export type LinkageStatus = "pending_verification" | "linkage_failed";

export interface IbProfile {
  telegramId: number;
  displayName: string;
  handle?: string;
  company?: string;
  email?: string;
  phone?: string;
  mt5AccountId: string;
  registeredAt: string;
  linkageStatus: LinkageStatus;
}

interface IbStoreEnv {
  CHAT_DO?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(input: string, init?: { method?: string; body?: string }): Promise<Response> };
  };
}

// One clock seam for timestamps. It can be replaced by an integration test
// without scattering Date construction throughout feature handlers.
let clock: () => Date = () => new Date();
export function setClock(next: () => Date): void { clock = next; }
export function nowIso(): string { return clock().toISOString(); }

function envFor(ctx: Ctx): IbStoreEnv | undefined {
  return (ctx as Ctx & { env?: IbStoreEnv }).env;
}

async function endpoint<T>(env: IbStoreEnv, name: string, path: string, init?: { method?: string; body?: string }): Promise<T | undefined> {
  const namespace = env.CHAT_DO;
  if (!namespace) return undefined;
  const response = await namespace.get(namespace.idFromName(name)).fetch(`https://do${path}`, init);
  if (response.status === 204) return undefined;
  if (!response.ok) throw new Error("Profile storage request failed");
  return (await response.json()) as T;
}

/** Durable in Workers; an isolated session-backed fallback makes tokenless dialog replay possible. */
export async function getProfile(ctx: Ctx): Promise<IbProfile | undefined> {
  const userId = ctx.from?.id;
  if (!userId) return undefined;
  const env = envFor(ctx);
  if (env?.CHAT_DO) return endpoint<IbProfile>(env, `ib:${userId}`, "/ib-profile", { method: "GET" });
  return ctx.session.harnessProfile;
}

export async function saveProfile(ctx: Ctx, profile: IbProfile): Promise<void> {
  const env = envFor(ctx);
  if (env?.CHAT_DO) {
    await endpoint(env, `ib:${profile.telegramId}`, "/ib-profile", { method: "PUT", body: JSON.stringify(profile) });
    await endpoint(env, "ib-index", "/ib-index", { method: "POST", body: JSON.stringify({ telegramId: profile.telegramId }) });
    return;
  }
  ctx.session.harnessProfile = profile;
}

export async function deleteProfile(ctx: Ctx, telegramId: number): Promise<boolean> {
  const env = envFor(ctx);
  if (!env?.CHAT_DO) {
    if (ctx.session.harnessProfile?.telegramId === telegramId) {
      ctx.session.harnessProfile = undefined;
      return true;
    }
    return false;
  }
  const found = await endpoint<IbProfile>(env, `ib:${telegramId}`, "/ib-profile", { method: "GET" });
  if (!found) return false;
  await endpoint(env, `ib:${telegramId}`, "/ib-profile", { method: "DELETE" });
  await endpoint(env, "ib-index", "/ib-index", { method: "DELETE", body: JSON.stringify({ telegramId }) });
  return true;
}

export async function listProfiles(ctx: Ctx): Promise<IbProfile[]> {
  const env = envFor(ctx);
  if (!env?.CHAT_DO) return ctx.session.harnessProfile ? [ctx.session.harnessProfile] : [];
  const ids = (await endpoint<number[]>(env, "ib-index", "/ib-index", { method: "GET" })) ?? [];
  const profiles = await Promise.all(ids.map((id) => endpoint<IbProfile>(env, `ib:${id}`, "/ib-profile", { method: "GET" })));
  return profiles.filter((profile): profile is IbProfile => profile !== undefined);
}

export function clearFlow(ctx: Ctx): void { ctx.session.step = undefined; ctx.session.draft = undefined; }

export function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function validPhone(value: string): boolean { return /^[+()\-\s\d]{6,30}$/.test(value); }
export function validMt5Account(value: string): boolean { return /^\d{4,12}$/.test(value); }

export function displayName(ctx: Ctx): string {
  const from = ctx.from;
  if (!from) return "Telegram user";
  return [from.first_name, from.last_name].filter(Boolean).join(" ") || "Telegram user";
}

export function linkageLabel(status: LinkageStatus): string {
  return status === "pending_verification" ? "Pending MT5 verification" : "MT5 linkage could not be verified";
}
