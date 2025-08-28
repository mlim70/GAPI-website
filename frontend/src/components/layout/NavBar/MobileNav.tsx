// frontend/src/components/NavBar/MobileNav.tsx
import { Link } from "react-router-dom";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { dropdownNavs } from "./NavBarComponent.js";

interface LinkType {
  label: string;
  href: string;
}

interface MobileNavProps {
  mainLinks: LinkType[];
  user: any | null;
  logout: () => void;
  setMobileOpen: (open: boolean) => void;
  isOpen: boolean;
}

export default function MobileNav({
  mainLinks,
  user,
  logout,
  setMobileOpen,
  isOpen,
}: MobileNavProps) {
  const [expandedDropdowns, setExpandedDropdowns] = useState<Set<string>>(new Set());

  const toggleDropdown = (dropdownKey: string) => {
    setExpandedDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dropdownKey)) {
        newSet.delete(dropdownKey);
      } else {
        newSet.add(dropdownKey);
      }
      return newSet;
    });
  };

  const closeAllDropdowns = () => {
    setExpandedDropdowns(new Set());
  };

  return (
    <>
      {/* BACKDROP */}
      <div
        className={`
          fixed
          top-[4.0625rem]
          inset-x-0
          bottom-0
          bg-neutral-light/70
          transition-opacity ease-in-out duration-300
          ${isOpen ? "opacity-100 z-30" : "opacity-0 pointer-events-none z-0"}
        `}
        onClick={() => setMobileOpen(false)}
      />

      {/* SLIDING PANEL */}
      <div
        className={`
          fixed
          top-[4.0625rem]
          right-0
          w-full
          h-[calc(100vh-4.0625rem)]
          bg-neutral-light
          text-neutral-dark
          transform transition-transform ease-in-out duration-300
          md:hidden
          ${isOpen ? "translate-x-0 z-30" : "translate-x-full z-0"}
        `}
        style={{ margin: 0, padding: 0 }}
      >
        <nav
          className="flex flex-col gap-2 px-6 py-8 overflow-y-auto h-full"
          role="navigation"
          aria-label="Mobile navigation"
          style={{ margin: 0 }}
        >
          {mainLinks.map((link) => {
            // Check if this link has dropdown functionality
            const dropdownKey = link.label.toLowerCase() as keyof typeof dropdownNavs;
            const dropdownConfig = dropdownNavs[dropdownKey];
            const isExpanded = expandedDropdowns.has(dropdownKey);

            if (dropdownConfig) {
              return (
                <div key={link.label} className="space-y-1">
                  {/* Dropdown Header */}
                  <button
                    onClick={() => toggleDropdown(dropdownKey)}
                    className="w-full flex items-center justify-between text-base font-medium text-neutral-dark hover:text-red transition-colors active:text-red active:bg-neutral-dark/5 rounded-md px-2 py-1"
                  >
                    <span>{link.label}</span>
                    <ChevronRight 
                      className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                        isExpanded ? 'rotate-90' : 'rotate-0'
                      }`} 
                    />
                  </button>
                  
                  {/* Dropdown Items with Animation */}
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isExpanded 
                        ? 'max-h-96 opacity-100' 
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="ml-4 space-y-1 border-l-2 border-red/20 pl-4 py-1">
                      {dropdownConfig.items.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          className="block text-sm text-neutral-dark/80 hover:text-red transition-colors active:text-red active:bg-neutral-dark/5 rounded-md px-2 py-1"
                          onClick={() => {
                            setMobileOpen(false);
                            closeAllDropdowns();
                          }}
                        >
                          <div className="font-medium">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-neutral-dark/60 mt-0.5">{item.description}</div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // Regular link (no dropdown)
            return (
              <Link
                key={link.label}
                to={link.href}
                className="text-base font-medium text-neutral-dark hover:text-red transition-colors active:text-red active:bg-neutral-dark/5 rounded-md px-2 py-1"
                onClick={() => {
                  setMobileOpen(false);
                  closeAllDropdowns();
                }}
              >
                {link.label}
              </Link>
            );
          })}

          {user ? (
            <>
              <Link
                to="/auth/account"
                className="text-base font-medium text-neutral-dark hover:text-red transition-colors active:text-red active:bg-neutral-dark/5 rounded-md px-2 py-1"
                onClick={() => {
                  setMobileOpen(false);
                  closeAllDropdowns();
                }}
              >
                Account
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                  closeAllDropdowns();
                }}
                className="mt-4 flex items-center justify-center gap-2 rounded-md border border-neutral-dark px-4 py-2 text-base font-medium hover:bg-neutral-dark/10 transition-colors active:bg-neutral-dark/20 active:border-red"
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth/login"
                className="mt-6 rounded-md border border-neutral-dark px-4 py-2 text-center text-base font-medium hover:bg-neutral-dark/10 transition-colors active:bg-neutral-dark/20 active:border-red"
                onClick={() => {
                  setMobileOpen(false);
                  closeAllDropdowns();
                }}
              >
                Log in
              </Link>
              <Link
                to="/become-a-member"
                className="mt-2 rounded-md bg-red px-4 py-2 text-center text-base font-medium text-white hover:bg-red/90 transition-colors active:bg-red/70"
                onClick={() => {
                  setMobileOpen(false);
                  closeAllDropdowns();
                }}
              >
                Become a Member
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
