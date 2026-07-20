# 📋 Tool Names for `allowed_tools` / `tools:` Field

## Tool Name Format

Tools in Goose use the format: **`extension__toolname`** (double underscore)

For example: `developer__shell`, `developer__write`, `summon__delegate`

However, in check frontmatter (`tools:`), the format appears to be the **simple tool name** (like `Bash`, `Read`, `Grep`) — this may be Amp compatibility mode.

## Important Note on `allowed_tools` Enforcement

**Skills do NOT have native `allowed_tools` enforcement in Goose.**

- The `allowed_tools:` field in skill frontmatter is stored in the `metadata` HashMap but Goose does not parse or enforce it at runtime.
- Tool restrictions for skills rely on **LLM self-enforcement** based on skill instructions.
- For actual enforcement, use:
  - **Check `tools:` field** — enforced for `goose review` subagents
  - **Recipe `extensions:` filter** — restricts available extensions for delegated tasks
  - **Global `permission.yaml`** — user-level `never_allow` list

## Complete Tool List by Extension

### 1. **developer** Extension (Platform)
| Tool Name    | Full Name               | Description                | Read-Only? |
|--------------|-------------------------|----------------------------|------------|
| `write`      | `developer__write`      | Create/overwrite a file    | ❌ Write    |
| `edit`       | `developer__edit`       | Edit a file (find/replace) | ❌ Write    |
| `shell`      | `developer__shell`      | Execute shell commands     | ⚠️ Varies  |
| `tree`       | `developer__tree`       | List directory tree        | ✅ Read     |
| `read_image` | `developer__read_image` | Read an image file         | ✅ Read     |

### 2. **summon** Extension (Platform)
| Tool Name  | Full Name          | Description                            | Read-Only? |
|------------|--------------------|----------------------------------------|------------|
| `load`     | `summon__load`     | Load sources (agents, recipes, skills) | ✅ Read     |
| `delegate` | `summon__delegate` | Delegate task to subagent              | ⚠️ Spawns  |

### 3. **orchestrator** Extension (Platform, Hidden)
| Tool Name         | Full Name                       | Description             | Read-Only? |
|-------------------|---------------------------------|-------------------------|------------|
| `list_sessions`   | `orchestrator__list_sessions`   | List agent sessions     | ✅ Read     |
| `view_session`    | `orchestrator__view_session`    | View session details    | ✅ Read     |
| `start_agent`     | `orchestrator__start_agent`     | Start new agent session | ❌ Write    |
| `send_message`    | `orchestrator__send_message`    | Send message to agent   | ❌ Write    |
| `interrupt_agent` | `orchestrator__interrupt_agent` | Interrupt busy agent    | ❌ Write    |

### 4. **analyze** Extension (Platform)
| Tool Name | Full Name          | Description            | Read-Only? |
|-----------|--------------------|------------------------|------------|
| `analyze` | `analyze__analyze` | Analyze code structure | ✅ Read     |

### 5. **apps** Extension (Platform)
| Tool Name            | Full Name                  | Description             | Read-Only? |
|----------------------|----------------------------|-------------------------|------------|
| `list_apps`          | `apps__list_apps`          | List Goose apps         | ✅ Read     |
| `create_app`         | `apps__create_app`         | Create new app          | ❌ Write    |
| `iterate_app`        | `apps__iterate_app`        | Iterate on existing app | ❌ Write    |
| `delete_app`         | `apps__delete_app`         | Delete an app           | ❌ Write    |
| `create_app_content` | `apps__create_app_content` | Create app content      | ❌ Write    |
| `update_app_content` | `apps__update_app_content` | Update app content      | ❌ Write    |

### 6. **summarize** Extension (Platform, Disabled by Default)
| Tool Name   | Full Name              | Description       | Read-Only? |
|-------------|------------------------|-------------------|------------|
| `summarize` | `summarize__summarize` | Summarize content | ✅ Read     |

### 7. **skills** Extension (Platform)
| Tool Name    | Full Name            | Description               | Read-Only? |
|--------------|----------------------|---------------------------|------------|
| `load_skill` | `skills__load_skill` | Load a skill into context | ✅ Read     |

### 8. **Extension Manager** (Platform)
| Tool Name                     | Full Name                                       | Description                     | Read-Only? |
|-------------------------------|-------------------------------------------------|---------------------------------|------------|
| `search_available_extensions` | `extensionmanager__search_available_extensions` | Search for available extensions | ✅ Read     |
| `manage_extensions`           | `extensionmanager__manage_extensions`           | Enable/disable extensions       | ❌ Write    |

