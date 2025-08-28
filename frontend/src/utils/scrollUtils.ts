// frontend/src/utils/scrollUtils.ts

export const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    const headerHeight = 80; // Account for fixed header
    const offset = 20; // Additional offset
    const elementPosition = element.offsetTop - headerHeight - offset;
    
    window.scrollTo({
      top: elementPosition,
      behavior: 'smooth'
    });
  }
}; 