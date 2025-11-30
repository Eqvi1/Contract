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
  - Used in `TenderDetailPage.jsx` and `ContractorProposalsPage.jsx`
  - Import estimates from Excel: `XLSX.read()` → `sheet_to_json()`
  - Export templates: `aoa_to_sheet()` → `book_new()` → `writeFile()`
  - Template columns for estimates: № п/п, КОД, Вид затрат, Наименование затрат, Примечание к расчету, Ед. изм., Объем, Расход
  - Proposal templates add pricing columns: Цена материалы, Цена СМР/ПНР, ИТОГО, Стоимость, Примечание участника

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
    - `tender_counterparties.sql` - Tender-counterparty relationships with status tracking
    - `tender_estimates.sql` - Estimate items, counterparty proposals, and proposal files
    - `bsm_rates.sql` - Approved material rates per object
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
  - Includes `tender_package_link` for document storage and `winner_counterparty_id` for winner selection
- **tender_counterparties** - Many-to-many relationship between tenders and counterparties
  - Links `tenders` and `counterparties` with `ON DELETE CASCADE`
  - `status` ENUM: `'request_sent'`, `'declined'`, or `'proposal_provided'`
  - Tracks invited counterparties with `invited_at` timestamp and `notes`
  - Unique constraint on `(tender_id, counterparty_id)`
- **tender_estimate_items** - Estimate line items for tenders (schema: `tender_estimates.sql`)
  - Linked to tender via `tender_id` with `ON DELETE CASCADE`
  - Fields: `row_number`, `code`, `cost_type`, `cost_name`, `calculation_note`, `unit`, `work_volume`, `material_consumption`
  - Unique constraint on `(tender_id, row_number)`
- **tender_counterparty_proposals** - Contractor price proposals for estimate items
  - Links estimate items to counterparty pricing
  - Fields: `unit_price_materials`, `unit_price_works`, `total_unit_price`, `total_materials`, `total_works`, `total_cost`, `participant_note`
  - Unique constraint on `(estimate_item_id, counterparty_id)`
- **tender_proposal_files** - Uploaded Excel files with contractor proposals
  - Tracks `file_name`, `file_url`, `file_size`, `uploaded_at`
- **bsm_approved_rates** - Approved material pricing per construction object
  - Links to `objects` via `object_id` with `ON DELETE CASCADE`
  - Fields: `material_name`, `unit`, `approved_price`, `notes`
  - Unique constraint on `(object_id, material_name)` - one rate per material per object
- All tables use UUID primary keys and include `created_at`/`updated_at` timestamps
- Row Level Security (RLS) enabled on all tables with policies for authenticated users
- Automatic `updated_at` triggers on all tables via table-specific trigger functions

**Data Fetching Patterns:**
- Use Supabase's `.select()` with relationship syntax for joins: `.select('*, objects(name), counterparties(name)')`
- This returns nested objects (e.g., `contract.counterparties.name`) instead of flat joins
- For deep nested relationships, chain the syntax:
  ```javascript
  .select(`*, counterparties(id, name, work_type, counterparty_contacts(full_name, phone, email))`)
  ```
- Standard CRUD operations: `.insert()`, `.update()`, `.delete()`, `.select()`
- Use `.order()` for sorting results
- Filter with `.eq()`, `.neq()`, `.in()`, etc.
- For many-to-many inserts, use array of objects: `.insert([{tender_id, counterparty_id}, ...])`
- For winner relationship in tenders: `.select('*, winner:counterparties!winner_counterparty_id(id, name)')`

**MCP (Model Context Protocol) Integration:**
- MCP server configured in `.mcp/config.json`
- Allows AI assistants to interact directly with Supabase project
- Project reference: `jxbuimrosrmmjroojdza`
- Enabled features: database, functions, storage, docs
- See `.mcp/README.md` for setup instructions for different AI tools
- Security: Set `read_only: true` for production environments

### Application Architecture

**Role-Based Access:**
- Two user roles: `employee` (СУ-10 staff) and `contractor` (external contractors)
- Role context in `src/contexts/RoleContext.jsx`
- Use `useRole()` hook to access: `isEmployee`, `isContractor`, `contractorInfo`, `logout`
- Roles persisted in localStorage (`userRole`, `contractorInfo` keys)
- Employees see full sidebar navigation; contractors see only their proposals page

