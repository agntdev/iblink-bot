import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner, type OwnerAwareCtx } from "../toolkit/index.js";
import { deleteProfile, getProfile, linkageLabel, listProfiles } from "../ib.js";

registerMainMenuItem({ label: "Status", data: "status:show", order: 20 });
registerMainMenuItem({ label: "Manage IBs", data: "ib:desk", order: 40 });
const composer = new Composer<Ctx>();

async function showStatus(ctx: Ctx): Promise<void> {
  const profile = await getProfile(ctx);
  if (!profile) { await ctx.reply("No registration yet — tap Register to link your MT5 account."); return; }
  await ctx.reply(`Your MT5 account: ${profile.mt5AccountId}\nLinkage: ${linkageLabel(profile.linkageStatus)}\nCompany: ${profile.company ?? "Not provided"}\nEmail: ${profile.email ?? "Not provided"}\nPhone: ${profile.phone ?? "Not provided"}`, { reply_markup: inlineKeyboard([[inlineButton("Update details", "update:open")]]) });
}

composer.command("status", showStatus);
composer.callbackQuery("status:show", async (ctx) => { await ctx.answerCallbackQuery(); await showStatus(ctx); });

composer.callbackQuery("ib:desk", async (ctx) => {
  if (!(await requireOwner(ctx as unknown as OwnerAwareCtx))) return;
  await ctx.answerCallbackQuery();
  const profiles = await listProfiles(ctx);
  if (profiles.length === 0) { await ctx.reply("No IB registrations yet."); return; }
  const rows = profiles.slice(0, 20).map((profile) => [inlineButton(`Remove ${profile.displayName.slice(0, 16)}`, `ib:delete:${profile.telegramId}`)]);
  await ctx.reply(`Registered IBs: ${profiles.length}\nTap a profile below to remove it.`, { reply_markup: inlineKeyboard(rows) });
});

composer.callbackQuery(/^ib:delete:(\d+)$/, async (ctx) => {
  if (!(await requireOwner(ctx as unknown as OwnerAwareCtx))) return;
  await ctx.answerCallbackQuery();
  const removed = await deleteProfile(ctx, Number(ctx.match[1]));
  await ctx.reply(removed ? "The IB profile has been removed." : "That IB profile is no longer available.");
});
export default composer;
