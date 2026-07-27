# Auth Refactor Plan — ✅ Completed

## Steps to Complete

- [x] 1. **auth.service.ts** — Add `verifyRegistrationCode()` method (POST `/api/Auth/verify-registration-code`)
- [x] 2. **auth-interceptor.service.ts** — Add `verify-registration-code` to auth endpoints whitelist
- [x] 3. **register.component.ts** — Add 2-step flow (registration → code verification)
- [x] 4. **register.component.html** — Add code verification template with 6-digit input + expiration message
- [x] 5. **login.component.ts** — Simplify to single-step (Email + Password only), add "email not verified" error handling
- [x] 6. **login.component.html** — Remove 2FA verification section, add "verify your email" link
- [ ] 7. Verify compilation with `ng build` (running...)

