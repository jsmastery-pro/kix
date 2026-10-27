// Sign in and create account: validation, busy state, result messages, password toggles, Google,
// and the email-code step. Auth runs through the Headless kit's member store, which posts to
// @wix/astro's built-in /api/auth routes (plan 05). Never log or store what the shopper typed,
// except the names waiting in pending-profile.ts for the new member.
import { login, logout, register, verifyEmail } from '../wix/members/member-store';
import type { LoginResult } from '../wix/members/auth';
import { createFormControls, emailRule, firstNameRule, lastNameRule, NETWORK_ERROR, type Message, type Rule } from './form-controls';
import { clearPendingName, savePendingName } from './pending-profile';
import { DEFAULT_RETURN_TO, googleLoginHref, safeReturnTo, withReturnTo } from './return-to';

export type AuthMode = 'login' | 'register';

const RULES: Record<AuthMode, Record<string, Rule>> = {
  login: {
    'login-email': emailRule,
    'login-password': (input) => (input.value ? '' : 'Enter your password.'),
  },
  register: {
    'register-first-name': firstNameRule,
    'register-last-name': lastNameRule,
    'register-email': emailRule,
    'register-password': (input) => (input.value.length >= 8 ? '' : 'Use at least 8 characters.'),
    'register-confirm': (input, form) => {
      if (!input.value) return 'Confirm your password.';
      const password = form.querySelector<HTMLInputElement>('#register-password');
      return input.value === password?.value ? '' : "Passwords don't match.";
    },
    'register-terms': (input) => (input.checked ? '' : 'Agree to the Terms of Service and Privacy Policy to continue.'),
  },
};

const VERIFY_RULES: Record<string, Rule> = {
  'verify-code': (input) => (input.value.trim() ? '' : 'Enter the code from your email.'),
};

const AWAITING_APPROVAL: Message = { tone: 'info', text: "Your account is waiting for approval. You can sign in once it's approved." };

/** States after which a new member may still appear in this tab; anything else drops waiting names. */
const KEEPS_PENDING_NAME = new Set<LoginResult['state']>(['SUCCESS', 'EMAIL_VERIFICATION_REQUIRED', 'OWNER_APPROVAL_REQUIRED']);

const here = () => `${location.pathname}${location.search}`;

function messageFor(result: LoginResult, mode: AuthMode, returnTo: string | null): Message {
  const signIn = { href: withReturnTo('/login', returnTo), label: 'Sign in' };
  const code = result.errorCode;
  if (result.state === 'OWNER_APPROVAL_REQUIRED') return AWAITING_APPROVAL;
  if (code === 'ALREADY_LOGGED_IN') {
    return {
      tone: 'info',
      text: "You're already signed in.",
      link: { href: returnTo ?? DEFAULT_RETURN_TO, label: 'Continue' },
      action: { label: 'Sign out', run: () => void logout(here()) },
    };
  }
  if (code === 'captchaRequired' || code === 'missingCaptchaToken' || code === 'invalidCaptchaToken') {
    return { tone: 'error', text: "We couldn't verify this request. Try again later." };
  }
  if (mode === 'login') {
    if (code === 'invalidPassword' || code === 'invalidCredentials' || code === 'invalidEmail') {
      return { tone: 'error', text: "That email and password don't match." };
    }
    if (code === 'resetPassword') {
      return { tone: 'error', text: 'Reset your password to sign in.', link: { href: withReturnTo('/forgot-password', returnTo), label: 'Forgot password' } };
    }
  } else {
    if (code === 'emailAlreadyExists') return { tone: 'error', text: 'An account with this email already exists.', link: signIn, fieldId: 'register-email' };
    if (code === 'invalidEmail') return { tone: 'error', text: 'Use a different email address.', fieldId: 'register-email' };
    if (code === 'invalidPassword') return { tone: 'error', text: 'Choose a stronger password.', fieldId: 'register-password' };
    if (code === 'unknown') return { tone: 'error', text: "We couldn't create your account. Check your details and try again." };
    // Wix's guide: registration may have created the account before the failure; don't repeat signup.
    if (code === 'AUTH_SERVICE_ERROR' || code === 'INTERNAL_ERROR') {
      return { tone: 'error', text: 'Something went wrong. Your account may already exist, so try signing in.', link: signIn };
    }
  }
  return { tone: 'error', text: 'Something went wrong. Try again.' };
}

