# MCP Usage Examples

This document contains practical examples of how to use the Supabase MCP server with AI assistants.

## Database Operations

### Query Data

**Prompt to AI:**
```
List all tables in my Supabase database
```

**Prompt to AI:**
```
Show me the first 10 rows from the users table
```

**Prompt to AI:**
```
Query all active users created in the last 30 days
```

### Schema Information

**Prompt to AI:**
```
What is the schema of the users table?
```

**Prompt to AI:**
```
Show me all foreign key relationships in the database
```

**Prompt to AI:**
```
List all indexes on the posts table
```

### Create/Modify Tables

**Prompt to AI:**
```
Create a new table called 'posts' with columns: id (uuid, primary key), title (text), content (text), author_id (uuid, foreign key to users), created_at (timestamp)
```

**Prompt to AI:**
```
Add a new column 'bio' of type text to the users table
```

**Prompt to AI:**
```
Create an index on the email column of the users table
```

## Edge Functions

### List and Manage Functions

**Prompt to AI:**
```
What Edge Functions do I have deployed?
```

**Prompt to AI:**
```
Show me the code for the 'send-email' function
```

**Prompt to AI:**
```
What are the environment variables for the 'process-payment' function?
```

### Deploy Functions

**Prompt to AI:**
```
Deploy this function as 'hello-world':
[paste your function code]
```

## Storage Operations

### Bucket Management

**Prompt to AI:**
```
List all storage buckets in my project
```

**Prompt to AI:**
```
What are the settings for the 'avatars' bucket?
```

**Prompt to AI:**
```
Create a new public storage bucket called 'images'
```

### File Operations

**Prompt to AI:**
```
List all files in the 'avatars' bucket
```

**Prompt to AI:**
```
What is the public URL for 'user-123.jpg' in the avatars bucket?
```

## Documentation Search

**Prompt to AI:**
```
How do I implement Row Level Security in Supabase?
```

**Prompt to AI:**
```
Show me examples of real-time subscriptions in Supabase
```

**Prompt to AI:**
```
What are the best practices for Supabase authentication?
```

## Complex Workflows

### Complete Feature Implementation

**Prompt to AI:**
```
Help me implement a blog system:
1. Create tables for posts, comments, and categories
2. Set up Row Level Security policies
3. Create an Edge Function to send notifications when someone comments
4. Show me the React code to display posts with their comments
```

### Database Migration

**Prompt to AI:**
```
I need to migrate from this schema [current schema] to this new schema [new schema]. Can you:
1. Generate the migration SQL
2. Identify any potential data issues
3. Create a backup strategy
```

### Performance Optimization

**Prompt to AI:**
```
Analyze my database and suggest:
1. Missing indexes
2. Query optimizations
3. Schema improvements
```

## Debugging

### Log Analysis

**Prompt to AI:**
```
Show me the logs for the 'process-payment' function from the last hour
```

**Prompt to AI:**
```
Are there any errors in my database logs?
```

### Performance Issues

**Prompt to AI:**
```
Which queries are taking the longest to execute?
```

**Prompt to AI:**
```
Analyze the performance of my API endpoints
```

## Security Best Practices

### Row Level Security

**Prompt to AI:**
```
Review my Row Level Security policies and identify any security issues
```

**Prompt to AI:**
```
Create RLS policies for the posts table so users can only see their own posts
```

### Access Control

**Prompt to AI:**
```
What permissions does the anon role have on my tables?
```

**Prompt to AI:**
```
Set up a role for admin users with full access to the posts table
```

## Tips for Effective Prompts

1. **Be Specific**: Instead of "show me data", say "show me the first 10 users ordered by created_at"

2. **Provide Context**: Include relevant table names, column names, and business logic

3. **Break Down Complex Tasks**: For complex operations, ask the AI to handle them step by step

4. **Request Explanations**: Ask the AI to explain what it's doing: "Create a posts table and explain the schema choices"

5. **Verify Before Executing**: For destructive operations, ask the AI to show you the SQL first: "Show me the SQL to delete all test users (but don't execute it yet)"

## Safety Reminders

⚠️ **Important:**
- Always review SQL queries before execution
- Be cautious with DELETE, DROP, and TRUNCATE operations
- Test schema changes on a development project first
- Keep backups of important data
- Use read-only mode when exploring production data
