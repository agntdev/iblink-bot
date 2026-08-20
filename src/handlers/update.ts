import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { clearFlow, getProfile, optional, saveProfile, validEmail, validPhone } from "../ib.js";

registerMainMenuItem({ label: "Update details", data: "update:open", order: 30 });
const composer = new Composer<Ctx>();
const fields = inlineKeyboard([[inlineButton("Edit company", "update:company")], [inlineButton("Edit email", "update:email")], [inlineButton("Edit phone", "update:phone")], [inlineButton("Done", "update:done")]]);
const cancel = inlineKeyboard([[inlineButton("Cancel", "update:cancel")]]);

async function openUpdate(ctx: Ctx): Promise<void> {
  const profile = await getProfile(ctx);
  if (!profile) { await ctx.reply("Register first, then you can update your contact details."); return; }
  clearFlow(ctx);
  await ctx.reply(`Company: ${profile.company ?? "Not provided"}\nEmail: ${profile.email ?? "Not provided"}\nPhone: ${profile.phone ?? "Not provided"}\n\nChoose a field to edit.`, { reply_markup: fields });
}
composer.command("update", openUpdate);
composer.callbackQuery("update:open", async (ctx) => { await ctx.answerCallbackQuery(); await openUpdate(ctx); });
composer.callbackQuery(["update:company", "update:email", "update:phone"], async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = await getProfile(ctx);
  if (!profile) { await ctx.reply("Register first, then you can update your contact details."); return; }
  const field = ctx.callbackQuery.data.slice("update:".length) as "company" | "email" | "phone";
  ctx.session.step = `update_${field}`;
  await ctx.reply(`Send your new ${field}. Send a dash to clear it.`, { reply_markup: cancel });
});
composer.callbackQuery("update:cancel", async (ctx) => { await ctx.answerCallbackQuery(); clearFlow(ctx); await ctx.reply("No changes were made.", { reply_markup: fields }); });
composer.callbackQuery("update:done", async (ctx) => { await ctx.answerCallbackQuery(); clearFlow(ctx); await ctx.reply("Your details are up to date."); });
composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  if (step !== "update_company" && step !== "update_email" && step !== "update_phone") return next();
  const profile = await getProfile(ctx);
  if (!profile) { clearFlow(ctx); await ctx.reply("Register first, then you can update your contact details."); return; }
  const field = step.replace("update_", "") as "company" | "email" | "phone";
  const value = ctx.message.text.trim() === "-" ? undefined : optional(ctx.message.text);
  if (field === "email" && value && !validEmail(value)) { await ctx.reply("That email address doesn’t look right. Check it and try again.", { reply_markup: cancel }); return; }
  if (field === "phone" && value && !validPhone(value)) { await ctx.reply("That phone number doesn’t look right. Include the country code and try again.", { reply_markup: cancel }); return; }
  profile[field] = value;
  await saveProfile(ctx, profile);
  clearFlow(ctx);
  await ctx.reply(`Your ${field} has been updated.`, { reply_markup: fields });
});
export default composer;
