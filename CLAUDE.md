# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application built with Vite as the build tool and development server.

## Development Commands

### Essential Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

## Project Architecture

### Build System

- **Vite** - Fast build tool and dev server with Hot Module Replacement (HMR)
- **ES Modules** - Project uses `"type": "module"` in package.json
- Entry point: `index.html` loads `src/main.jsx`

### React Setup

- **React 18.3** with modern patterns
- **StrictMode** enabled in `src/main.jsx`
- Uses `createRoot` API from react-dom/client
- JSX files use `.jsx` extension

### Code Quality

- **ESLint** configured with React plugins
- Rules include react-refresh plugin for HMR compatibility
- Configuration in `.eslintrc.cjs` (CommonJS format for ESLint config)

### Backend & Database

- **Supabase** - Backend-as-a-Service for database, auth, and storage
- Client library: `@supabase/supabase-js`
- Environment variables configured in `.env.local`:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public API key
- Access env variables in code: `import.meta.env.VITE_SUPABASE_URL`
- Vite exposes only variables prefixed with `VITE_` to client-side code

**Supabase Integration:**
- Client initialized in `src/supabase/client.js`
- Import: `import { supabase } from '@/supabase'`
- Use `useSupabase()` hook for auth state in React components
- Database schemas and exports stored in `supabase/` directory:
  - `schemas/prod.sql` - Full database schema
  - `exports/` - JSON exports of tables, functions, triggers, indexes, enums

**MCP (Model Context Protocol) Integration:**
- MCP server configured in `.mcp/config.json`
- Allows AI assistants to interact directly with Supabase project
- Project reference: `jxbuimrosrmmjroojdza`
- Enabled features: database, functions, storage, docs
- See `.mcp/README.md` for setup instructions for different AI tools
- Security: Set `read_only: true` for production environments

### Project Structure

```
src/
├── main.jsx           # Application entry point, renders App into DOM
├── App.jsx            # Root component
├── App.css            # Component-specific styles
├── index.css          # Global styles and CSS variables
├── assets/            # Static assets bundled by Vite
└── supabase/          # Supabase configuration and utilities
    ├── client.js      # Supabase client initialization
    ├── hooks.js       # React hooks for Supabase (useSupabase)
    └── index.js       # Export barrel for supabase utilities

supabase/              # Database schema and configuration
├── schemas/
│   └── prod.sql       # Production database schema
└── exports/           # Database structure exports
    ├── tables.json
    ├── functions.json
    ├── triggers.json
    ├── indexes.json
    └── enums.json

.mcp/                  # Model Context Protocol configuration
├── config.json        # MCP server settings
└── README.md          # MCP setup instructions
```

### Styling Approach

- CSS files imported directly in JSX components
- Global styles in `src/index.css` with CSS variables for theming
- Dark/light mode support via `prefers-color-scheme`
- Component-specific styles in separate CSS files

## Development Notes

### Hot Module Replacement (HMR)

- Vite provides instant HMR - changes reflect immediately without full reload
- React Fast Refresh enabled via `@vitejs/plugin-react`
- Edit `src/App.jsx` to see HMR in action

### Static Assets

- Files in `public/` are served at root path (e.g., `/vite.svg`)
- Files in `src/assets/` are processed by Vite and get hashed filenames
- Import assets in JSX using relative paths

### Building for Production

- `npm run build` creates optimized bundle in `dist/` directory
- Vite automatically code-splits and optimizes assets
- Use `npm run preview` to test production build locally before deployment
