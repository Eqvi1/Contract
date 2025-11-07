# Supabase MCP Server Configuration

This directory contains configuration for the Supabase Model Context Protocol (MCP) server, which allows AI assistants to interact with your Supabase project.

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting Large Language Models (LLMs) to platforms like Supabase. Once connected, AI assistants can:
- Query and manage database tables
- Execute SQL queries
- Manage Edge Functions
- Access storage buckets
- Search documentation
- And more...

## Configuration

The MCP server is configured in `config.json` with the following settings:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "transport": "sse",
      "settings": {
        "project_ref": "jxbuimrosrmmjroojdza",
        "read_only": false,
        "features": "database,functions,storage,docs"
      }
    }
  }
}
```

### Configuration Options

- **`project_ref`**: Your Supabase project reference ID (found in project settings)
- **`read_only`**: Set to `true` to prevent write operations (recommended for production data)
- **`features`**: Comma-separated list of enabled feature groups:
  - `account` - Account management
  - `database` - Database operations
  - `debugging` - Logs and debugging
  - `development` - Development utilities
  - `docs` - Documentation search
  - `functions` - Edge Functions management
  - `storage` - Storage management
  - `branching` - Branch management

## Setup for Different AI Tools

### Claude Desktop

Add to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&features=database,functions,storage,docs"
    }
  }
}
```

### Cursor

1. Visit your Supabase Dashboard
2. Go to Settings → Connect → MCP
3. Click the "Install for Cursor" button
4. Or manually add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&features=database,functions,storage,docs"
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcp.servers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=jxbuimrosrmmjroojdza&features=database,functions,storage,docs"
    }
  }
}
```

## Security Recommendations

⚠️ **Important Security Considerations:**

1. **Don't connect to production environments** unless absolutely necessary
2. **Enable read-only mode** when connecting to real data: `read_only=true`
3. **Scope to specific projects** using `project_ref` parameter
4. **Limit features** to only what you need
5. **Be aware of prompt injection risks** - AI assistants have full access to configured features

### Read-Only Configuration (Recommended for Production)

```json
{
  "settings": {
    "project_ref": "jxbuimrosrmmjroojdza",
    "read_only": true,
    "features": "database,docs"
  }
}
```

## Available MCP Tools

Once connected, the following tool groups are available:

### Database Tools
- List tables and schemas
- Query data with SQL
- Create, update, delete tables
- Manage indexes and constraints

### Functions Tools
- List Edge Functions
- Deploy and manage functions
- View function logs

### Storage Tools
- List and manage storage buckets
- Upload and download files
- Configure bucket policies

### Documentation Tools
- Search Supabase documentation
- Get API references

## Authentication

The MCP server uses OAuth 2.1 with Dynamic Client Registration. When you first connect, you'll be prompted to authenticate with your Supabase account.

## Testing the Connection

After configuring, you can test the MCP connection by asking your AI assistant:
- "List all tables in my Supabase database"
- "Show me the schema for the users table"
- "What Edge Functions do I have deployed?"

## Troubleshooting

### Connection Issues
- Verify your `project_ref` is correct (check in Supabase Dashboard → Settings)
- Ensure you've completed OAuth authentication
- Check that your AI tool supports MCP protocol

### Permission Errors
- Make sure you have appropriate permissions in your Supabase project
- Try enabling specific features individually
- Check if read-only mode is enabled when trying write operations

## Resources

- [Official Supabase MCP Documentation](https://supabase.com/docs/guides/getting-started/mcp)
- [MCP Server Dashboard](https://mcp.supabase.com)
- [GitHub Repository](https://github.com/supabase-community/supabase-mcp)
