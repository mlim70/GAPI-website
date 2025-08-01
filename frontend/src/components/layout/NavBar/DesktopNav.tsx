// frontend/src/components/NavBar/DesktopNav.tsx
import { NavLink, useLocation } from "react-router-dom";
import DropdownNav from "./DropdownNav.js";
import { dropdownNavs } from "../NavBarComponent.js";

interface LinkType {
  label: string;
  href: string;
}

interface DesktopNavProps {
  mainLinks: LinkType[];
}

export default function DesktopNav({ mainLinks }: DesktopNavProps) {
  const location = useLocation();

  return (
    <nav
      className="hidden md:flex items-center justify-center flex-1 mx-4"
      role="navigation"
      aria-label="Main navigation"
    >
      {mainLinks.map((link, index) => {
        // Check if this link has dropdown functionality
        const dropdownKey = link.label.toLowerCase() as keyof typeof dropdownNavs;
        const dropdownConfig = dropdownNavs[dropdownKey];

        // Check if the current link is active (for non-dropdown links)
        const isLinkActive = link.href === location.pathname;

        return (
          <div key={link.label} className="flex items-center">
            {dropdownConfig ? (
              <DropdownNav
                label={dropdownConfig.label}
                href={dropdownConfig.href}
                items={dropdownConfig.items}
                isActive={isLinkActive}
              />
            ) : (
              <NavLink
                to={link.href}
                end
                className={({ isActive }) =>
                  [
                    "relative px-2 py-1.5 lg:px-4 lg:py-2 text-base lg:text-lg font-medium tracking-wide transition-colors whitespace-nowrap",
                    isActive ? "text-red" : "text-neutral-dark hover:text-red",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
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
            )}
            {index < mainLinks.length - 1 && (
              <div className="h-7 w-px bg-neutral-dark/20 mx-6"></div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
