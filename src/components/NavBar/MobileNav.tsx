import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";

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
  const navBarHeight = "6rem"; // matches h-24 (24 * 0.25rem)

  return (
    <>
      {/* BACKDROP */}
      <div
        className={`
          fixed
          top-[5.0625rem]
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
          top-[5.0625rem]
          right-0
          w-full
          h-[calc(100vh-5.0625rem)]
          bg-neutral-light
          text-neutral-dark
          transform transition-transform ease-in-out duration-300
          md:hidden
          ${isOpen ? "translate-x-0 z-30" : "translate-x-full z-0"}
        `}
        style={{ margin: 0, padding: 0 }}
      >
        <nav
          className="flex flex-col gap-4 px-6 py-8 overflow-y-auto h-full"
          role="navigation"
          aria-label="Mobile navigation"
          style={{ margin: 0 }}
        >
          {mainLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-base font-medium text-neutral-dark hover:text-clay transition-colors active:text-clay active:bg-neutral-dark/5 rounded-md px-2 py-1"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <>
              <Link
                to="/account"
                className="mt-6 rounded-md border border-neutral-dark px-4 py-2 text-center text-base font-medium hover:bg-neutral-dark/10 transition-colors active:bg-neutral-dark/20 active:border-clay"
                onClick={() => setMobileOpen(false)}
              >
                Account
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="mt-4 flex items-center justify-center gap-2 rounded-md border border-neutral-dark px-4 py-2 text-base font-medium hover:bg-neutral-dark/10 transition-colors active:bg-neutral-dark/20 active:border-clay"
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="mt-6 rounded-md border border-neutral-dark px-4 py-2 text-center text-base font-medium hover:bg-neutral-dark/10 transition-colors active:bg-neutral-dark/20 active:border-clay"
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="mt-4 rounded-md bg-clay px-4 py-2 text-center text-base font-medium text-white hover:bg-clay/90 transition-colors active:bg-clay/70"
                onClick={() => setMobileOpen(false)}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
