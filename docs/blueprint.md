# IB Registration Bot — Bot specification

**Archetype:** crm

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for introducing brokers (IBs) to self-register and automatically link their Telegram account to an MT5 account. Captures optional onboarding details, confirms MT5 linkage, and notifies an admin of new registrations.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- introducing brokers (IBs)
- brokers

## Success criteria

- Admin receives notification for each new IB registration
- IBs can successfully link their MT5 account via Telegram
- IBs can view and update their registration status

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Show welcome message and Register button
- **/register** (command, actor: user, command: /register) — Begin registration flow for new IBs
- **/status** (command, actor: user, command: /status) — View current registration and linkage status
- **/update** (command, actor: user, command: /update) — Edit optional profile fields
- **Register** (button, actor: user, callback: register:start) — Launch registration flow from /start menu

## Flows

### registration_flow
_Trigger:_ /register or /start + Register button

1. Show optional company field
2. Show optional email field
3. Show optional phone field
4. Request MT5 account ID
5. Attempt MT5 linkage
6. Show success/failure message to user
7. Send admin notification

_Data touched:_ IB profile

### update_flow
_Trigger:_ /update

1. Show current optional fields
2. Allow editing of company
3. Allow editing of email
4. Allow editing of phone
5. Confirm changes

_Data touched:_ IB profile

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat ID where admin receives registration notifications
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **IB profile** _(retention: persistent)_ — Registered broker profile with Telegram and MT5 linkage
  - fields: Telegram ID, display name, company (optional), email (optional), phone (optional), MT5 account ID, registration timestamp, linkage status

## Integrations

- **Telegram** (required) — Bot API messaging
- **MT5** (required) — Account linkage integration
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- ADMIN_CHAT_ID for notifications
- manual deletion of IB profiles

## Notifications

- Admin receives notification with IB Telegram handle, MT5 ID, and linkage status
- User receives confirmation of MT5 linkage success/failure

## Permissions & privacy

- Only store minimal personal data (optional fields)
- MT5 linkage attempts only using provided account ID
- No third-party data sharing

## Edge cases

- User attempts to register multiple times with same Telegram account
- Invalid MT5 account ID format
- MT5 linkage API returns error
- User skips all optional fields during registration

## Required tests

- End-to-end registration flow from /start to admin notification
- Successful MT5 linkage with valid account ID
- Error handling for invalid MT5 account ID
- Update flow for optional fields

## Assumptions

- MT5 integration uses standard defaults for linkage
- ADMIN_CHAT_ID is provided by owner
- Telegram ID uniquely identifies users
- Users know their MT5 account ID
