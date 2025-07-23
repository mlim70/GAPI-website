import { Fragment, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import { Menu as MenuIcon, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import gapiLogo from '../assets/gapi_logo.png';

/**
 * Dummy user auth
 */
export interface User {
  name: string;
  photoURL?: string;
}

export interface NavBarProps {
  user: User | null;
  logout: () => void;
}

/**
 * Primary site navigation bar.
 * – Desktop: Navigation bar
 * – Mobile: logo + hamburger menu
 */
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

  const mainLinks = [
    { label: "About", href: "/about" },
    { label: "GAPI Clinic", href: "/clinic" },
    { label: "News", href: "/news" },
    { label: "Contact Us", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
      <div className="flex h-24 items-center px-4 sm:px-6 lg:px-8 w-full">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 text-lg font-bold">
          <img src={gapiLogo} alt="GAPI logo" className="h-20 w-auto" />
        </Link>

        {/* Desktop nav links and auth area in flex-1 container */}
        <div className="flex flex-1 items-center">
          <nav className="ml-10 hidden gap-6 text-sm font-medium md:flex flex-1">
            {mainLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="transition-colors hover:text-blue-600"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="become-a-member"
              className="transition-colors hover:text-blue-600"
            >
              Become a Member
            </Link>
          </nav>

          {/* Auth area – desktop */}
          <div className="ml-4 hidden md:flex md:items-center justify-end">
            {user ? (
              <Menu as="div" className="relative">
                {({ open }) => (
                  <>
                    <Menu.Button
                      className="flex items-center focus:outline-none"
                      aria-expanded={open}
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                          <UserIcon size={16} />
                        </div>
                      )}
                      <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                        <div className="px-1 py-1">
                          <Menu.Item>
                            {({ active }) => (
                              <Link
                                to="/account"
                                className={`${active ? "bg-gray-100" : ""} flex w-full items-center rounded-md px-4 py-2 text-sm`}
                              >
                                Account
                              </Link>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={logout}
                                className={`${active ? "bg-gray-100" : ""} flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm`}
                              >
                                <LogOut size={14} /> Sign out
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </>
                )}
              </Menu>
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
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile hamburger menu panel */}
      {mobileOpen && (
        <div className="border-t md:hidden">
          <nav className="flex flex-col gap-4 px-4 py-6">
            {mainLinks.map((link) => (
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
      )}
    </header>
  );
}
