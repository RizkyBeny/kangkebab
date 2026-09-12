# KangKebab POS — Security Audit Report

**Date:** 12 September 2026
**Scope:** Static, code-level security audit of all source, API routes, services, Prisma schema, seed data, and config at commit `8a083a0`.
**Stack:** Next.js 16.3.3 (App Router) · TypeScript · Prisma + PostgreSQL (Supabase) · SSE · shadcn/Tailwind.
**Method:** Static analysis only. Dynamic pentest was deferred by owner decision (see §8).

---

## 1. Executive summary

The application has **no server-side authentication or authorization layer**. Security is implemented as client-side UI gating plus a plaintext-password login that runs entirely in the browser. Every API endpoint is fully accessible to unauthenticated callers, including endpoints that expose all user passwords, consolidated financials, cross-branch inventory, and gross margins. Privilege escalation and cross-branch data manipulation are trivial.

**Verdict: Not safe for production or for storing real business data.** Two critical, four high-severity issues found; all stem from a single architectural decision (client-side auth) rather than isolated bugs.

---

## 2. Finding severity summary

| # | Severity | Finding | CWE |
|---|----------|---------|-----|
| F1 | Critical | Plaintext passwords + client-side authentication + public user/password dump | CWE-798 / A07 |
| F2 | Critical | No server-side authorization on any API route; all data open to anonymous callers | CWE-306 / A01 |
| F3 | Critical | IDOR: cross-branch & cross-user writes with client-supplied IDs | CWE-639 / CWE-862 |
| F4 | High | Privilege escalation via editable localStorage session | CWE-287 |
| F5 | High | No input validation / business-logic abuse (negative stock, arbitrary pricing) | CWE-20 |
| F6 | High | Forgeable audit attribution (`userId`/`userName` from request) | CWE-345 |
| F7 | Medium | Brute-force, hardcoded demo credentials exposed in UI | CWE-307 |
| F8 | Medium | Unauthenticated SSE stream leaks business events | CWE-200 |
| F9 | Medium | Missing security headers (CSP, X-Frame-Options, HSTS, nosniff) | CWE-693 |
| F10 | Medium | Live production DB credentials in plaintext flat file | CWE-522 |
| F11 | Low | Error messages leak internal details to clients | CWE-209 |
| F12 | Low | Dependency vulnerability: `qs` (moderate, DoS) | GHSA-x5fp-wj9c-mxmx |

**Positives:** Prisma parameterized queries throughout (no SQLi seen); audit trail model exists; atomic invoice numbering and database-transaction stock updates in `posService`; no `dangerouslySetInnerHTML`/`eval` (React escaping protects against stored/reflected XSS); `.env` correctly gitignored.

---

## 3. Critical findings

### F1 — Plaintext passwords & client-side "authentication" (CWE-798, A07)

- Login flow runs **entirely in the browser**. `AuthProvider.tsx:36-52` calls `GET /api/auth`, receives the full user list **including plaintext `password`**, then matches `u.email` + `u.password === pass` client-side.
- The schema stores passwords in plaintext: `password String` (`schema.prisma:31`); seed uses `'admin123'`/`'staff123'` (`seed.ts:41,52`).
- `GET /api/auth` (`api/auth/route.ts:6-13`) returns **every user and every password** to anyone: `GET /api/auth → {"data":{"users":[{...,"password":"admin123",...}]}}`.
- The authenticated session is a JSON blob of the user (including `role`, `branchId`) in **localStorage** (`AuthProvider.tsx:48-49`).

**Impact:** Account + password dump of all staff in one request; full account takeover; complete loss of confidentiality/integrity.

### F2 — Missing authorization on every API route (CWE-306, A01)

No route checks identity, role, or branch scope. All handlers take data directly from request params/body and serve or mutate unrestricted:

- `/api/analytics` → consolidated revenue, **cost of goods, and gross margin** for all branches (`analyticsService.ts:4-184`).
- `/api/inventory` (+`branchId`) → all branches' stock incl. damaged-goods values.
- `/api/pos` GET → all sales transactions with item-level `costPrice`.
- `/api/shipments`, `/api/products` → all master data incl. `costPrice` and per-channel margins.
- Writes (`POST/PUT/PATCH/DELETE` on products, shipments, pos, inventory) accept any payload without a session (`products/route.ts:14-49`, `shipments/route.ts:17-46`, `pos/route.ts:21-56`, `inventory/route.ts:22-31`).

The role gating in `page.tsx:112-134` and the `branchId` filter injected by `useDashboardData.ts:22-24` are **only client-side conveniences** — falsifiable by anyone, and meaningless when the API itself is open.

### F3 — IDOR / tenancy break: cross-branch writes with client-supplied IDs (CWE-639/862)

All identifiers (`branchId`, `masterProductId`, transaction/shipment/item ids) come from the request and are never checked for ownership:

