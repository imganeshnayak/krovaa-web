# Color Theme Usage Guide

## Overview
The Krovaa website now uses a centralized color theme system. All colors are defined in a single source of truth and accessible throughout the application.

---

## Color System

### Primary Colors
- **Primary Blue**: `#0066FF` - Main brand color
- **Secondary Green**: `#00B341` - Success and secondary actions
- **Accent Orange**: `#FF6B35` - Highlights and warnings

### Status Colors
- **Success**: `#00B341` (Green)
- **Warning**: `#FFA500` (Amber)
- **Error**: `#E63946` (Red)
- **Info**: `#0066FF` (Blue)

### Neutral Grays
- **White**: `#FFFFFF`
- **Black**: `#000000`
- Gradient levels: `50, 100, 200, 300, 400, 500, 600, 700, 800, 900`
  - 50 (`#F8F9FA`) - Lightest
  - 900 (`#212529`) - Darkest

---

## How to Use Colors in Components

### 1. **In React/TypeScript Files**

#### Import the theme colors:
```typescript
import { themeColors } from "@/lib/themeColors";
```

#### Use in component:
```typescript
// State
const [color, setColor] = useState(themeColors.blue.primary);

// Style object
<div style={{ background: themeColors.success, color: themeColors.white }} />

// Conditional styling
backgroundColor: isSent ? themeColors.blue.primary : themeColors.neutral[800]
```

### 2. **In Tailwind CSS Classes**

Use the new brand color utilities:
```jsx
// Brand colors
className="bg-brand-blue text-brand-green border border-brand-orange"

// Status colors
className="text-success bg-warning/10 border border-error"

// Neutral grays
className="bg-neutral-50 text-neutral-900"

// With opacity
className="bg-brand-blue/20 hover:bg-brand-blue/30"
```

### 3. **In CSS Variables**

Access via CSS custom properties:
```css
/* In CSS files */
background-color: var(--brand-blue);
border-color: var(--brand-green);
color: var(--status-error);
```

---

## Color Variations

Each primary color has light and dark variations:

```typescript
themeColors.blue.primary      // #0066FF
themeColors.blue.light        // #4D94FF (30% lighter)
themeColors.blue.lighter      // #99C2FF (60% lighter)
themeColors.blue.dark         // #0052CC (20% darker)
themeColors.blue.darker       // #003D99 (40% darker)

// Same for green and orange
themeColors.green.[primary, light, lighter, dark, darker]
themeColors.orange.[primary, light, lighter, dark, darker]
```

---

## Helper Functions

### RGB Conversion
```typescript
import { getRGBValues } from "@/lib/themeColors";

const rgb = getRGBValues(themeColors.blue.primary);
// { r: 0, g: 102, b: 255 }
```

### HSL Conversion
```typescript
import { getHSLValues } from "@/lib/themeColors";

const hsl = getHSLValues(themeColors.blue.primary);
// { h: 217, s: 100, l: 50 }
```

### RGBA String
```typescript
import { hexToRgba } from "@/lib/themeColors";

const rgba = hexToRgba(themeColors.blue.primary, 0.5);
// "rgba(0, 102, 255, 0.5)"
```

---

## Common Use Cases

### 1. **Button Primary**
```jsx
<button style={{ 
  background: themeColors.blue.primary,
  color: themeColors.white
}}>
  Click Me
</button>
```

### 2. **Status Badge**
```jsx
<span style={{
  background: status === 'success' ? themeColors.success : themeColors.error,
  color: themeColors.white
}}>
  {status}
</span>
```

### 3. **Card with Border**
```jsx
<div style={{
  background: themeColors.neutral[900],
  border: `1px solid ${themeColors.neutral[700]}`,
  borderLeft: `3px solid ${themeColors.blue.primary}`
}}>
  Content
</div>
```

### 4. **Hover State**
```jsx
<div style={{
  background: themeColors.neutral[800],
  transition: 'background 0.2s'
}}
onMouseEnter={e => e.currentTarget.style.background = themeColors.blue.primary + '20'}
onMouseLeave={e => e.currentTarget.style.background = themeColors.neutral[800]}
>
  Hover me
</div>
```

### 5. **Gradient Background**
```jsx
<div style={{
  background: `linear-gradient(135deg, ${themeColors.blue.primary}, ${themeColors.blue.dark})`
}}>
  Gradient
</div>
```

---

## Migration Guide

### If you find hardcoded colors:

**Before:**
```tsx
<div style={{ backgroundColor: "#3b82f6", color: "#FFFFFF" }} />
```

**After:**
```tsx
import { themeColors } from "@/lib/themeColors";

<div style={{ 
  backgroundColor: themeColors.blue.primary, 
  color: themeColors.white 
}} />
```

---

## Files Updated with New Theme

- ✅ `lib/themeColors.ts` - Color definitions and helpers
- ✅ `tailwind.config.ts` - Tailwind color configuration
- ✅ `index.css` - CSS variables for all colors
- ✅ `pages/AdminDashboard.tsx` - Theme color palette
- ✅ `pages/ChatPage.tsx` - Message styling
- ✅ `pages/Landing.tsx` - Slide accents and grid
- ✅ `pages/Login.tsx` - Grid background and watermark
- ✅ `pages/Register.tsx` - Grid, watermark, and OTP
- ✅ `pages/ProfilePage.tsx` - Grid background
- ✅ `pages/WalletPage.tsx` - Razorpay theme

---

## Best Practices

1. **Always import from `@/lib/themeColors`** - Ensures consistency
2. **Use variations for depth** - Use `.light`, `.dark` variants for hover/focus states
3. **Maintain contrast** - Ensure sufficient color contrast for accessibility
4. **Use CSS variables in CSS** - Prefer `var(--brand-blue)` in pure CSS files
5. **Use Tailwind classes** - Prefer `className="bg-brand-blue"` over inline styles when possible

---

## Example: Complete Component

```tsx
import { themeColors } from "@/lib/themeColors";

export function MyComponent() {
  return (
    <div 
      style={{
        background: themeColors.neutral[900],
        border: `1px solid ${themeColors.neutral[700]}`,
        borderRadius: '8px',
        padding: '16px'
      }}
    >
      <h2 style={{ color: themeColors.blue.primary }}>
        Heading
      </h2>
      <p style={{ color: themeColors.neutral[200] }}>
        Subtitle text
      </p>
      <button
        className="bg-brand-blue text-white px-4 py-2 rounded hover:bg-brand-blue-dark transition-colors"
      >
        Action Button
      </button>
    </div>
  );
}
```

---

## Color Accessibility

- **Text on light backgrounds**: Use `neutral-900` or `blue-primary`
- **Text on dark backgrounds**: Use `white` or `neutral-50`
- **Borders**: Use `neutral-700` for dark mode, `neutral-300` for light
- **Shadows**: Use alpha transparency: `rgba(0, 0, 0, 0.1)`

---

## Support

If you need to add new colors or variations:
1. Update `lib/themeColors.ts`
2. Add CSS variables to `index.css`
3. Update `tailwind.config.ts` if using Tailwind
4. Document in this guide

For questions, refer to the main [Configuration Documentation](./configuration.md).
