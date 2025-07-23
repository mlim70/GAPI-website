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
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
      <div className="flex h-24 items-center px-4 sm:px-6 lg:px-8 w-full">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 text-lg font-bold">
          <img src={gapiLogo} alt="GAPI logo" className="h-20 w-auto" />
        </Link>

        {/* Desktop nav links and auth area in flex-1 container */}
        <div className="flex flex-1 items-center">
          <DesktopNav mainLinks={mainLinks} />

          {/* Auth area – desktop */}
          <div className="ml-4 hidden md:flex md:items-center justify-end">
            {user ? (
              <AuthMenu user={user} logout={logout} />
            ) : (
              <>
                <Link to="/login" className="text-sm hover:underline">
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="ml-3 rounded-md border px-4 py-2 text-sm font-semibold transition-colors hover:bg-gray-50"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="ml-2 flex md:hidden"
          aria-label="Toggle menu"
          aria-controls="mobile-menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile hamburger menu panel */}
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