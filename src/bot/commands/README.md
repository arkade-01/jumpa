# Commands

This folder contains all the bot commands

## Structure

- `BaseCommand.ts` - Abstract base class that all commands extend
- `CommandManager.ts` - Manages command registration and execution
- `StartCommand.ts` - Handles the `/start` command
- `HelpCommand.ts` - Handles the `/help` command
- `PingCommand.ts` - Handles the `/ping` command
- `InfoCommand.ts` - Handles the `/info` command
- `index.ts` - Exports all commands for easy importing

## Adding New Commands

1. Create a new command file (e.g., `MyCommand.ts`)
2. Extend the `BaseCommand` class
3. Implement the required properties and methods:
   - `name`: Command name (without the `/`)
   - `description`: Command description
   - `execute(ctx: Context)`: Command logic
4. Add the command to `CommandManager.ts` in the `registerCommands()` method
5. Export it in `index.ts`

## Example

```typescript
import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";

export class MyCommand extends BaseCommand {
  name = "mycommand";
  description = "My custom command";

  async execute(ctx: Context): Promise<void> {
    await this.sendMessage(ctx, "Hello from my command!");
  }
}
```
