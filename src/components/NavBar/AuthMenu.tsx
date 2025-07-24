import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import type { User } from "../NavBar";

interface AuthMenuProps {
  user: User;
  logout: () => void;
}

export default function AuthMenu({ user, logout }: AuthMenuProps) {
  return (
    <Menu as="div" className="relative">
      {({ open }) => (
        <>
          <Menu.Button
            className="flex items-center gap-1 lg:gap-2 rounded-full bg-neutral-light p-1 text-xs lg:text-sm font-medium text-neutral-dark hover:bg-sand focus:outline-none focus:ring-2 focus:ring-clay focus:ring-offset-2"
            aria-expanded={open}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-neutral-dark">
                <UserIcon size={16} />
              </div>
            )}
            <ChevronDown className="h-4 w-4 text-neutral-dark" />
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
            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-sand rounded-md bg-white shadow-lg ring-1 ring-clay/20 focus:outline-none">
              <div className="px-1 py-1">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/account"
                      className={`${active ? "bg-sand text-neutral-dark" : "text-neutral-dark"} flex w-full items-center rounded-md px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm transition-colors`}
                    >
                      Account
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={logout}
                      className={`${active ? "bg-sand text-neutral-dark" : "text-neutral-dark"} flex w-full items-center gap-1.5 lg:gap-2 rounded-md px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm transition-colors`}
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
  );
} 