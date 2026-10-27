// Placeholder member auth until the Wix wiring plan. Same signatures and result shape as the
// Headless kit's `wix/members/member-store.ts` (`login`, `register`) and `wix/members/auth.ts`
// (`LoginResult`, `LoginOptions`), so wiring changes two imports in src/scripts/auth-form.ts:
//   import { login, register } from '../wix/members/member-store';
//   import type { LoginResult } from '../wix/members/auth';
// Nothing typed here is sent, stored or logged.

/** Copied field for field from the kit's auth-core.ts. */
export type LoginState = 'SUCCESS' | 'EMAIL_VERIFICATION_REQUIRED' | 'OWNER_APPROVAL_REQUIRED' | 'FAILURE';

export interface LoginResult {
  state: LoginState;
  stateToken?: string;
  errorCode?: string;
  error?: string;
  redirectUrl?: string;
}

/** Copied from the kit's auth.ts. */
export interface LoginOptions {
  returnTo?: string;
}

const NOT_CONNECTED: LoginResult = { state: 'FAILURE', errorCode: 'notConnected' };
const DELAY_MS = 900;

const wait = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

// Dev-only addresses that exercise every result branch. `import.meta.env.DEV` is false in the
// build, so this function and its addresses are stripped from the production bundle.
function devScenario(email: string, mode: 'login' | 'register'): LoginResult | 'reject' | null {
  if (!import.meta.env.DEV) return null;
  const scenarios: Record<string, LoginResult | 'reject'> = {
    'captcha@example.com': { state: 'FAILURE', errorCode: 'captchaRequired' },
    'verify@example.com': { state: 'EMAIL_VERIFICATION_REQUIRED' },
    'pending@example.com': { state: 'OWNER_APPROVAL_REQUIRED' },
    'offline@example.com': 'reject',
    ...(mode === 'login'
      ? {
          'wrong@example.com': { state: 'FAILURE', errorCode: 'invalidPassword' },
          'reset@example.com': { state: 'FAILURE', errorCode: 'resetPassword' },
        }
      : {
          'taken@example.com': { state: 'FAILURE', errorCode: 'emailAlreadyExists' },
          'bad@example.com': { state: 'FAILURE', errorCode: 'invalidEmail' },
        }),
  };
  return scenarios[email.trim().toLowerCase()] ?? null;
}

async function respond(email: string, mode: 'login' | 'register'): Promise<LoginResult> {
  await wait();
  const scenario = devScenario(email, mode);
  if (scenario === 'reject') throw new TypeError('Failed to fetch');
  return scenario ?? NOT_CONNECTED;
}

export function login(email: string, _password: string, _options?: LoginOptions): Promise<LoginResult> {
  return respond(email, 'login');
}

export function register(
  email: string,
  _password: string,
  _profile?: { firstName?: string; lastName?: string },
  _options?: LoginOptions,
): Promise<LoginResult> {
  return respond(email, 'register');
}
