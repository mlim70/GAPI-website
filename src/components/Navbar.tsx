import { Link, NavLink } from "react-router-dom";
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
  { label: "Become a Member", href: "/become-a-member" },
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
    <header className="sticky top-0 z-50 w-full border-b border-sand bg-neutral-light/70 backdrop-blur supports-[backdrop-filter]:bg-neutral-light/50 shadow-sm">
      <div className="flex h-20 items-center px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={gapiLogo} alt="GAPI logo" className="h-20 w-auto" />
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
                    "relative px-4 py-2 text-base font-semibold tracking-wide transition-all rounded-md border-2",
                    isActive 
                      ? "text-clay border-clay bg-clay/5" 
                      : "text-neutral-dark border-transparent hover:text-clay hover:border-sand hover:bg-sand/20",
                  ].join(" ")
                }
              >
                {({ isActive }) => "Log in"}
              </NavLink>

              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  [
                    "relative px-6 py-2 text-base font-bold tracking-wide transition-all rounded-lg shadow-md hover:shadow-lg hover:scale-105",
                    isActive 
                      ? "text-white bg-clay shadow-lg" 
                      : "text-white bg-clay hover:bg-clay/90",
                  ].join(" ")
                }
              >
                {({ isActive }) => "Sign up"}
              </NavLink>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="ml-2 flex h-10 w-10 items-center justify-center rounded-md text-neutral-dark hover:bg-sand md:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((p) => !p)}
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile panel */}
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
