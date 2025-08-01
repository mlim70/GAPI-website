// frontend/src/components/NavBar/AuthMenu.tsx
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { UserIcon } from 'lucide-react';

export interface User {
  _id: string;
  email: string;
  username: string;
  name: {
    first: string;
    last: string;
  };
  avatarUrl?: string;
}

interface AuthMenuProps {
  user: User;
  logout: () => void;
}

export default function AuthMenu({ user, logout }: AuthMenuProps) {
  return (
    <Menu as="div" className="relative z-50">
      {({ open }) => (
        <>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-base font-bold text-black">
              {user.username}
            </span>
            <MenuButton
              className="flex items-center justify-center rounded-full bg-neutral-light p-2 text-xs lg:text-sm font-medium text-neutral-dark focus:outline-none transition-transform duration-150 hover:scale-102"
              aria-expanded={open}
            >
              {user.avatarUrl ? (
                <span className="flex items-center justify-center h-12 w-12 rounded-full overflow-hidden bg-sand">
                  <img
                    src={user.avatarUrl}
                    alt={`${user.name.first} ${user.name.last}`}
                    className="h-full w-full object-cover object-center"
                  />
                </span>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand text-neutral-dark">
                  <UserIcon size={28} />
                </div>
              )}
            </MenuButton>
          </div>
          
          <MenuItems className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <MenuItem>
                {({ active }) => (
                  <Link
                    to="/account"
                    className={`${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    } block w-full px-4 py-2 text-left text-sm`}
                  >
                    Account
                  </Link>
                )}
              </MenuItem>
              <MenuItem>
                {({ active }) => (
                  <button
                    onClick={logout}
                    className={`${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    } block w-full px-4 py-2 text-left text-sm`}
                  >
                    Sign out
                  </button>
                )}
              </MenuItem>
            </div>
          </MenuItems>
        </>
      )}
    </Menu>
  );
} 
