---
name: sunrise-design-system
description: Tokens de marca y reglas de UI de Sunrise Discovery; usar siempre que se cree o modifique un componente visual del CRM.
paths: apps/web/**
---

# Sunrise Discovery — Design System

Tokens extraídos directamente del CSS de producción en `sunrisediscovery.com` (inspeccionado el 2026-06-16). No inventar valores fuera de esta lista.

## Colores (CSS variables del sitio → tokens Tailwind)

| Token Tailwind        | Valor hex   | Uso                                                |
|-----------------------|-------------|---------------------------------------------------|
| `brand-teal`          | `#03a5af`   | Color de acento primario: botones CTA, badges de etapa ganada, links activos |
| `brand-dark`          | `#114252`   | Dark teal: nav background, headers, texto sobre fondo claro |
| `brand-deep`          | `#195267`   | Variante más oscura: hover de botones, bordes de énfasis |
| `brand-mid`           | `#075865`   | Teal medio: iconos, separadores |
| `brand-charcoal`      | `#2d2f39`   | Texto principal, fondos oscuros secundarios |
| `brand-gold`          | `#eebb69`   | Acento dorado: badges especiales, resaltados, texto decorativo |
| `brand-light-gray`    | `#e8e7e7`   | Fondos de tarjetas, separadores, hover states sutiles |
| `brand-white`         | `#ffffff`   | Fondo principal del CRM |

### Paleta de superficie del CRM (light mode)
- Fondo página: `#ffffff` o `#f7f8f9`
- Fondo tarjeta: `#ffffff` con sombra sutil o borde `#e8e7e7`
- Fondo sidebar/nav: `#114252` (dark teal)
- Texto nav (sobre fondo oscuro): `#ffffff`
- Texto body: `#2d2f39`

## Tipografía

Google Fonts usadas en el sitio (cargar en el CRM también):

```
Outfit: 300, 400, 500, 600, 700     → UI principal, labels, navegación, body del CRM
Playfair Display: 400, 500, 600, 700 → Headings de sección (h1, h2), nombre de módulos
Bitter: 400, 700                     → Cuerpo de texto largo, comentarios, descripciones
```

**Jerarquía tipográfica del CRM:**
- `font-display` (Playfair Display): títulos de página, nombre de empresa en sidebar
- `font-sans` (Outfit): labels, botones, navegación, datos de cliente
- `font-serif` (Bitter): comentarios internos, notas de texto largo

## Logo

- SVG del header del sitio público:
  `https://cdn.prod.website-files.com/6a08b2c521f08afd837587ad/6a08b3386c591bbe5b0d3425_Group%201171274935.svg`
- Usar en el sidebar del CRM (versión blanca sobre fondo `#114252`).
- Si se necesita versión oscura (sobre fondo blanco), usar con `filter: invert(...)` o pedir al cliente el asset original.

## Border Radius

| Uso                    | Valor  |
|------------------------|--------|
| Botones                | `16px` |
| Cards / modales        | `20px` |
| Badges / pills         | `32px` |
| Inputs                 | `8px`  |

## Reglas de uso

1. **Botones primarios**: `bg-brand-teal text-white rounded-[16px]` — hover: `bg-brand-deep`
2. **Botones secundarios/outline**: `border border-brand-teal text-brand-teal rounded-[16px]` — hover: `bg-brand-teal/10`
3. **Etapa "Cerrado - ganado" en Kanban**: indicador en `brand-teal`
4. **Etapa "Cerrado - perdido"**: indicador en `#e85454` (rojo semántico, no de marca — solo para estados negativos)
5. **Sidebar nav**: fondo `brand-dark (#114252)`, texto `white`, ítem activo: borde izquierdo `brand-teal` + `bg-brand-teal/10`
6. **No usar** `brand-gold` en fondos amplios — solo como acento puntual (badge, icon)
7. **No inventar grises** fuera de `brand-light-gray (#e8e7e7)` — usar variantes de opacidad si se necesita más contraste

## tailwind.config.ts — extensión requerida

```ts
extend: {
  colors: {
    brand: {
      teal:       '#03a5af',
      dark:       '#114252',
      deep:       '#195267',
      mid:        '#075865',
      charcoal:   '#2d2f39',
      gold:       '#eebb69',
      'light-gray': '#e8e7e7',
    },
  },
  fontFamily: {
    sans:    ['Outfit', 'sans-serif'],
    serif:   ['Bitter', 'serif'],
    display: ['"Playfair Display"', 'serif'],
  },
},
```
