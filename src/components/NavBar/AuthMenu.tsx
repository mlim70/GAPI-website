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
            className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
  );
} 