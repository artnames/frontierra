# Frontierra - Deterministic World Explorer

A deterministic procedural world generator and first-person explorer built with React, Three.js, and the NexArt Code Mode SDK.

## Overview

Frontierra generates infinite, explorable 3D worlds from a seed number and parameter array. The same inputs always produce identical worlds, enabling multiplayer synchronization without transmitting world data.

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Three.js** + **@react-three/fiber** - 3D rendering
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **@nexart/codemode-sdk** - Deterministic world generation
- **Supabase** - Backend (authentication, database, real-time)

## Getting Started

### Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm or bun

### Local Development

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

Create a `.env` file in the project root with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Building for Production

```sh
# Create optimized production build
npm run build

# Preview the production build locally
npm run preview
```

The build output is in the `dist/` directory.

## Deployment

Deploy the `dist/` folder to any static hosting service:

- **Netlify**: Connect your repo and set build command to `npm run build`
- **Vercel**: Import project, auto-detects Vite
- **Cloudflare Pages**: Set build command and output directory
- **GitHub Pages**: Use GitHub Actions to build and deploy

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

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` to check for issues
5. Submit a pull request

## License

See LICENSE file for details.
