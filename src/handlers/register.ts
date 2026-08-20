import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { clearFlow, displayName, getProfile, linkageLabel, nowIso, optional, saveProfile, validEmail, validMt5Account, validPhone } from "../ib.js";

const composer = new Composer<Ctx>();
const skip = inlineKeyboard([[inlineButton("Skip", "register:skip")], [inlineButton("Cancel", "register:cancel")]]);
const cancel = inlineKeyboard([[inlineButton("Cancel", "register:cancel")]]);

function promptCompany(ctx: Ctx) {
  ctx.session.step = "register_company";
  return ctx.reply("Add your company name, or tap Skip.", { reply_markup: skip });
}
function promptEmail(ctx: Ctx) {
  ctx.session.step = "register_email";
  return ctx.reply("Add your business email, or tap Skip.", { reply_markup: skip });
}
function promptPhone(ctx: Ctx) {
  ctx.session.step = "register_phone";
  return ctx.reply("Add your phone number, or tap Skip.", { reply_markup: skip });
}
function promptMt5(ctx: Ctx) {
  ctx.session.step = "register_mt5";
  return ctx.reply("Send your MT5 account ID.", { reply_markup: cancel });
}

export async function beginRegistration(ctx: Ctx): Promise<void> {
  if (!ctx.from) {
    await ctx.reply("I couldn’t identify your Telegram account. Open this bot in a private chat and try again.");
    return;
  }
  const existing = await getProfile(ctx);
  if (existing) {
    clearFlow(ctx);
    await ctx.reply("You’re already registered. Use Status to review your MT5 linkage or Update to change your details.");
    return;
  }
  ctx.session.draft = {};
  await promptCompany(ctx);
}

composer.command("register", beginRegistration);

composer.callbackQuery("register:skip", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.step === "register_company") { ctx.session.draft ??= {}; ctx.session.draft.company = undefined; await promptEmail(ctx); return; }
  if (ctx.session.step === "register_email") { ctx.session.draft ??= {}; ctx.session.draft.email = undefined; await promptPhone(ctx); return; }
  if (ctx.session.step === "register_phone") { ctx.session.draft ??= {}; ctx.session.draft.phone = undefined; await promptMt5(ctx); return; }
  await ctx.reply("This registration step has expired. Tap Register to begin again.");
});

composer.callbackQuery("register:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  clearFlow(ctx);
  await ctx.reply("Registration cancelled. Tap Register when you’re ready.");
});

composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (ctx.session.step === "register_company") { ctx.session.draft ??= {}; ctx.session.draft.company = optional(text); await promptEmail(ctx); return; }
  if (ctx.session.step === "register_email") {
    if (text !== "" && !validEmail(text)) { await ctx.reply("That email address doesn’t look right. Check it and try again, or tap Skip.", { reply_markup: skip }); return; }
    ctx.session.draft ??= {}; ctx.session.draft.email = optional(text); await promptPhone(ctx); return;
  }
  if (ctx.session.step === "register_phone") {
    if (text !== "" && !validPhone(text)) { await ctx.reply("That phone number doesn’t look right. Include the country code, or tap Skip.", { reply_markup: skip }); return; }
    ctx.session.draft ??= {}; ctx.session.draft.phone = optional(text); await promptMt5(ctx); return;
  }
  if (ctx.session.step !== "register_mt5") return next();
  if (!validMt5Account(text)) { await ctx.reply("MT5 account IDs use 4 to 12 digits. Check the number and try again.", { reply_markup: cancel }); return; }
  const draft = ctx.session.draft ?? {};
  const profile = { telegramId: ctx.from!.id, displayName: displayName(ctx), handle: ctx.from?.username, company: draft.company, email: draft.email, phone: draft.phone, mt5AccountId: text, registeredAt: nowIso(), linkageStatus: "pending_verification" as const };
  try {
    await saveProfile(ctx, profile);
  } catch {
    clearFlow(ctx);
    await ctx.reply("Couldn’t save your registration. Try again in a moment.");
    return;
  }
  clearFlow(ctx);
  const admin = adminChatId(ctx as unknown as { env?: Record<string, unknown> });
  if (admin) {
    try { await ctx.api.sendMessage(admin, `New IB registration\nIB: ${profile.handle ? "@" + profile.handle : profile.displayName}\nMT5 account: ${profile.mt5AccountId}\nStatus: ${linkageLabel(profile.linkageStatus)}`); } catch { /* A blocked or unavailable admin must not undo registration. */ }
  }
  const adminNote = admin ? " The admin has been notified." : " Owner notifications aren’t set up yet.";
  await ctx.reply(`Your registration is saved. ${linkageLabel(profile.linkageStatus)}.${adminNote}`, { reply_markup: inlineKeyboard([[inlineButton("View status", "status:show")], [inlineButton("Update details", "update:open")]]) });
});

export default composer;
