// Sign in and create account forms: validation, busy state, result messages, password toggles.
// Auth calls go through src/data/mock-auth.ts until the Wix wiring plan swaps in the kit's
// member store (see the note at the top of that file). Never log or store what the shopper typed.
import { login, register, type LoginResult } from '../data/mock-auth';

export type AuthMode = 'login' | 'register';

const DEFAULT_RETURN_TO = '/account';

/** The kit's rule: only a same-site path, never a protocol-relative URL. */
export function safeReturnTo(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/** Adds ?returnTo= to an internal link when the current page was given a safe one. */
export function withReturnTo(href: string, returnTo: string | null): string {
  return returnTo ? `${href}?returnTo=${encodeURIComponent(returnTo)}` : href;
}

interface Message {
  tone: 'error' | 'info';
  text: string;
  link?: { href: string; label: string };
  /** Shown under this field instead of in the form alert. */
  fieldId?: string;
}

type Rule = (input: HTMLInputElement, form: HTMLFormElement) => string;

const emailRule: Rule = (input) => {
  if (!input.value.trim()) return 'Enter your email address.';
  if (input.validity.typeMismatch) return 'Enter a valid email address, like name@example.com.';
  return '';
};

const RULES: Record<AuthMode, Record<string, Rule>> = {
  login: {
    'login-email': emailRule,
    'login-password': (input) => (input.value ? '' : 'Enter your password.'),
  },
  register: {
    'register-first-name': (input) => (input.value.trim() ? '' : 'Enter your first name.'),
    'register-last-name': (input) => (input.value.trim() ? '' : 'Enter your last name.'),
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

function messageFor(result: LoginResult, mode: AuthMode, returnTo: string | null): Message {
  const signIn = { href: withReturnTo('/login', returnTo), label: 'Sign in' };
  const code = result.errorCode;
  switch (result.state) {
    case 'EMAIL_VERIFICATION_REQUIRED':
      return { tone: 'info', text: 'Check your email to finish creating your account.' };
    case 'OWNER_APPROVAL_REQUIRED':
      return { tone: 'info', text: 'Your account is awaiting approval.' };
  }
  if (code === 'notConnected') return { tone: 'info', text: 'Accounts open soon. Nothing was sent or saved.' };
  if (code === 'ALREADY_LOGGED_IN') return { tone: 'info', text: "You're already signed in.", link: { href: returnTo ?? DEFAULT_RETURN_TO, label: 'Continue' } };
  if (code === 'captchaRequired' || code === 'missingCaptchaToken' || code === 'invalidCaptchaToken') {
    return { tone: 'error', text: "We couldn't verify this request. Try again later." };
  }
  if (mode === 'login') {
    if (code === 'invalidPassword' || code === 'invalidCredentials' || code === 'invalidEmail') {
      return { tone: 'error', text: "That email and password don't match." };
    }
    if (code === 'resetPassword') return { tone: 'error', text: 'Reset your password to sign in.', link: { href: '/forgot-password', label: 'Forgot password' } };
  } else {
    if (code === 'emailAlreadyExists') return { tone: 'error', text: 'An account with this email already exists.', link: signIn, fieldId: 'register-email' };
    if (code === 'invalidEmail') return { tone: 'error', text: 'Use a different email address.', fieldId: 'register-email' };
    if (code === 'invalidPassword') return { tone: 'error', text: 'Choose a stronger password.', fieldId: 'register-password' };
  }
  return { tone: 'error', text: 'Something went wrong. Try again.' };
}

const NETWORK_ERROR: Message = { tone: 'error', text: "We couldn't reach Kix. Check your connection and try again." };

function fillMessage(target: HTMLElement, message: Pick<Message, 'text' | 'link'>) {
  target.replaceChildren(document.createTextNode(message.text));
  if (message.link) {
    const link = document.createElement('a');
    link.href = message.link.href;
    link.textContent = message.link.label;
    target.append(' ', link);
  }
}

export function initAuthForm(form: HTMLFormElement, mode: AuthMode) {
  const rules = RULES[mode];
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
  const alert = form.querySelector<HTMLElement>('[data-form-alert]');
  const alertMessage = form.querySelector<HTMLElement>('[data-form-alert-message]');
  const status = form.querySelector<HTMLElement>('[data-auth-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const google = form.querySelector<HTMLButtonElement>('[data-google]');
  const fields = Object.keys(rules)
    .map((id) => form.querySelector<HTMLInputElement>(`#${id}`))
    .filter((input): input is HTMLInputElement => input !== null);
  const typedIn = new Set<string>();
  // Fields showing a message from the server: kept until the shopper edits them or submits again,
  // so a link inside the message (Sign in) survives focus leaving the field.
  const serverErrors = new Set<string>();
  let busy = false;

  form.noValidate = true;
  submit?.removeAttribute('disabled');
  google?.removeAttribute('disabled');

  const errorLine = (input: HTMLInputElement) => document.getElementById(`${input.id}-error`);

  function showFieldError(input: HTMLInputElement, message: Pick<Message, 'text' | 'link'>) {
    input.setAttribute('aria-invalid', 'true');
    const line = errorLine(input);
    if (!line) return;
    fillMessage(line, message);
    line.hidden = false;
  }

  function clearFieldError(input: HTMLInputElement) {
    input.removeAttribute('aria-invalid');
    const line = errorLine(input);
    if (!line) return;
    line.hidden = true;
    line.replaceChildren();
  }

  /** Returns true when the field passes. */
  function validate(input: HTMLInputElement): boolean {
    const text = rules[input.id]?.(input, form) ?? '';
    if (text) showFieldError(input, { text });
    else clearFieldError(input);
    return !text;
  }

  function hideAlert() {
    if (!alert || !alertMessage) return;
    alert.hidden = true;
    alertMessage.replaceChildren();
  }

  function showAlert(message: Message, focus: boolean) {
    if (!alert || !alertMessage) return;
    alert.dataset.tone = message.tone;
    alert.hidden = false;
    // Empty first and fill on the next frame, so a repeated message is announced again.
    alertMessage.replaceChildren();
    requestAnimationFrame(() => {
      fillMessage(alertMessage, message);
      if (focus) alert.focus();
    });
  }

  function hidePasswords() {
    form.querySelectorAll<HTMLButtonElement>('[data-password-toggle]').forEach((toggle) => {
      const input = document.getElementById(toggle.getAttribute('aria-controls') ?? '') as HTMLInputElement | null;
      if (input) input.type = 'password';
      toggle.setAttribute('aria-pressed', 'false');
    });
  }

  const setFlag = (element: Element, name: string, on: boolean) => {
    if (on) element.setAttribute(name, 'true');
    else element.removeAttribute(name);
  };

  function setBusy(on: boolean) {
    busy = on;
    setFlag(form, 'aria-busy', on);
    form.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])').forEach((input) => { input.readOnly = on; });
    form.querySelectorAll('button[type="submit"], [data-google], input[type="checkbox"]').forEach((control) => setFlag(control, 'aria-disabled', on));
    if (submit) {
      setFlag(submit, 'aria-busy', on);
      const label = submit.querySelector<HTMLElement>('[data-button-label]');
      const text = on ? submit.dataset.busyLabel : submit.dataset.label;
      if (label && text) label.textContent = text;
      if (status) status.textContent = on && text ? text : '';
    }
  }

  form.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;
    hideAlert();
    if (!rules[input.id]) return;
    typedIn.add(input.id);
    serverErrors.delete(input.id);
    if (input.getAttribute('aria-invalid') === 'true' || input.type === 'checkbox') validate(input);
    // A new password can make a typed confirmation match or stop matching.
    if (input.id === 'register-password' && typedIn.has('register-confirm')) {
      const confirm = form.querySelector<HTMLInputElement>('#register-confirm');
      if (confirm) validate(confirm);
    }
  });

  form.addEventListener('focusout', (event) => {
    const input = event.target as HTMLInputElement;
    if (rules[input.id] && typedIn.has(input.id) && !serverErrors.has(input.id) && !busy) validate(input);
  });

  // The checkbox can't be read-only, so block toggling while a submit is in flight.
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
    box.addEventListener('click', (event) => { if (busy) event.preventDefault(); });
  });

  form.querySelectorAll<HTMLButtonElement>('[data-password-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const input = document.getElementById(toggle.getAttribute('aria-controls') ?? '') as HTMLInputElement | null;
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
    });
  });

  google?.addEventListener('click', () => {
    if (busy) return;
    showAlert({ tone: 'info', text: 'Google sign-in opens soon.' }, false);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    hideAlert();
    serverErrors.clear();
    const invalid = fields.filter((input) => !validate(input));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const value = (id: string) => form.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';
    const options = { returnTo: returnTo ?? DEFAULT_RETURN_TO };
    // Hidden before anything is sent, so a revealed password never shows while busy or navigating.
    hidePasswords();
    setBusy(true);
    let result: LoginResult;
    try {
      result = mode === 'login'
        ? await login(value('login-email').trim(), value('login-password'), options)
        : await register(
            value('register-email').trim(),
            value('register-password'),
            { firstName: value('register-first-name').trim(), lastName: value('register-last-name').trim() },
            options,
          );
    } catch {
      setBusy(false);
      showAlert(NETWORK_ERROR, true);
      return;
    }

    if (result.state === 'SUCCESS') {
      // The form stays busy while the browser navigates (the store already does when redirectUrl is set).
      if (!result.redirectUrl) location.assign(options.returnTo);
      return;
    }

    setBusy(false);
    const message = messageFor(result, mode, returnTo);
    const field = message.fieldId ? form.querySelector<HTMLInputElement>(`#${message.fieldId}`) : null;
    if (field) {
      serverErrors.add(field.id);
      showFieldError(field, message);
      field.focus();
    } else {
      showAlert(message, true);
    }
  });
}
