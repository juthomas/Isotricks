# Iso Tricks

Isometric 3D optical illusion viewer built with **Next.js**, **Three.js**, and **React Three Fiber**.

Ambiguous wireframe and point-cloud views of 3D objects — classic Necker-cube style illusions where the brain can flip between two interpretations, plus reversible rotation.

## Features

- **Orthographic (isometric) camera** — no perspective foreshortening
- **Display modes**: Wireframe, Points, Solid
- **Built-in demos**: Tripode (default), Necker Cube, Tetrahedron, Open Frame, Torus Knot
- **File import**: `.obj`, `.stl`, `.glb`, `.gltf`, `.ply`
- **Per-object controls** persisted in `localStorage` (speed, direction, angles, zoom, point size)
- **Dark theme** with a near-black scene background

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Controls

| Control | Description |
|---|---|
| Demo illusions | Switch between built-in ambiguous models |
| Load model | Drag-and-drop or browse a 3D file |
| Display mode | Wireframe / Points / Solid |
| CW / CCW / Pause | Rotation direction (helps flip perception) |
| Speed | Auto-rotation rate in rad/s |
| Angle X / Y | Camera elevation and azimuth |
| Zoom | Orthographic frustum zoom |
| Orbit drag | Optional mouse orbit (sliders preferred for precision) |
| Reset to defaults | Restore default settings for the current object |

Settings are keyed by demo id or `file:name:size` and restored when you reopen the same object.

## Scripts

```bash
pnpm dev      # development server
pnpm build    # production build
pnpm start    # serve production build
pnpm lint     # ESLint
```

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- three / @react-three/fiber / @react-three/drei / three-stdlib
