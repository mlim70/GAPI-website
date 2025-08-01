import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

interface DropdownItem {
  label: string;
  href: string;
  description?: string;
}

interface DropdownNavProps {
  label: string;
  href: string;
  items: DropdownItem[];
  isActive: boolean;
}

export default function DropdownNav({ label, href, items, isActive }: DropdownNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Check if dropdown matches current tab
  const isAnyChildActive = items.some(item => {
    if (item.href === location.pathname) return true;
    // For parent routes
    if (item.href !== '/' && location.pathname.startsWith(item.href)) return true;
    return false;
  });

  // Check of tab is active
  const isDropdownActive = isActive || isAnyChildActive;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div 
      ref={dropdownRef}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <NavLink
        to={href}
        className={({ isActive }) =>
          [
            "relative px-2 py-1.5 lg:px-4 lg:py-2 text-base lg:text-lg font-medium tracking-wide transition-colors whitespace-nowrap flex items-center gap-1",
            isDropdownActive ? "text-clay" : "text-neutral-dark hover:text-clay",
          ].join(" ")
        }
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        {/* animated underline */}
        <span
          className={[
            "absolute left-0 -bottom-1 h-0.5 bg-clay transition-[width] duration-300",
            isDropdownActive ? "w-full" : "w-0 group-hover:w-full",
          ].join(" ")}
        />
      </NavLink>

      {/* Invisible bridge to prevent dropdown from closing */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full h-2 bg-transparent" />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-neutral-light py-1 z-50">
          {items.map((item, index) => {
            const isItemActive = item.href === location.pathname || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`block px-4 py-2 text-sm transition-colors ${
                  isItemActive 
                    ? 'bg-clay/10 text-clay font-medium' 
                    : 'text-neutral-dark hover:bg-neutral-light/30'
                } ${
                  index < items.length - 1 ? 'border-b border-neutral-dark/10' : ''
                }`}
                onClick={() => setIsOpen(false)}
              >
                <div className={`${isItemActive ? 'text-clay' : 'text-neutral-dark'}`}>{item.label}</div>
                {item.description && (
                  <div className={`text-xs mt-1 ${isItemActive ? 'text-clay/70' : 'text-neutral-dark/60'}`}>{item.description}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
} 