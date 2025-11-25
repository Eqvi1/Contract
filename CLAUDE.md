# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application for managing contractor operations (ОСП - отдел сопровождения подрядчиков, "Contractor Support Department"). The application is built with Vite as the build tool and development server.

**Application Domain:**
- Russian-language interface for managing contractors and construction projects
- Tracks general information about construction objects and subcontractors
- Manages tenders, contracts, work acceptance, and reports
- Uses Supabase for data persistence and authentication

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

### Additional Libraries

- **react-router-dom** v7 - Client-side routing
- **xlsx** - Excel file import/export functionality (SheetJS)

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
- Import: `import { supabase } from './supabase'` (or relative path from your component)
- Use `useSupabase()` hook for auth state in React components
- Database schemas and exports stored in `supabase/` directory:
  - `schemas/prod.sql` - Full database schema
  - `schemas/` - Individual table schemas:
    - `general_info.sql` - Objects and contacts tables
    - `counterparties.sql` - Counterparties table with status ENUM
    - `counterparty_contacts.sql` - Counterparty contact persons
    - `contracts.sql` - Contracts table
    - `tenders.sql` - Tenders table
  - `migrations/` - Database migrations (chronological schema changes)
  - `exports/` - JSON exports of tables, functions, triggers, indexes, enums

**Database Schema:**
- **objects** - Construction objects/sites with coordinates and status tracking
  - `status` ENUM: `'main_construction'` or `'warranty_service'`
  - Includes optional `map_link`, `latitude`, `longitude` for location tracking
- **contacts** - Personnel contacts (directors, economists, engineers) linked to objects
  - References `objects` via `object_id` with `ON DELETE SET NULL`
- **counterparties** - Contractor directory with legal and contact information (INN, KPP, addresses)
  - `status` ENUM: `'active'` or `'blacklist'`
  - Includes `work_type`, `website`, and `notes` fields
- **counterparty_contacts** - Contact persons for counterparties
  - References `counterparties` via `counterparty_id` with `ON DELETE CASCADE`
  - Stores contact person details (name, position, phone, email)
- **contracts** - Contract registry with warranty and work period tracking
  - Links to `objects` (construction sites) via `object_id`
  - Links to `counterparties` (contractors) via `counterparty_id`
  - Both foreign keys use `ON DELETE SET NULL` to preserve historical data
- **tenders** - Tender management with status tracking and date constraints
  - Links to `objects` via `object_id` with `ON DELETE SET NULL`
  - Includes `tender_package_link` for document storage
- All tables use UUID primary keys and include `created_at`/`updated_at` timestamps
- Row Level Security (RLS) enabled on all tables with policies for authenticated users
- Automatic `updated_at` triggers on all tables via table-specific trigger functions

**Data Fetching Patterns:**
- Use Supabase's `.select()` with relationship syntax for joins: `.select('*, objects(name), counterparties(name)')`
- This returns nested objects (e.g., `contract.counterparties.name`) instead of flat joins
- Standard CRUD operations: `.insert()`, `.update()`, `.delete()`, `.select()`
- Use `.order()` for sorting results
- Filter with `.eq()`, `.neq()`, `.in()`, etc.

**MCP (Model Context Protocol) Integration:**
- MCP server configured in `.mcp/config.json`
- Allows AI assistants to interact directly with Supabase project
- Project reference: `jxbuimrosrmmjroojdza`
- Enabled features: database, functions, storage, docs
- See `.mcp/README.md` for setup instructions for different AI tools
- Security: Set `read_only: true` for production environments

### Application Architecture

**Routing:**
- **React Router v7** for client-side routing
- Routes defined in `src/App.jsx`
- Navigation structure:
  - **General Information** (collapsible sidebar section):
    - `/general/objects` - Construction objects management (default route)
    - `/general/contacts` - Contact persons management
    - `/general/counterparties` - Contractor directory
  - `/tenders` - Tenders management
  - `/contracts` - Contract registry
  - `/acceptance` - Work acceptance
  - `/reports` - Reports and analytics
- Sidebar navigation with `NavLink` for active state highlighting
- Root path `/` redirects to `/general/objects`
- The "General Information" section in the sidebar is collapsible with expand/collapse state

**Theming System:**
- Custom theme context in `src/contexts/ThemeContext.jsx`
- Supports light/dark themes with localStorage persistence
- Theme stored in `localStorage` under key `'theme'`
- Applied via `data-theme` attribute on `document.documentElement`
- Use `useTheme()` hook to access theme state and `toggleTheme()` function
- ThemeToggle component in sidebar footer

**Component Structure:**
- `Layout.jsx` - Main layout wrapper
- `Sidebar.jsx` - Left navigation sidebar with collapsible sections and theme toggle
  - Uses `useState` to manage collapsed/expanded state of "General Information" section
  - Persists expanded state based on current route
- Page components in `src/pages/`:
  - `ObjectsPage.jsx` - Construction objects management
  - `ContactsPage.jsx` - Contact persons management
  - `CounterpartiesPage.jsx` - Contractor directory
  - `TendersPage.jsx` - Tender management
  - `ContractsPage.jsx` - Contract registry
  - `AcceptancePage.jsx` - Work acceptance
  - `ReportsPage.jsx` - Reports

### Project Structure

```
src/
├── main.jsx              # Application entry point
├── App.jsx               # Root component with router and theme provider
├── App.css               # App-level styles
├── index.css             # Global styles and CSS variables
├── assets/               # Static assets bundled by Vite
├── components/           # Reusable components
│   ├── Sidebar.jsx       # Navigation sidebar
│   ├── ThemeToggle.jsx   # Theme switcher
│   ├── Layout.jsx        # Layout wrapper
│   ├── ContractRegistry.jsx
│   └── GeneralInfo.jsx
├── contexts/             # React contexts
│   └── ThemeContext.jsx  # Theme state management
├── pages/                # Page components
│   ├── ObjectsPage.jsx
│   ├── ContactsPage.jsx
│   ├── CounterpartiesPage.jsx
│   ├── TendersPage.jsx
│   ├── ContractsPage.jsx
│   ├── AcceptancePage.jsx
│   └── ReportsPage.jsx
└── supabase/             # Supabase configuration
    ├── client.js         # Supabase client initialization
    ├── hooks.js          # React hooks (useSupabase)
    └── index.js          # Export barrel

supabase/                 # Database schema and configuration
├── schemas/
│   ├── prod.sql          # Full production schema
│   ├── contracts.sql     # Contracts table schema
│   ├── tenders.sql       # Tenders table schema
│   └── general_info.sql  # General info schema
├── migrations/           # Database migrations
└── exports/              # Database structure exports
    ├── tables.json
    ├── functions.json
    ├── triggers.json
    ├── indexes.json
    └── enums.json

.mcp/                     # Model Context Protocol configuration
├── config.json           # MCP server settings
├── README.md             # MCP setup instructions
├── examples.md           # Usage examples
└── QUICK_START.md        # Quick start guide
```

### Styling Approach

- CSS files imported directly in JSX components
- Global styles in `src/index.css` with CSS variables for theming
- Dark/light theme toggle via ThemeContext (not OS preference)
- Theme applied using `data-theme` attribute on root element
- Component-specific styles in separate CSS files
- CSS variables should be defined for both `[data-theme="light"]` and `[data-theme="dark"]`

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
