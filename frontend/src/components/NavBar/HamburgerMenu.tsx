// frontend/src/components/NavBar/HamburgerMenu.tsx
interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function HamburgerMenu({ isOpen, onClick }: HamburgerMenuProps) {
  return (
    <div className="three-col">
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