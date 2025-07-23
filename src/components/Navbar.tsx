import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu as MenuIcon } from "lucide-react";
import gapiLogo from "../assets/gapi_logo.png";
import DesktopNav from "./NavBar/DesktopNav";
import MobileNav from "./NavBar/MobileNav";
import AuthMenu from "./NavBar/AuthMenu";

export interface User {
  name: string;
  photoURL?: string;
}

export interface NavBarProps {
  user: any;
  logout: () => void;
}

export const mainLinks = [
  { label: "About", href: "/about" },
  { label: "GAPI Clinic", href: "/clinic" },
  { label: "News", href: "/news" },
  { label: "Contact Us", href: "/contact" },
];

export default function NavBar({ user, logout }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div className="flex h-16 items-center px-6 lg:px-12 w-full">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 text-lg font-bold">
          <img src={gapiLogo} alt="GAPI logo" className="h-10 w-auto" />
        </Link>
        {/* Desktop nav + auth */}
        <div className="flex flex-1 items-center">
          <DesktopNav mainLinks={mainLinks} />
          <div className="ml-6 hidden items-center space-x-4 md:flex">
            {user ? (
              <AuthMenu user={user} logout={logout} />
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:underline">
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Mobile menu toggle */}
        <button
          className="ml-4 flex md:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((p) => !p)}
        >
          <MenuIcon className="h-6 w-6 text-gray-600" />
        </button>
      </div>
      {mobileOpen && (
        <MobileNav
          mainLinks={mainLinks}
          user={user}
          logout={logout}
          setMobileOpen={setMobileOpen}
        />
      )}
    </header>
  );
} 