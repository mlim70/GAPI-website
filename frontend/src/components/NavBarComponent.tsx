// frontend/src/components/NavBarComponent.tsx
import { Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import gapiLogo from "../assets/gapi_logo.png";
import DesktopNav from "./NavBar/DesktopNav.js";
import MobileNav from "./NavBar/MobileNav.js";
import AuthMenu from "./NavBar/AuthMenu.js";
import HamburgerMenu from "./NavBar/HamburgerMenu.js";


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
  { label: "Memberships", href: "/become-a-member" },
  { label: "Contact Us", href: "/contact" },
];

export default function NavBar({ user, logout }: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-sand bg-neutral-light shadow-sm">
      <div className="flex h-20 items-center px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 -ml-2">
          <img src={gapiLogo} alt="GAPI logo" className="max-h-full max-w-full object-contain h-16 sm:h-18 md:h-20 lg:h-22" />
        </Link>

        {/* Desktop nav */}
        <DesktopNav mainLinks={mainLinks} />

        {/* Auth (desktop only) */}
        <div className="ml-auto hidden md:flex md:items-center md:gap-4">
          {user ? (
            <AuthMenu user={user} logout={logout} />
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  [
                    "relative px-3 py-2 lg:px-4 lg:py-3 text-base lg:text-lg font-semibold tracking-wide transition-all rounded-md border-2 whitespace-nowrap",
                    isActive 
                      ? "text-clay border-sand bg-sand/20" 
                      : "text-neutral-dark border-transparent hover:text-clay hover:border-sand hover:bg-sand/20",
                  ].join(" ")
                }
              >
                Log in
              </NavLink>

              <NavLink
                to="/become-a-member"
                className={({ isActive }) =>
                  [
                    "relative px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg font-bold tracking-wide transition-all rounded-lg shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap",
                    isActive 
                      ? "text-white bg-clay shadow-lg" 
                      : "text-white bg-clay hover:bg-clay/90",
                  ].join(" ")
                }
              >
                Sign up
              </NavLink>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="ml-auto md:hidden">
          <HamburgerMenu 
            isOpen={mobileOpen}
            onClick={() => setMobileOpen((p) => !p)}
          />
        </div>
      </div>

      {/* Mobile panel */}
      <MobileNav
        mainLinks={mainLinks}
        user={user}
        logout={logout}
        setMobileOpen={setMobileOpen}
        isOpen={mobileOpen}
      />
    </header>
  );
}