**Routing:**
- **React Router v7** for client-side routing
- Routes defined in `src/App.jsx` with role-based protection
- `EmployeeLayout` - Protected routes for employees with full sidebar
- `AuthRoutes` - Handles login and role-based redirects
- Navigation structure:
  - `/login` - Role selection page
  - **Contractor portal:**
    - `/contractor/proposals` - Contractor's tender proposals (contractors only)
  - **Employee routes (sidebar navigation):**
    - **General Information** (collapsible):
      - `/general/objects` - Construction objects (default for employees)
      - `/general/contacts` - Contact persons
      - `/general/counterparties` - Contractor directory
    - **Tenders** (collapsible, by department):
      - `/tenders/construction` - Main construction tenders
      - `/tenders/warranty` - Warranty department tenders
      - `/tenders/:tenderId` - Tender detail page with estimates
    - **Contracts** (collapsible, nested by department and status):
      - `/contracts/construction/pending` - Pending construction contracts
      - `/contracts/construction/signed` - Signed construction contracts
      - `/contracts/warranty/pending` - Pending warranty contracts
      - `/contracts/warranty/signed` - Signed warranty contracts
    - **BSM (БСМ)** (collapsible):
      - `/bsm/analysis` - Material analysis from Excel files
      - `/bsm/rates` - Approved material rates management
    - `/acceptance` - Work acceptance
    - `/reports` - Reports and analytics
- Sidebar uses nested collapsible sections with `useState` for expand/collapse

**Theming System:**
- Custom theme context in `src/contexts/ThemeContext.jsx`
- Supports light/dark themes with localStorage persistence
- Theme stored in `localStorage` under key `'theme'`
- Applied via `data-theme` attribute on `document.documentElement`
- Use `useTheme()` hook to access theme state and `toggleTheme()` function
- ThemeToggle component in sidebar footer

**Component Structure:**
- `Layout.jsx` - Main layout wrapper
- `Sidebar.jsx` - Left navigation sidebar with nested collapsible sections and theme toggle
  - Uses multiple `useState` hooks for section expand/collapse states
  - Persists expanded state based on current route
- Page components in `src/pages/`:
  - `LoginPage.jsx` - Role selection (employee/contractor)
  - `ObjectsPage.jsx` - Construction objects management
  - `ContactsPage.jsx` - Contact persons management
  - `CounterpartiesPage.jsx` - Contractor directory
  - `TendersPage.jsx` - Tender list with `department` prop ('construction' | 'warranty')
  - `TenderDetailPage.jsx` - Detailed tender view with estimates, proposals comparison, and participants
    - Tabs: Смета (estimates), Сравнение КП (proposal comparison), Участники (participants)
    - Excel import/export for estimates and proposal templates (uses xlsx library)
  - `ContractsPage.jsx` - Contract registry with `department` and `status` props
  - `ContractorProposalsPage.jsx` - Contractor portal for viewing/submitting tender proposals
  - `BSMPage.jsx` - Material analysis tool with Excel import and pivot table creation
    - Tabs: Все материалы (all), Без расценки (zero price), Разные цены (different prices), Разные ед. изм. (unit mismatches), Сравнение с БСМ (comparison with approved rates)
    - Excel import creates pivot table grouping by material name + price
    - Compares uploaded data against approved rates from `bsm_approved_rates` table
  - `BSMRatesPage.jsx` - CRUD for approved material rates per object
  - `AcceptancePage.jsx` - Work acceptance
  - `ReportsPage.jsx` - Reports

### Project Structure

```
src/
├── main.jsx              # Application entry point
├── App.jsx               # Root component with router, theme, and role providers
├── App.css               # App-level styles
├── index.css             # Global styles and CSS variables
├── assets/               # Static assets bundled by Vite
├── components/           # Reusable components
│   ├── Sidebar.jsx       # Navigation sidebar with nested collapsible sections
│   ├── ThemeToggle.jsx   # Theme switcher
│   ├── Layout.jsx        # Layout wrapper
│   └── TenderDetail.css  # Tender detail page styles
├── contexts/             # React contexts
│   ├── ThemeContext.jsx  # Theme state management
│   └── RoleContext.jsx   # User role management (employee/contractor)
├── pages/                # Page components (each handles CRUD for its entity)
│   ├── LoginPage.jsx     # Role selection page
│   ├── ObjectsPage.jsx
│   ├── ContactsPage.jsx
│   ├── CounterpartiesPage.jsx
│   ├── TendersPage.jsx   # Tender list with department filtering
│   ├── TenderDetailPage.jsx  # Tender estimates and proposal comparison
│   ├── ContractsPage.jsx
│   ├── ContractorProposalsPage.jsx  # Contractor portal
│   ├── BSMPage.jsx           # Material analysis with Excel pivot
│   ├── BSMRatesPage.jsx      # Approved rates management
│   ├── AcceptancePage.jsx
│   └── ReportsPage.jsx
└── supabase/             # Supabase configuration
    ├── client.js         # Supabase client initialization
    ├── hooks.js          # React hooks (useSupabase)
    └── index.js          # Export barrel

supabase/                 # Database schema and configuration
├── schemas/
│   ├── prod.sql          # Full production schema
│   ├── general_info.sql  # Objects and contacts tables
│   ├── counterparties.sql
│   ├── counterparty_contacts.sql
│   ├── contracts.sql
│   ├── tenders.sql
│   ├── tender_counterparties.sql
│   └── tender_estimates.sql  # Estimate items, proposals, proposal files
├── migrations/           # Database migrations
└── exports/              # Database structure exports

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
