# Frontierra - Deterministic World Explorer

A deterministic procedural world generator and first-person explorer built with React, Three.js, and the NexArt Code Mode SDK.

## Overview

Frontierra generates infinite, explorable 3D worlds from a seed number and parameter array. The same inputs always produce identical worlds, enabling multiplayer synchronization without transmitting world data. Explore procedurally generated terrain with rivers, forests, and dynamic day/night cycles.

## Quick Start

### Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm, pnpm, or bun

### Installation

```sh
git clone https://github.com/your-username/frontierra.git
cd frontierra
npm install
```

### Development

```sh
npm run dev
```

The app will be available at `http://localhost:8080`.

### Build for Production

```sh
npm run build
```

The build output is in the `dist/` directory.

### Preview Production Build

```sh
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```sh
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Your Supabase project ID

These are needed for multiplayer features (land ownership, discovery points, social features). Solo mode works without them.

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Three.js** + **@react-three/fiber** - 3D rendering
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **@nexart/codemode-sdk** - Deterministic world generation
- **Supabase** - Backend (authentication, database, real-time)

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   ├── social/      # Multiplayer/social features
│   └── ...          # World rendering components
├── hooks/           # Custom React hooks
├── lib/             # Core libraries
│   ├── worldConstants.ts  # Shared height/carve constants
│   ├── worldData.ts       # World data structures
│   ├── nexartWorld.ts     # NexArt SDK integration
│   └── multiplayer/       # Multiplayer logic
├── pages/           # Route pages
└── integrations/    # External service integrations
```

## Key Concepts

### Determinism

All world generation is deterministic. Given:
- `seed`: A number
- `vars`: An array of 10 numbers (0-100)

The world will always generate identically. This is critical for multiplayer where players need to see the same world without transferring terrain data.

### Height System

The project uses a unified height system defined in `src/lib/worldConstants.ts`:
- `WORLD_HEIGHT_SCALE` - Converts 0-1 elevation to world units
- `computeRiverCarveDepth()` - Shared river carving logic
- `getWaterHeight()` - Water surface height calculation

All components (terrain mesh, collision, water) use these shared functions to ensure visual-collision alignment.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Deployment

Deploy the `dist/` folder to any static hosting service:

- **Vercel**: Import project, auto-detects Vite
- **Netlify**: Connect repo, set build command to `npm run build`, publish directory to `dist`
- **Cloudflare Pages**: Set build command and output directory
- **GitHub Pages**: Use GitHub Actions to build and deploy

Example Netlify config (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
