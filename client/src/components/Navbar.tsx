import { useState } from 'react';
import { Link } from 'react-router-dom';
import gapiLogo from '../assets/gapi_logo.png';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'About GAPI', path: '/about' },
  { name: 'GAPI Clinic', path: '/clinic' },
  { name: 'News', path: '/news' },
  { name: 'Become a Member', path: '/become-a-member' },
  { name: 'Contact Us', path: '/contact' },
];

export default function Navbar() {
  // Dummy auth state
  const [loggedIn, setLoggedIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <div className="flex items-center gap-6">
        <Link to="/">
          <img src={gapiLogo} alt="Logo" className="h-10 w-10" />
        </Link>
        <ul className="flex gap-4">
          {navLinks.map((link) => (
            <li key={link.name}>
              <Link to={link.path} className="text-gray-700 hover:text-blue-600 font-medium">
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-4">
        {!loggedIn ? (
          <>
            <button className="text-blue-600 font-medium hover:underline">Login</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold shadow hover:bg-blue-700 transition">Sign Up</button>
          </>
        ) : (
          <div className="relative">
            <img
              src={`https://ui-avatars.com/api/?name=User&background=random`}
              alt="User Avatar"
              className="h-10 w-10 rounded-full cursor-pointer border-2 border-blue-600"
              onClick={() => setDropdownOpen((open) => !open)}
            />
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
                <button className="block w-full text-left px-4 py-2 hover:bg-gray-100">Profile/Account</button>
                <button className="block w-full text-left px-4 py-2 hover:bg-gray-100" onClick={() => setLoggedIn(false)}>Logout</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
} 