### 9. **fetch** Extension (STDIO/External)
| Tool Name | Full Name      | Description                      | Read-Only? |
|-----------|----------------|----------------------------------|------------|
| `fetch`   | `fetch__fetch` | Fetch content from URLs (HTTP/S) | ✅ Read     |

**Note:** The `fetch` extension is typically configured as:
```yaml
fetch:
  enabled: true
  type: stdio
  cmd: uvx
  args: ["mcp-server-fetch"]
```

### 10. **playwright** Extension (STDIO/External)
| Tool Name                  | Full Name                              | Description                     | Read-Only?  |
|----------------------------|----------------------------------------|---------------------------------|-------------|
| `browser_navigate`         | `playwright__browser_navigate`         | Navigate to URL                 | ✅ Read      |
| `browser_screenshot`       | `playwright__browser_screenshot`       | Take screenshot                 | ✅ Read      |
| `browser_click`            | `playwright__browser_click`            | Click element                   | ⚠️ Interact |
| `browser_type`             | `playwright__browser_type`             | Type text into element          | ⚠️ Interact |
| `browser_scroll`           | `playwright__browser_scroll`           | Scroll page                     | ⚠️ Interact |
| `browser_select`           | `playwright__browser_select`           | Select option                   | ⚠️ Interact |
| `browser_hover`            | `playwright__browser_hover`            | Hover over element              | ⚠️ Interact |
| `browser_drag`             | `playwright__browser_drag`             | Drag element                    | ⚠️ Interact |
| `browser_press_key`        | `playwright__browser_press_key`        | Press keyboard key              | ⚠️ Interact |
| `browser_snapshot`         | `playwright__browser_snapshot`         | Get accessibility tree snapshot | ✅ Read      |
| `browser_element_text`     | `playwright__browser_element_text`     | Get text content of element     | ✅ Read      |
| `browser_console_messages` | `playwright__browser_console_messages` | Get console messages            | ✅ Read      |
| `browser_close`            | `playwright__browser_close`            | Close browser                   | ❌ Write     |

**Note:** The `playwright` extension is typically configured as:
```yaml
playwright:
  enabled: true
  type: stdio
  cmd: npx
  args: ["@anthropic-ai/mcp-server-playwright"]
```

### 11. **chatrecall** Extension (Platform, Disabled by Default)
| Tool Name      | Full Name                  | Description               | Read-Only? |
|----------------|----------------------------|---------------------------|------------|
| `search_chats` | `chatrecall__search_chats` | Search past conversations | ✅ Read     |
| `load_summary` | `chatrecall__load_summary` | Load session summary      | ✅ Read     |

### 12. **todo** Extension (Platform)
| Tool Name | Full Name    | Description                 | Read-Only? |
|-----------|--------------|-----------------------------|------------|
| `todo`    | `todo__todo` | Manage Goose internal todos | ❌ Write    |

### 13. **tom** (Top Of Mind) Extension (Platform)
No tools exposed — injects context via environment variables.

---

## Extension Types

| Type              | Description                                                  | Example                         |
|-------------------|--------------------------------------------------------------|---------------------------------|
| `platform`        | Runs in-process with Goose agent, direct access to internals | developer, summon, orchestrator |
| `builtin`         | Bundled MCP server via DuplexStream pipes                    | memory (if registered)          |
| `stdio`           | External MCP server via command line                         | fetch, playwright               |
| `streamable_http` | Remote MCP server via HTTP                                   | custom remote servers           |

---

## Read-Only Tool Sets (for audit/judge skills)

### Minimal Read-Only Set
```yaml
allowed_tools:
  - developer__tree
  - developer__read_image
  - analyze__analyze
  - summon__load
  - skills__load_skill
```

### Extended Read-Only Set (with shell for validation commands)
```yaml
allowed_tools:
  - developer__tree
  - developer__read_image
  - developer__shell  # for read-only commands like cat, grep, goose recipe validate
  - analyze__analyze
  - summon__load
  - skills__load_skill
  - fetch__fetch
  - playwright__browser_navigate
  - playwright__browser_screenshot
  - playwright__browser_snapshot
```

### Write Tool Set
```yaml
write_tools:
  - developer__write
  - developer__edit
  - developer__shell  # can execute mutating commands
  - summon__delegate
  - apps__create_app
  - apps__delete_app
```

---

## Discovery Commands

```bash
# List all available skills
goose skills list

# List enabled extensions (from config)
cat ~/.config/goose/config.yaml | grep -A 3 "enabled: true"

# At runtime in a session
load()  # lists agents, recipes, skills
```
