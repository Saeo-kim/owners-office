import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from '../src/core/api.js';
import { createRepository } from '../src/core/repository.js';
import { seedDemo } from '../src/core/seed.js';
import { createAgent } from './agent.js';
import { createHttpServer } from './app.js';
import { openDatabase } from './sqlite.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.OFFICE_DB ?? join(root, 'data', 'office.db');
const port = Number(process.env.PORT ?? 4320);
const host = '127.0.0.1';

const db = openDatabase(dbPath);
const repo = createRepository(db);
// Demo rows are added once, on the very first run, and never come back after deletion.
if (process.env.OFFICE_SEED !== '0' && !repo.getSettings().demo_seeded) {
  const { created } = seedDemo(repo);
  console.log(`데모 데이터 ${created}건을 추가했습니다 (DEMO 표시, 설정에서 한 번에 삭제 가능).`);
}

// AI 팀원(CFO) API. Off unless OFFICE_AGENT_TOKEN is set; see server/agent.js.
const agent = createAgent({ db, repo, token: process.env.OFFICE_AGENT_TOKEN?.trim() || null });
if (agent.enabled) setInterval(() => agent.processQueued(), 5000).unref();

const server = createHttpServer(createApi({ repo, mode: 'server' }), { agent: agent.enabled ? agent : null });
server.listen(port, host, () => {
  console.log(`OWNER'S OFFICE  http://localhost:${port}`);
  console.log(`데이터 파일: ${dbPath}`);
  console.log(agent.enabled ? 'AI 팀원 API 사용: /api/agent (OFFICE_AGENT_TOKEN)' : 'AI 팀원 API 꺼짐 (OFFICE_AGENT_TOKEN을 설정하면 켜집니다)');
});
