import { NavLink } from "react-router-dom";

interface LinkType {
  label: string;
  href: string;
}

interface DesktopNavProps {
  mainLinks: LinkType[];
}

export default function DesktopNav({ mainLinks }: DesktopNavProps) {
  return (
    <nav
      className="ml-10 hidden flex-1 gap-8 md:flex items-center"
      role="navigation"
      aria-label="Main navigation"
    >
      {mainLinks.map((link) => (
        <NavLink
          key={link.label}
          to={link.href}
          end
          className={({ isActive }) =>
            `inline-flex items-center h-full relative group text-sm font-medium transition
             ${isActive ? 'text-clay' : 'text-neutral-dark hover:text-clay'}`
          }
        >
          {({ isActive }) => (
            <>
              {link.label}
              <span
                className={`
                  absolute left-0 -bottom-1 h-[2px] bg-clay 
                  transition-[width] duration-300
                  ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}
                `}
              />
            </>
          )}
        </NavLink>
      ))}
      {/* Call-to-Action Button */}
      <NavLink
        to="/become-a-member"
        className="inline-flex items-center h-full whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-clay"
      >
        Become a Member
      </NavLink>
    </nav>
  );
} 