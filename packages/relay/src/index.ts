export { createRelay } from './relay.js';

// Auto-start when run directly (not when imported as a library)
const isMain = process.argv[1]?.endsWith('relay/dist/index.js') ||
  process.argv[1]?.endsWith('relay/src/index.ts');

if (isMain) {
  const { createRelay } = await import('./relay.js');
  const PORT = parseInt(process.env['PORT'] ?? '7777', 10);
  const relay = createRelay(PORT);
  relay.start().then(() => {
    console.log(`Quorum relay listening on port ${PORT}`);
  });
}