export function initAuthForm(form: HTMLFormElement, mode: AuthMode) {
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnTo(params.get('returnTo'), location.origin);
  const destination = returnTo ?? DEFAULT_RETURN_TO;
  const controls = createFormControls(form, RULES[mode]);
  const google = form.querySelector<HTMLButtonElement>('[data-google]');
  const card = form.closest('.ui-form-card');
  const title = card?.querySelector<HTMLElement>('[data-form-card-title]') ?? null;
  const cardTitle = title?.textContent ?? '';
  const verifyForm = card?.querySelector<HTMLFormElement>('[data-auth-verify]') ?? null;
  const verify = verifyForm ? createFormControls(verifyForm, VERIFY_RULES) : null;
  const emailId = mode === 'login' ? 'login-email' : 'register-email';

  google?.removeAttribute('disabled');

  function hidePasswords() {
    form.querySelectorAll<HTMLButtonElement>('[data-password-toggle]').forEach((toggle) => {
      const input = document.getElementById(toggle.getAttribute('aria-controls') ?? '') as HTMLInputElement | null;
      if (input) input.type = 'password';
      toggle.setAttribute('aria-pressed', 'false');
    });
  }

  form.querySelectorAll<HTMLButtonElement>('[data-password-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const input = document.getElementById(toggle.getAttribute('aria-controls') ?? '') as HTMLInputElement | null;
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
    });
  });

  // ---- the email-code step --------------------------------------------------------------------

  function showVerifyStep(email: string) {
    if (!verifyForm || !verify) return;
    const target = verifyForm.querySelector<HTMLElement>('[data-verify-email]');
    if (target) target.textContent = email;
    form.hidden = true;
    verifyForm.hidden = false;
    if (title) {
      title.textContent = 'Check your email';
      title.focus();
    }
  }

  function startOver() {
    if (!verifyForm || !verify) return;
    clearPendingName();
    verify.hideAlert();
    const code = verify.input('verify-code');
    if (code) verify.resetField(code);
    verifyForm.hidden = true;
    form.hidden = false;
    if (title) title.textContent = cardTitle;
    hidePasswords();
    form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => controls.resetField(input));
    controls.input(emailId)?.focus();
  }

  const restart = { label: 'Start over', run: startOver };

  verifyForm?.querySelector('[data-verify-restart]')?.addEventListener('click', startOver);

  verifyForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!verify || verify.isBusy()) return;
    verify.hideAlert();
    if (!verify.validateAll()) return;
    verify.setBusy(true);
    let result: LoginResult;
    try {
      result = await verifyEmail(verify.value('verify-code').trim());
    } catch {
      verify.setBusy(false);
      verify.showAlert(NETWORK_ERROR, true);
      return;
    }
    if (result.state === 'SUCCESS') return; // The store is navigating through Wix to returnTo.
    verify.setBusy(false);
    const code = verify.input('verify-code');
    if (result.state === 'EMAIL_VERIFICATION_REQUIRED' && code) {
      verify.resetField(code);
      verify.showResult({ tone: 'error', text: 'Enter the new code from your email.', fieldId: 'verify-code' });
    } else if (result.state === 'OWNER_APPROVAL_REQUIRED') {
      verify.showAlert(AWAITING_APPROVAL, true);
    } else if (result.errorCode === 'VERIFICATION_FAILED') {
      verify.showResult({ tone: 'error', text: "That code didn't work. Check it, or start over to get a new one.", fieldId: 'verify-code' });
    } else if (result.errorCode === 'VERIFICATION_STATE_EXPIRED') {
      verify.showAlert({ tone: 'error', text: 'This code expired. Start over to get a new one.', action: restart }, true);
    } else {
      verify.showAlert({ tone: 'error', text: 'Something went wrong. Try again, or start over.', action: restart }, true);
    }
  });

  // ---- Google ------------------------------------------------------------------------------------

  google?.addEventListener('click', () => {
    if (controls.isBusy()) return;
    if (mode === 'register') {
      const terms = controls.input('register-terms');
      if (terms && !controls.validate(terms)) {
        terms.focus();
        return;
      }
    }
    clearPendingName();
    controls.setBusy(true);
    location.assign(googleLoginHref(destination));
  });

  // ---- submit ------------------------------------------------------------------------------------

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (controls.isBusy()) return;
    controls.hideAlert();
    if (!controls.validateAll()) return;

    const email = controls.value(emailId).trim();
    const options = { returnTo: destination };
    // Hidden before anything is sent, so a revealed password never shows while busy or navigating.
    hidePasswords();
    controls.setBusy(true);
    let result: LoginResult;
    try {
      if (mode === 'login') {
        clearPendingName();
        result = await login(email, controls.value('login-password'), options);
      } else {
        const name = { firstName: controls.value('register-first-name').trim(), lastName: controls.value('register-last-name').trim() };
        savePendingName(email, name);
        result = await register(email, controls.value('register-password'), name, options);
        if (!KEEPS_PENDING_NAME.has(result.state)) clearPendingName();
      }
    } catch {
      if (mode === 'register') clearPendingName();
      controls.setBusy(false);
      controls.showAlert(NETWORK_ERROR, true);
      return;
    }

    if (result.state === 'SUCCESS') {
      // The form stays busy while the browser navigates (the store already does when redirectUrl is set).
      if (!result.redirectUrl) location.assign(destination);
      return;
    }

    controls.setBusy(false);
    if (result.state === 'EMAIL_VERIFICATION_REQUIRED') {
      showVerifyStep(email);
      return;
    }
    controls.showResult(messageFor(result, mode, returnTo));
  });

  // ---- arrival notices ---------------------------------------------------------------------------

  if (mode === 'login' && params.get('reset') === 'done') {
    controls.showAlert({ tone: 'info', text: 'Password changed. Sign in with your new password.' }, false);
  }
  // Dev only (stripped from the build): open the code step without calling Wix, for layout checks.
  if (import.meta.env.DEV && params.get('preview') === 'verify') showVerifyStep('preview@example.com');
}
