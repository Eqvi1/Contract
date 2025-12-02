# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React application for managing contractor operations (ОСП - отдел сопровождения подрядчиков). Russian-language interface for tracking construction objects, contractors, tenders, contracts, and material rates.

**Tech Stack:** React 18.3 + Vite + Supabase + react-router-dom v7 + xlsx (SheetJS)

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Environment Setup

Create `.env.local` with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Architecture

### Application Structure

```
src/
├── App.jsx           # Routes, providers (Theme, Role, Router)
├── contexts/
│   ├── ThemeContext.jsx  # Light/dark theme (localStorage 'theme')
│   └── RoleContext.jsx   # User roles (localStorage 'userRole')
├── components/
│   └── Sidebar.jsx       # Navigation with collapsible sections
├── pages/                # CRUD pages for each entity
└── supabase/
    └── client.js         # Supabase client init
```

### Role-Based Access

Two roles: `employee` (full access) and `contractor` (proposals only)

```javascript
import { useRole } from './contexts/RoleContext'
const { isEmployee, isContractor, logout } = useRole()
```

### Routing (App.jsx)

- `/login` - Role selection
- `/contractor/proposals` - Contractor portal
- `/general/objects|contacts|counterparties` - General info (employees)
- `/tenders/construction|warranty` - Tender lists by department
- `/tenders/:tenderId` - Tender detail with estimates
- `/contracts/{department}/{status}` - Contract registry
- `/bsm/analysis|comparison|contract-rates|supply-rates|contractor-rates` - Material management

### Theming

```javascript
import { useTheme } from './contexts/ThemeContext'
const { theme, toggleTheme } = useTheme()
```

CSS variables defined for `[data-theme="light"]` and `[data-theme="dark"]` in `index.css`.

## Supabase Integration

### Client Usage

```javascript
import { supabase } from './supabase'

// Fetch with joins
const { data } = await supabase
  .from('contracts')
  .select('*, objects(name), counterparties(name)')
  .order('created_at', { ascending: false })

// Nested relationships
.select('*, counterparties(id, name, counterparty_contacts(full_name, phone))')

// Named relationship for winner
.select('*, winner:counterparties!winner_counterparty_id(id, name)')
```

### Database Tables

| Table | Purpose | Key Foreign Keys |
|-------|---------|------------------|
| `objects` | Construction sites | - |
| `contacts` | Personnel linked to objects | `object_id` |
| `counterparties` | Contractor directory | - |
| `counterparty_contacts` | Contact persons | `counterparty_id` (CASCADE) |
| `contracts` | Contract registry | `object_id`, `counterparty_id` |
| `tenders` | Tender management | `object_id`, `winner_counterparty_id` |
| `tender_counterparties` | Tender participants | `tender_id`, `counterparty_id` (CASCADE) |
| `tender_estimate_items` | Estimate line items | `tender_id` (CASCADE) |
| `tender_counterparty_proposals` | Price proposals | `estimate_item_id`, `counterparty_id` |
| `bsm_contract_rates` | Agreed material rates | `object_id` (CASCADE) |
| `bsm_supply_rates` | Supply dept rates | `object_id` (CASCADE) |
| `bsm_contractor_rates` | Contractor-specific rates | `object_id`, `counterparty_id` (CASCADE) |

**Key ENUMs:**
- `objects.status`: `'main_construction'` | `'warranty_service'`
- `counterparties.status`: `'active'` | `'blacklist'`
- `tender_counterparties.status`: `'request_sent'` | `'declined'` | `'proposal_provided'`

### Schema Files

- `supabase/schemas/prod.sql` - Full production schema
- `supabase/schemas/*.sql` - Individual table schemas
- `supabase/migrations/` - Chronological migrations

## Excel Import/Export (xlsx)

Used in `TenderDetailPage.jsx`, `ContractorProposalsPage.jsx`, `BSMPage.jsx`:

```javascript
import * as XLSX from 'xlsx'

// Import
const workbook = XLSX.read(arrayBuffer, { type: 'array' })
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

// Export
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
XLSX.writeFile(wb, 'filename.xlsx')
```

**Estimate columns:** № п/п, КОД, Вид затрат, Наименование затрат, Примечание к расчету, Ед. изм., Объем, Расход

## Key Patterns

### Page Components

Each page handles its own CRUD operations directly with Supabase. Pattern:
1. `useState` for data, loading, editing state
2. `useEffect` to fetch on mount
3. Form handling with local state
4. Direct Supabase calls for mutations

### Sidebar Navigation

Collapsible sections with expand state initialized from current route:
```javascript
const [expanded, setExpanded] = useState(location.pathname.startsWith('/section'))
```

### Props-Based Filtering

Several pages use props for filtering:
- `TendersPage` - `department` prop ('construction' | 'warranty')
- `ContractsPage` - `department` and `status` props
