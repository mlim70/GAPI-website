// frontend/src/components/NavBar/HamburgerMenu.tsx
interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

export default function HamburgerMenu({ isOpen, onClick, className = "" }: HamburgerMenuProps) {
  return (
    <div className={`three-col ${className}`}>
      <div 
        className={[
          "hamburger",
          isOpen ? "is-active" : "",
        ].join(" ")}
        onClick={onClick}
      >
        <span className="line"></span>
        <span className="line"></span>
        <span className="line"></span>
      </div>
    </div>
  );
} 
