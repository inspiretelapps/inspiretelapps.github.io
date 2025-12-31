# Claude Code MCP Configuration

This directory contains the Model Context Protocol (MCP) server configuration for this project.

## Configured MCP Servers

### Exa (Web Search & Code Context)

**Status**: HTTP-based (works in cloud and local)

**Features**:
- Advanced web search with AI-powered relevance
- Code context search across GitHub repositories
- Research capabilities
- Company and LinkedIn research

**Setup**:

1. Get your Exa API key from [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)

2. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

3. Add your API key to `.env`:
   ```
   EXA_API_KEY=your_actual_api_key_here
   ```

4. The MCP server will automatically be available in Claude Code (both web and desktop)

## Available Tools

Once configured, you'll have access to:

- `web_search_exa` - Enhanced web search
- `get_code_context_exa` - Search code across GitHub
- `deep_researcher_start` - Deep research functionality
- `company_research_exa` - Research companies
- `linkedin_search_exa` - LinkedIn profile search

## Troubleshooting

**If MCP server doesn't connect:**

1. Verify your API key is valid
2. Check that `.env` file exists and contains the key
3. Restart Claude Code session
4. Check the MCP status with `/mcp` command

**Testing the connection:**

In Claude Code, ask:
> "Can you search the web for the latest React 19 features using Exa?"

If the search works, your MCP server is connected!

## Adding More MCP Servers

To add more HTTP-based MCP servers, edit `.claude/config.json`:

```json
{
  "mcpServers": {
    "exa": {
      "type": "http",
      "url": "https://mcp.exa.ai/mcp",
      "headers": {
        "X-API-Key": "${EXA_API_KEY}"
      }
    },
    "your-server-name": {
      "type": "http",
      "url": "https://your-server-url.com/mcp",
      "headers": {
        "Authorization": "Bearer ${YOUR_API_KEY}"
      }
    }
  }
}
```

## Documentation

- [Exa MCP Documentation](https://docs.exa.ai/reference/exa-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code MCP Guide](https://code.claude.com/docs/en/mcp)
