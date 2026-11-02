// Search box with a joined dark button (plan 08). Submits on Enter or the button, never per
// keystroke; an empty submit clears the search. The text never leaves this form except as the query.
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength?: number;
  onSubmit: (text: string) => void;
  className?: string;
}

export default function SearchField({ id, label, placeholder, value, maxLength = 100, onSubmit, className = '' }: Props) {
  const [text, setText] = useState(value);
  // Follow outside changes (Clear filters, a URL adopted on load).
  useEffect(() => setText(value), [value]);
  return (
    <form
      role="search"
      className={['ui-search-field', className].filter(Boolean).join(' ')}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(text.trim());
      }}
    >
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="ui-field">
        <input id={id} name="q" type="search" placeholder={placeholder} autoComplete="off" maxLength={maxLength} value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      <button type="submit" className="ui-icon-button ui-icon-button--field ui-icon-button--dark" aria-label="Search" title="Search">
        <Search aria-hidden="true" />
      </button>
    </form>
  );
}
