import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { ContextStore } from '@quorum/server';
import { generateContextMarkdown } from '../export.js';

export async function exportCommand() {
  const storeDir = join(process.cwd(), '.collab');
  const store = new ContextStore(storeDir);

  try {
    const data = await store.getData();
    const markdown = generateContextMarkdown(data, []);
    const outputPath = join(process.cwd(), '.collab', 'context.md');
    await mkdir(join(process.cwd(), '.collab'), { recursive: true });
    await writeFile(outputPath, markdown);
    console.log(`✓ Context exported to ${outputPath}`);
  } catch {
    console.error('No session data found. Start a session first.');
  }
}
