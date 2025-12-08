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
npm run lint         # Run ESLint (--max-warnings 0)
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
├── App.jsx           # Routes, nested EmployeeLayout, providers
├── contexts/
│   ├── ThemeContext.jsx  # Light/dark theme (localStorage 'theme')
│   └── RoleContext.jsx   # User roles (localStorage 'userRole')
├── components/
│   └── Sidebar.jsx       # Navigation with 3-level collapsible sections
├── pages/                # Self-contained CRUD pages (no shared state)
└── supabase/
    ├── client.js         # Supabase client init
    └── hooks.js          # Auth hooks (unused - roles via localStorage)
```

### Data Flow Pattern

No centralized state management. Each page:
1. Fetches data in `useEffect` on mount
2. Manages local state with `useState`
3. Calls Supabase directly for mutations
4. Re-fetches after mutations to sync UI

### Role-Based Access

Two roles stored in `localStorage('userRole')`: `employee` (full access) and `contractor` (proposals only). This is app-level role selection, not Supabase Auth.

```javascript
import { useRole } from './contexts/RoleContext'
const { isEmployee, isContractor, isLoggedIn, logout } = useRole()
```

Contractor login also stores `contractorInfo` (id, name) for proposal filtering.

### Routing (App.jsx)

- `/login` - Role selection
- `/contractor/proposals` - Contractor portal
- `/general/objects|contacts|counterparties` - General info (employees)
- `/tenders/construction|warranty` - Tender lists by department
- `/tenders/:tenderId` - Tender detail with estimates
- `/contracts/{department}/{status}` - Contract registry (department: construction|warranty, status: pending|signed)
- `/bsm/*` - Material management (БСМ):
  - `/bsm/analysis` - Excel import & analysis (BSMPage) - main analysis tool
  - `/bsm/comparison` - Compare rates across sources (BSMComparisonPage)
  - `/bsm/contract-rates` - Agreed contract rates (BSMContractRatesPage)
  - `/bsm/supply-rates` - Supply department rates (BSMRatesPage)
  - `/bsm/contractor-rates` - Contractor-specific rates (BSMContractorRatesPage)
- `/acceptance` - Acceptance page (placeholder)
- `/reports` - Reports page (placeholder)

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

- `supabase/schemas/prod.sql` - Full production schema (large, includes all Supabase system tables)
- `supabase/schemas/*.sql` - Individual table schemas (preferred for reading/editing):
  - `general_info.sql` - objects, contacts tables
  - `counterparties.sql`, `counterparty_contacts.sql` - Contractor directory
  - `tenders.sql`, `tender_counterparties.sql`, `tender_estimates.sql` - Tender system
  - `contracts.sql` - Contract registry
  - `bsm_rates.sql` - Legacy rates schema
  - `bsm_contract_rates.sql`, `bsm_supply_rates.sql`, `bsm_contractor_rates.sql` - Material rates (split)
- `supabase/migrations/` - Chronological migrations for schema changes

### Schema Change Workflow

1. Create migration file in `supabase/migrations/` with descriptive name (e.g., `add_field_to_table.sql`)
2. Update corresponding schema file in `supabase/schemas/`
3. Apply migration via Supabase dashboard SQL editor or CLI

## Excel Import/Export (xlsx)

Used in `TenderDetailPage.jsx`, `ContractorProposalsPage.jsx`, and BSM pages:

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

### Numeric Value Cleaning (BSMPage pattern)

Excel imports may contain formatted numbers with currency symbols and spaces. Use this pattern:
```javascript
const cleanNumericValue = (value) => {
  if (typeof value === 'number') return value
  let str = String(value)
  str = str.replace(/[₽$€¥£]/g, '')                    // Remove currency symbols
  str = str.replace(/[\s\u00A0\u2007\u202F]/g, '')     // Remove spaces (including non-breaking)
  str = str.replace(',', '.')                          // Decimal comma to dot
  str = str.replace(/[^\d.\-]/g, '')                   // Keep only digits, dot, minus
  return parseFloat(str) || 0
}
```

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

### Protected Routes

`EmployeeLayout` component in `App.jsx` wraps all employee routes. It checks `isLoggedIn` and `isEmployee` from RoleContext, redirecting unauthorized users to `/login` or `/contractor/proposals`.

### Multi-File Excel Accumulation (BSMPage)

BSMPage supports loading multiple Excel files that accumulate into a single analysis:
```javascript
// Track loaded files and raw rows separately
const [loadedFiles, setLoadedFiles] = useState([])     // [{name, rowCount}]
const [allRawRows, setAllRawRows] = useState([])       // All parsed rows with sourceFile

// Each row tracks its source for removal
rows.push({ ...parsedData, sourceFile: file.name })

// Remove single file: filter rows by sourceFile, recalculate pivot
const handleRemoveFile = (fileName) => {
  const newRows = allRawRows.filter(row => row.sourceFile !== fileName)
  recalculateFromRows(newRows)
}
```

### BSM Item Type Detection

Materials vs works are distinguished by КОД column:
- `Р` or starts with `Р-` → work (uses `priceWorks`)
- `мат.` or default → material (uses `priceMaterials`)

### BSM Expected Excel Format

BSMPage expects Excel files with this column structure:
| Column | Content |
|--------|---------|
| A | КОД — `Р` (work) or `мат.` (material) |
| B | Наименование |
| C | Ед. изм. |
| D | Объем |
| E | Цена материалов (с НДС) |
| F | Цена работ (с НДС) |

### RLS Pattern (Supabase)

All tables use Row Level Security with permissive policy for authenticated users:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON table_name
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
```

### 3-Level Sidebar Navigation

The sidebar supports 3 levels of nesting (see `/contracts`):
1. Parent section (collapsible button)
2. Submenu (links or nested parents)
3. Nested submenu (deepest links)

Each level tracks its own expanded state initialized from current route.