- `DELETE /api/pos` with any transaction `id` + `branchId` deletes it and restores its stock (`pos/route.ts:43-56`, `posService.ts:359`).
- `PUT /api/shipments` confirms reception (`qtyDamaged`, `qtyReceived`) on any shipment, inflating any branch's inventory (`shipments/route.ts:27-36`, `shipmentService.ts:95`).
- `POST /api/pos` lets a caller create a transaction against any `branchId` / any product.
- Global inventory data crosses cabang boundaries regardless of role.

**Impact:** Total loss of role/tenancy separation (FR-13 in PRD is unimplemented server-side).

---

## 4. High findings

### F4 — Privilege escalation by editing localStorage (CWE-287)

The "session" is a JSON object the browser trusts. Editing `kangkebab_user_session.role` to `"HQ_ADMIN"` (or `branchId` to another branch) grants the full HQ UI and, since no server enforcement exists, full data access on the next request.

### F5 — No input validation → business-logic abuse (CWE-20)

- **Negative quantity:** the stock guard `inventory.qtyAvailable < cartItem.qty` (`posService.ts:88`) passes for negative `qty`; `qtyAvailable: { decrement: -999 }` then **increases stock** while booking negative revenue.
- **Arbitrary prices:** `customPrice` (line 101) and `ecommerceActualPrice` (lines 126-128, 298-300) are fully client-controlled — zero/negative totals, or inflated totals, distort revenue/margin analytics.
- **History editing without reconciliation:** `updateSalesTransaction` (lines 251-343) rewrites item qty/prices and `totalAmount` with no stock adjustment — revenue can be inflated retroactively.
- **Unvalidated enums/fields:** `channel`, `platform`, `paymentStatus`, `paymentMethod`, `customerName` accepted as-is.

### F6 — Forgeable audit logs (CWE-345)

`userId`/`userName` come from the request body/query for every write (`products/route.ts:39-40`, `posService.ts:359-364`, `shipmentService.ts`). Anyone can write audit entries as another user, defeating the audit-trail requirement (NFR Security).

---

## 5. Medium findings

- **F7 Brute force/demo creds:** no rate limiting or lockout; `admin123`/`staff123` hardcoded in seed and exposed as one-click "Demo" buttons (`login/page.tsx:126,141`). Anyone can log in as HQ admin.
- **F8 Unauthenticated SSE:** `/api/realtime/shipments` broadcasts shipment/sales events to any connected client (`realtime/shipments/route.ts`).
- **F9 No security headers:** `next.config.ts` is empty — no CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy`.
- **F10 Live prod creds in `.env`:** gitignored (good), but the current `DATABASE_URL` points at the live Supabase pooler with a reusable password; recommend env vars/secret manager + rotation (DB password also trivially tied to product name).

---

## 6. Low / informational

- **F11** Route handlers return `error.message` to clients (`auth/route.ts:13`, all routes) — leaks schema/service internals.
- **F12** `qs` (transitive) moderate severity (array-limit DoS) — fixable with `npm audit fix`.
- **F13** No login/logout audit events; no account-lockout or password-expiry; no user management API (users only via seed).
- **F14** No CSRF concern *today* (no cookie auth) — but once cookie sessions are added, `SameSite=Lax/Strict` and an Origin check on mutating routes are required.
- **F15** `formatShortDate` uses server-local timezone (`constants/index.ts:51-56`) — invoice date segments can drift from branch time; operational, not security.

---

## 7. Recommended remediation roadmap

1. **Auth core:** store `bcrypt`/scrypt hashes; `POST /api/auth/login` (server-side verify), httpOnly `SameSite=Lax` session cookie backed by a `Session` table (revocable), `/api/auth/logout`, `/api/auth/session`; delete the user-dump endpoint.
2. **Server-side authorization** (`proxy.ts` for Next 16 + per-route guards): derive identity from session only; HQ-only writes on products/shipments; scope all reads/writes/deletes to the session's branch. Drop `userId`/`userName` from request bodies.
3. **Validation** (zod): positive-int `qty`, non-negative finite `price`, enum whitelists, length caps; reject negative/hostile inputs.
4. **Session rework:** remove localStorage; restore session server-side on mount.
5. **Hardening:** login rate-limit; generic error responses; protect SSE with session; strip `password` from all responses.
6. **Config:** security headers in `next.config.ts`; remove demo buttons/creds; `AUTH_SECRET` env; rotate live DB credentials.
7. **Verify:** `lint` + typecheck + build, then re-run the pentest probe suite (§8).

---

## 8. Note on dynamic testing (deferred)

Active pentesting ("pen test" probes against a running instance) and the accompanying remediation were **canceled** by owner decision. This report is based on static analysis.

When resumed, the planned probe suite was:
1. Anonymous user/password dump (`GET /api/auth`)
2. Unauthenticated data access (analytics / inventory / pos / shipments / products)
3. Unauthenticated writes (POST/PUT/DELETE/PATCH)
4. Cross-branch IDOR (confirm/delete another branch's data)
5. Negative-qty stock inflation
6. Price tampering (`customPrice`, `ecommerceActualPrice`)
7. Forged audit attribution (`userId`/`userName`)
8. Unauthenticated SSE stream leak
9. Brute-force / demo-credential login

**Recommendation: run it against a throwaway database, never the live Supabase project.**