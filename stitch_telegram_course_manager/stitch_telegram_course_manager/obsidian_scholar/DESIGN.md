# Design System Strategy: The Illuminated Archive

## 1. Overview & Creative North Star
The "Illuminated Archive" is the creative north star for this design system. In the context of a course management application, we are moving away from the "data-heavy dashboard" cliché. Instead, we treat the UI as a cinematic, high-end editorial experience where knowledge is spotlighted against a deep, infinite void.

We break the "template" look through **intentional asymmetry** and **tonal depth**. Rather than placing elements into a rigid, bordered grid, we use light as our primary structural tool. High-contrast typography scales and overlapping translucent layers create a sense of physical space, making the "Gerenciador de Cursos" feel less like a tool and more like a premium learning environment.

---

## 2. Colors & Surface Architecture
Our palette uses deep monochromatic tones to create a sense of focused calm, punctuated by high-energy electric accents.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts or tonal transitions. To separate a sidebar from a main feed, use a shift from `surface` (#131313) to `surface_container_low` (#1c1b1b).

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine paper or frosted glass. 
- **Lowest Layer:** `surface_container_lowest` (#0e0e0e) for the global background.
- **Content Layer:** `surface_container` (#201f1f) for main content areas.
- **Elevated Layer:** `surface_container_high` (#2a2a2a) for interactive cards.
- **Accent Layer:** `surface_bright` (#393939) for floating elements.

### The "Glass & Gradient" Rule
To move beyond a generic "dark mode," use **Glassmorphism** for floating navigation and modals. Apply a semi-transparent `surface_variant` with a 20px backdrop-blur. 
- **Signature Gradients:** For primary CTAs, do not use flat colors. Use a subtle linear gradient from `primary` (#adc6ff) to `primary_container` (#4d8eff) at a 135-degree angle to provide a "glow" effect that mimics light hitting a surface.

---

## 3. Typography
We utilize **Inter** to achieve a clean, Swiss-inspired editorial look. 

- **Display Scales:** Use `display-lg` (3.5rem) sparingly for course titles or welcome screens. It should feel authoritative.
- **The Hierarchy Gap:** Create "Visual Breathing Room" by pairing a `headline-sm` title with a `body-sm` description. This high-contrast sizing suggests a premium, curated feel.
- **Brand Identity through Type:** All labels (`label-md`) should be set to uppercase with a +0.05em letter-spacing to provide a modern, architectural rhythm to the data.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than structural lines.

- **The Layering Principle:** Place a `surface_container_highest` card on a `surface_container_low` background to create a soft, natural lift.
- **Ambient Shadows:** When a floating effect is required (e.g., a dropdown), use extra-diffused shadows.
    - **Shadow Token:** `0px 20px 40px rgba(0, 0, 0, 0.4)`. 
    - Never use high-opacity dark shadows; they should feel like a soft ambient occlusion.
- **The "Ghost Border" Fallback:** If a border is essential for accessibility, use the `outline_variant` token at **15% opacity**. This creates a "suggestion" of a boundary rather than a hard wall.
- **Glassmorphism:** For top-tier elements (like active course progress), use `surface_tint` at 5% opacity with a blur to let the deep background colors bleed through.

---

## 5. Components

### Buttons
- **Primary:** Rounded `full` (9999px). Gradient background (`primary` to `primary_container`).
- **Success (Start Course):** Use `tertiary` (#4ae176). High-gloss finish.
- **Danger (Stop/Reset):** Use `error` (#ffb4ab). Text-only or ghost variant to prevent visual clutter unless the action is critical.
- **Interaction:** On hover, increase the brightness of the surface tint; never use a black overlay.

### Cards & Lists
- **Rule:** Forbid the use of divider lines. 
- **The List Strategy:** Use `8px` of vertical white space from our spacing scale and a `surface_container_low` background for the "Hover State" only.
- **The Card Strategy:** Use `rounded-xl` (1.5rem) and define the card through a subtle shift to `surface_container_highest`.

### Chips
- Use `rounded-full` with a `surface_variant` background. For active filters, use the `secondary_container` with `on_secondary_container` text.

### Progress Glass (Custom Component)
For course management, use a "Progress Glass" bar: A `surface_container_highest` track with a `primary` glowing fill, utilizing a subtle outer glow (drop shadow) of the same color to make the progress "illuminate" the dark UI.

---

## 6. Do's and Don'ts

### Do
- **Do** use large amounts of negative space to group items.
- **Do** use `primary_fixed_dim` for non-essential icons to keep them subtle.
- **Do** ensure all interactive elements have at least a `md` (0.75rem) corner radius to maintain the "soft-tech" aesthetic.

### Don't
- **Don't** use 100% white (#FFFFFF) for text. Use `on_surface` (#e5e2e1) to prevent eye strain in dark mode.
- **Don't** use pure black (#000000) for containers. It kills the sense of depth; always use the provided `surface` tokens.
- **Don't** use standard "drop shadows" on flat-on-flat surfaces. If the surface levels are the same, use a background color shift instead.

---

## 7. Spacing Scale
Maintain a strict 8pt grid, but prioritize **Asymmetrical Padding**. For example, a card might have 32px (xl) padding on the left and 24px (lg) on the right to create a dynamic, editorial movement across the screen.