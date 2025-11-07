# Supabase MCP Quick Start

## What You Got

MCP (Model Context Protocol) server configuration for your Supabase project is now set up! This allows AI assistants like Claude, Cursor, and VS Code Copilot to directly interact with your database.

## How to Activate

### For Claude Desktop

1. Open Claude Desktop configuration:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add this configuration:
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&features=database,functions,storage,docs"
    }
  }
}
```

3. Restart Claude Desktop

### For Cursor

1. Visit your Supabase Dashboard
2. Go to **Settings → Connect → MCP**
3. Click **"Install for Cursor"** button

Or manually add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&features=database,functions,storage,docs"
    }
  }
}
```

### For VS Code

Add to workspace settings or `.vscode/mcp.json`:
```json
{
  "mcp.servers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&features=database,functions,storage,docs"
    }
  }
}
```

## Test It Out

Once configured, try these commands with your AI assistant:

```
"List all tables in my database"
"Show me the schema for the users table"
"What Edge Functions do I have?"
```

## Enable Read-Only Mode (Recommended for Production)

To prevent accidental changes, use read-only mode:

```
https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&read_only=true&features=database,docs
```

## Need Help?

- Full documentation: See `.mcp/README.md`
- Usage examples: See `.mcp/examples.md`
- Official docs: https://supabase.com/docs/guides/getting-started/mcp

## Your Project Details

- **Project ID**: `jxbuimrosrmmjroojdza`
- **Project URL**: `https://jxbuimrosrmmjroojdza.supabase.co`
- **Enabled Features**: database, functions, storage, docs
- **Read-Only Mode**: Currently disabled (set to `true` for production)
