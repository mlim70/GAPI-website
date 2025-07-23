import { Link } from "react-router-dom";
import { mainLinks } from "../NavBar";

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
      className="ml-10 hidden gap-6 text-sm font-medium md:flex flex-1"
      role="navigation"
      aria-label="Main navigation"
    >
      {mainLinks.map((link: LinkType) => (
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
  );
} 