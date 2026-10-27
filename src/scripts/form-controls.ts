// Shared form behavior for the auth, reset and account forms: inline validation, field errors,
// the form alert, and the busy state. Extracted from plan 04's auth-form.ts. Never log or store
// what the shopper typed.

export interface Message {
  tone: 'error' | 'info';
  text: string;
  link?: { href: string; label: string };
  /** A button after the text (Start over, Sign out). */
  action?: { label: string; run: () => void };
  /** Shown under this field instead of in the form alert. */
  fieldId?: string;
}

export type Rule = (input: HTMLInputElement, form: HTMLFormElement) => string;

export const emailRule: Rule = (input) => {
  if (!input.value.trim()) return 'Enter your email address.';
  if (input.validity.typeMismatch) return 'Enter a valid email address, like name@example.com.';
  return '';
};

export const firstNameRule: Rule = (input) => (input.value.trim() ? '' : 'Enter your first name.');
export const lastNameRule: Rule = (input) => (input.value.trim() ? '' : 'Enter your last name.');

export const NETWORK_ERROR: Message = { tone: 'error', text: "We couldn't reach Kix. Check your connection and try again." };

function fillMessage(target: HTMLElement, message: Pick<Message, 'text' | 'link' | 'action'>) {
  target.replaceChildren(document.createTextNode(message.text));
  if (message.link) {
    const link = document.createElement('a');
    link.href = message.link.href;
    link.textContent = message.link.label;
    target.append(' ', link);
  }
  if (message.action) {
    const { label, run } = message.action;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-form-alert__action';
    button.textContent = label;
    button.addEventListener('click', run);
    target.append(' ', button);
  }
}

const setFlag = (element: Element, name: string, on: boolean) => {
  if (on) element.setAttribute(name, 'true');
  else element.removeAttribute(name);
};

/** Wires validation listeners on `form` and returns the controls its submit handler needs. */
export function createFormControls(form: HTMLFormElement, rules: Record<string, Rule>) {
  const alert = form.querySelector<HTMLElement>('[data-form-alert]');
  const alertMessage = form.querySelector<HTMLElement>('[data-form-alert-message]');
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const typedIn = new Set<string>();
  // Fields showing a message from the server: kept until the shopper edits them or submits again,
  // so a link inside the message (Sign in) survives focus leaving the field.
  const serverErrors = new Set<string>();
  let busy = false;

  form.noValidate = true;

  const input = (id: string) => form.querySelector<HTMLInputElement>(`#${id}`);
  const errorLine = (field: HTMLInputElement) => document.getElementById(`${field.id}-error`);

  function showFieldError(field: HTMLInputElement, message: Pick<Message, 'text' | 'link' | 'action'>) {
    field.setAttribute('aria-invalid', 'true');
    const line = errorLine(field);
    if (!line) return;
    fillMessage(line, message);
    line.hidden = false;
  }

  function clearFieldError(field: HTMLInputElement) {
    field.removeAttribute('aria-invalid');
    const line = errorLine(field);
    if (!line) return;
    line.hidden = true;
    line.replaceChildren();
  }

  /** Returns true when the field passes. */
  function validate(field: HTMLInputElement): boolean {
    const text = rules[field.id]?.(field, form) ?? '';
    if (text) showFieldError(field, { text });
    else clearFieldError(field);
    return !text;
  }

  /** Validates every ruled field that is visible; focuses the first failure. */
  function validateAll(): boolean {
    serverErrors.clear();
    const invalid = Object.keys(rules)
      .map(input)
      .filter((field): field is HTMLInputElement => field !== null && !field.closest('[hidden]'))
      .filter((field) => !validate(field));
    invalid[0]?.focus();
    return invalid.length === 0;
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

  /** A message from the server: under its field when it names one, otherwise in the alert. */
  function showResult(message: Message) {
    const field = message.fieldId ? input(message.fieldId) : null;
    if (field) {
      serverErrors.add(field.id);
      showFieldError(field, message);
      field.focus();
    } else {
      showAlert(message, true);
    }
  }

  function setBusy(on: boolean) {
    busy = on;
    setFlag(form, 'aria-busy', on);
    form.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])').forEach((field) => { field.readOnly = on; });
    form.querySelectorAll('button[type="submit"], [data-google], input[type="checkbox"]').forEach((control) => setFlag(control, 'aria-disabled', on));
    if (submit) {
      setFlag(submit, 'aria-busy', on);
      const label = submit.querySelector<HTMLElement>('[data-button-label]');
      const text = on ? submit.dataset.busyLabel : submit.dataset.label;
      if (label && text) label.textContent = text;
      if (status) status.textContent = on && text ? text : '';
    }
  }

  /** Clears a field's value, typed state and error (Start over, a new code). */
  function resetField(field: HTMLInputElement) {
    field.value = '';
    typedIn.delete(field.id);
    serverErrors.delete(field.id);
    clearFieldError(field);
  }

  form.addEventListener('input', (event) => {
    const field = event.target as HTMLInputElement;
    hideAlert();
    if (!rules[field.id]) return;
    typedIn.add(field.id);
    serverErrors.delete(field.id);
    if (field.getAttribute('aria-invalid') === 'true' || field.type === 'checkbox') validate(field);
    // A new password can make a typed confirmation match or stop matching.
    if (field.id === 'register-password' && typedIn.has('register-confirm')) {
      const confirm = input('register-confirm');
      if (confirm) validate(confirm);
    }
  });

  form.addEventListener('focusout', (event) => {
    const field = event.target as HTMLInputElement;
    if (rules[field.id] && typedIn.has(field.id) && !serverErrors.has(field.id) && !busy) validate(field);
  });

  // The checkbox can't be read-only, so block toggling while a submit is in flight.
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
    box.addEventListener('click', (event) => { if (busy) event.preventDefault(); });
  });

  // No-JS: submit buttons render disabled, so nothing can post a password anywhere without this script.
  submit?.removeAttribute('disabled');

  return {
    input,
    value: (id: string) => input(id)?.value ?? '',
    typed: (id: string) => typedIn.has(id),
    isBusy: () => busy,
    validate,
    validateAll,
    showFieldError,
    clearFieldError,
    resetField,
    showAlert,
    hideAlert,
    showResult,
    setBusy,
  };
}

export type FormControls = ReturnType<typeof createFormControls>;
