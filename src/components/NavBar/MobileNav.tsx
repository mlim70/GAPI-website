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
}

export default function MobileNav({ mainLinks, user, logout, setMobileOpen }: MobileNavProps) {
  return (
    <div className="border-t md:hidden" id="mobile-menu">
      <nav className="flex flex-col gap-4 px-4 py-6" role="navigation" aria-label="Mobile navigation">
        {mainLinks.map((link: LinkType) => (
          <Link
            key={link.label}
            to={link.href}
            className="text-base font-medium text-gray-700 hover:text-blue-600"
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <Link
          to="/become-a-member"
          className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-center text-base font-semibold text-white"
          onClick={() => setMobileOpen(false)}
        >
          Become a Member
        </Link>
        {user ? (
          <>
            <Link
              to="/account"
              className="mt-2 rounded-md border px-4 py-2 text-center text-base font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Account
            </Link>
            <button
              onClick={() => {
                logout();
                setMobileOpen(false);
              }}
              className="mt-2 flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-base font-medium"
            >
              <LogOut size={16} /> Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="mt-2 rounded-md border px-4 py-2 text-center text-base font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="mt-2 rounded-md bg-gray-800 px-4 py-2 text-center text-base font-medium text-white"
              onClick={() => setMobileOpen(false)}
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </div>
  );
} 