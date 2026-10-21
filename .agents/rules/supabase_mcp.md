---
description: Supabase MCP connection rule and persistent token configuration
always_on: true
---

# Supabase MCP Connection Instructions

Whenever the user asks to connect, configure, or run tasks with Supabase MCP in this project:
- **Project Name**: Maharashtra Motors Website + CRM
- **Project Ref**: `sxshzxbkjsrruqmrwkfb`
- **Project URL**: `https://sxshzxbkjsrruqmrwkfb.supabase.co`
- **Supabase Personal Access Token**: Stored securely in `.env` / `.env.local` as `SUPABASE_ACCESS_TOKEN`
- **Hosted MCP Server URL**: `https://mcp.supabase.com/mcp`
- **Authorization Header**: `Authorization: Bearer <SUPABASE_ACCESS_TOKEN from .env>`

Keep `.mcp.json` and `.agents/mcp_config.json` synchronized with these credentials locally (both files are git-ignored).
