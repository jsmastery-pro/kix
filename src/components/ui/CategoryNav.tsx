// Category links with Wix's product counts (plan 08). Real links, so each category is a page a
// shopper can share; the current one carries aria-current and the design's bar.
interface Item {
  label: string;
  href: string;
  count: number | null;
  current: boolean;
}

interface Props {
  label: string;
  items: Item[];
  onNavigate?: (href: string) => void;
  className?: string;
}

export default function CategoryNav({ label, items, onNavigate, className = '' }: Props) {
  return (
    <nav className={['ui-category-nav', className].filter(Boolean).join(' ')} aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} aria-current={item.current ? 'page' : undefined} onClick={() => onNavigate?.(item.href)}>
              {item.label}
              {item.count !== null && <span className="ui-category-nav__count">({item.count})</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
