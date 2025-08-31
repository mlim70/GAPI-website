// frontend/src/components/NavBarComponent.tsx
import { Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import gapiLogo from "../../../assets/gapi-logo.png";
import DesktopNav from "./DesktopNav.js";
import MobileNav from "./MobileNav.js";
import AuthMenu, { User } from "./AuthMenu.js";
import HamburgerMenu from "./HamburgerMenu.js";

export interface NavBarProps {
  user: User | null;
  logout: () => void;
}

export const mainLinks = [
  { label: "Home", href: "/home" },
  { label: "Events", href: "/events" },
  { label: "About", href: "/about" },
  { label: "GAPI Clinic", href: "/clinic" },
  { label: "Memberships", href: "/become-a-member" },
  { label: "Newsletter", href: "/newsletter" },
  { label: "Contact Us", href: "/contact" },
];

// Dropdown navigation structure
export const dropdownNavs = {
  events: {
    label: "Events",
    href: "/events",
    items: [
      { label: "Events", href: "/events", description: "View all upcoming and past GAPI events" },
      { label: "News", href: "/news", description: "Latest news, updates and announcements" },
    ]
  },
  about: {
    label: "About",
    href: "/about",
    items: [
      { label: "Our Mission", href: "/about", description: "Learn about GAPI's mission and values" },
      { label: "FAQs", href: "/faqs", description: "Frequently asked questions about GAPI" },
      { label: "Executive Committee", href: "/executive-committee", description: "Current executive leadership team" },
      { label: "Board of Directors", href: "/board-directors", description: "GAPI's board of directors" },
      { label: "Board of Trustees", href: "/board-trustees", description: "GAPI's board of trustees" },
      { label: "GAPI Committees 2024-2025", href: "/committees", description: "Current committee structure and members" },
      { label: "Past Presidents List", href: "/past-presidents", description: "Historical list of GAPI presidents" },
      { label: "Medical Students, Residents Forum", href: "/students-residents", description: "Forum for medical students and residents" },
      { label: "GAPI Scholarships and Awards", href: "/scholarships-awards", description: "Available scholarships and awards" },
    ]
  }
};

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
    <header className="fixed top-0 z-50 w-full border-b border-sand bg-white shadow-sm">
      <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-1 -ml-4">
          <img src={gapiLogo} alt="GAPI logo" className="max-h-full max-w-84 object-contain h-16 sm:h-18 md:h-20 lg:h-18" />
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
                to="/auth/login"
                className={({ isActive }) =>
                  [
                    "relative py-1.5 text-base lg:text-lg font-medium tracking-wide transition-all whitespace-nowrap rounded-md",
                    isActive 
                      ? "text-red" 
                      : "text-neutral-dark hover:text-red",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    Log in
                    {/* animated underline */}
                    <span
                      className={[
                        "absolute left-0 -bottom-1 h-0.5 bg-red transition-[width] duration-300",
                        isActive ? "w-full" : "w-0 group-hover:w-full",
                      ].join(" ")}
                    />
                  </>
                )}
              </NavLink>

              <NavLink
                to="/become-a-member"
                className={({ isActive }) =>
                  [
                    "relative px-3 py-2 text-lg font-semibold tracking-wide transition-all rounded-lg shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap",
                    isActive 
                      ? "text-white bg-red shadow-lg" 
                      : "text-white bg-red hover:bg-red/90",
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
