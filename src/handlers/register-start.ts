import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { beginRegistration } from "./register.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Register", data: "register:start", order: 10 });

const composer = new Composer<Ctx>();
composer.callbackQuery("register:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  await beginRegistration(ctx);
});
export default composer;
