# GAPI Website Styling Guide

## Design System Overview

This guide outlines the consistent styling approach for the GAPI website, ensuring visual harmony and brand consistency across all pages.

## Color Palette

### Primary Colors
- **Red**: `#d33b41` - Primary brand color for CTAs and highlights
- **Gold**: `#D4AF37` - Accent color for special elements
- **Purple**: `#9B59B6` - Secondary accent color

### Neutral Colors
- **Neutral Light**: `#F5F5DC` - Light background and borders
- **Neutral Default**: `#CFCFCF` - Default neutral color
- **Neutral Dark**: `#2D1810` - Primary text color

### Brand Colors
- **Brand Cream**: `#FBFBF0` - Yellow tint background for main brand pages

## Background Strategy

### 1. Brand Pages (Yellow Tint Background)
**Use `bg-brand-cream` for:**
- Home page (`/home`)
- Events page (`/events`)
- UnderConstruction page (`/`)

**Rationale:** These are the main brand pages that should have the distinctive yellow tint to reinforce GAPI identity.

### 2. Content Pages (White Theme)
**Use `bg-gray-50` for:**
- About page (`/about`)
- Contact page (`/contact`)
- News page (`/news`)
- Clinic page (`/clinic`)
- All authentication pages

**Rationale:** Content-heavy pages benefit from clean, readable white backgrounds with subtle gray contrast.

### 3. Special Pages (Unique Styling)
**StudentsResidents page:** Maintains its unique white-to-gray gradient for visual interest.

## Typography

### Headings
- **H1**: `text-4xl font-bold text-neutral-dark` - Page titles
- **H2**: `text-2xl font-bold text-neutral-dark` - Section headers
- **H3**: `text-lg font-semibold text-neutral-dark` - Subsection headers

### Body Text
- **Primary**: `text-neutral-dark/80` - Main content
- **Secondary**: `text-neutral-dark/70` - Supporting text
- **Muted**: `text-neutral-dark/50` - Less important information

## Component Styling

### Cards
```tsx
// Standard card styling
<div className="bg-white rounded-lg shadow-sm border border-neutral-light p-6">
  {/* Card content */}
</div>
```

### Buttons
```tsx
// Primary button
<button className="bg-red text-white font-semibold rounded-lg hover:bg-neutral-dark transition-colors">
  Button Text
</button>

// Secondary button
<button className="border border-red text-red font-semibold rounded-lg hover:bg-red hover:text-white transition-colors">
  Button Text
</button>
```

### Form Elements
```tsx
// Input fields
<input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red" />

// Labels
<label className="block text-sm font-medium text-gray-700 mb-2">
  Label Text
</label>
```

## Spacing & Layout

### Page Structure
```tsx
// Standard page wrapper
<div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
  <div className="max-w-4xl mx-auto">
    {/* Page content */}
  </div>
</div>
```

### Section Spacing
- **Page header**: `mb-12` (48px)
- **Section spacing**: `mb-8` (32px)
- **Card spacing**: `mb-6` (24px)
- **Element spacing**: `mb-4` (16px)

## Responsive Design

### Breakpoints
- **Mobile**: Default (320px+)
- **Small**: `sm:` (640px+)
- **Medium**: `md:` (768px+)
- **Large**: `lg:` (1024px+)
- **Extra Large**: `xl:` (1280px+)

### Grid Layouts
```tsx
// Responsive grid
<div className="grid gap-8 lg:grid-cols-3">
  <div className="lg:col-span-2">
    {/* Main content */}
  </div>
  <div>
    {/* Sidebar */}
  </div>
</div>
```

## Accessibility

### Color Contrast
- Ensure sufficient contrast between text and background colors
- Use opacity modifiers (e.g., `text-neutral-dark/80`) for proper contrast

### Focus States
- All interactive elements should have visible focus states
- Use `focus:ring-2 focus:ring-red/50` for consistent focus styling

### Reduced Motion
- Respect user preferences with `@media (prefers-reduced-motion: reduce)`
- Provide alternative animations or static states

## Best Practices

### 1. Use Custom Tailwind Classes
- Prefer `bg-brand-cream` over `bg-[#FBFBF0]`
- Use `text-neutral-dark` instead of `text-gray-900`

### 2. Consistent Border Styling
- Use `border-neutral-light` for standard borders
- Use `border-neutral-light/50` for subtle borders

### 3. Shadow Consistency
- **Cards**: `shadow-sm` for subtle elevation
- **Modals**: `shadow-lg` for prominent elements
- **Hero sections**: `shadow-2xl` for maximum impact

### 4. Hover States
- Always include hover states for interactive elements
- Use consistent transition timing: `transition-colors` or `transition-all duration-300`

## Implementation Checklist

When creating or updating a page:

- [ ] Choose appropriate background color based on page type
- [ ] Use consistent typography hierarchy
- [ ] Apply standard spacing patterns
- [ ] Include proper hover and focus states
- [ ] Test responsive behavior
- [ ] Verify accessibility compliance
- [ ] Use custom Tailwind classes instead of hardcoded values

## Examples

### Brand Page (Home/Events)
```tsx
// Background handled by App.tsx wrapper
<div className="min-h-screen">
  {/* Page content with white cards on brand-cream background */}
</div>
```

### Content Page (About/Contact)
```tsx
<div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
  <div className="max-w-4xl mx-auto">
    <div className="bg-white rounded-lg shadow-lg p-8 border border-neutral-light">
      {/* Content */}
    </div>
  </div>
</div>
```

This guide ensures consistent, maintainable, and accessible styling across the GAPI website.
