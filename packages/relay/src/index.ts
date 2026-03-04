import { createRelay } from './relay.js';

const PORT = parseInt(process.env['PORT'] ?? '7777', 10);
const relay = createRelay(PORT);

relay.start().then(() => {
  console.log(`Quorum relay listening on port ${PORT}`);
});

export { createRelay } from './relay.js';
