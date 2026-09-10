import { fileURLToPath } from 'node:url';

// Absolute paths work even when a desktop agent starts outside this checkout.
console.log(
  JSON.stringify(
    {
      mcpServers: {
        'job-hunter': {
          command: process.execPath,
          args: [
            '--import',
            fileURLToPath(
              new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url),
            ),
            fileURLToPath(new URL('./mcp.ts', import.meta.url)),
          ],
        },
      },
    },
    null,
    2,
  ),
);
