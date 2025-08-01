// frontend/src/components/NavBarComponent.tsx
import { Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import gapiLogo from "../../assets/gapi_logo.png";
import DesktopNav from "./NavBar/DesktopNav.js";
import MobileNav from "./NavBar/MobileNav.js";
import AuthMenu, { User } from "./NavBar/AuthMenu.js";
import HamburgerMenu from "./NavBar/HamburgerMenu.js";

export interface NavBarProps {
  user: User | null;
  logout: () => void;
}

export const mainLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "News", href: "/news" },
  { label: "GAPI Clinic", href: "/clinic" },
  { label: "Memberships", href: "/become-a-member" },
  { label: "Contact Us", href: "/contact" },
];

// Dropdown navigation structure
export const dropdownNavs = {
  about: {
    label: "About",
    href: "/about",
    items: [
      { label: "Our Mission", href: "/about", description: "Learn about GAPI's mission and values" },
      { label: "Executive Committee", href: "/about/executive-committee", description: "Current executive leadership team" },
      { label: "Board of Directors", href: "/about/board-directors", description: "GAPI's board of directors" },
      { label: "Board of Trustees", href: "/about/board-trustees", description: "GAPI's board of trustees" },
      { label: "GAPI Committees 2024-2025", href: "/about/committees", description: "Current committee structure and members" },
      { label: "FAQs", href: "/about/faqs", description: "Frequently asked questions about GAPI" },
      { label: "Past Presidents List", href: "/about/past-presidents", description: "Historical list of GAPI presidents" },
      { label: "Medical Students, Residents Forum", href: "/about/students-residents", description: "Forum for medical students and residents" },
      { label: "GAPI Scholarships and Awards", href: "/about/scholarships-awards", description: "Available scholarships and awards" },
    ]
  },
  news: {
    label: "News",
    href: "/news",
    items: [
      { label: "Latest News", href: "/news", description: "Recent updates and announcements" },
      { label: "Events", href: "/events", description: "Upcoming and past GAPI events" },
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
        <Link to="/" className="flex items-center gap-1 -ml-2">
          <img src={gapiLogo} alt="GAPI logo" className="max-h-full max-w-full object-contain h-16 sm:h-18 md:h-20 lg:h-18" />
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
                    "relative px-4 py-2 text-base lg:text-lg font-medium tracking-wide transition-all whitespace-nowrap rounded-md",
                    isActive 
                      ? "text-red bg-red/10" 
                      : "text-neutral-dark hover:text-red",
                  ].join(" ")
                }
              >
                Log in
              </NavLink>

              <NavLink
                to="/become-a-member"
                className={({ isActive }) =>
                  [
                    "relative px-6 py-3 text-lg font-semibold tracking-wide transition-all rounded-lg shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap",
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
