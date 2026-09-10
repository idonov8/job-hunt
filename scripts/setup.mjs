import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const secret = () => randomBytes(24).toString('hex');
const password = secret();
try {
  writeFileSync(
    '.env.local',
    `DATABASE_DRIVER=pg\nLOCAL_DB_PASSWORD=${password}\nDATABASE_URL=postgresql://jobhunter:${password}@127.0.0.1:54329/jobhunter\nAGENT_TOKEN=${secret()}\nSESSION_SECRET=${secret()}\nAPP_PASSWORD=${secret()}\nJOB_HUNTER_URL=http://127.0.0.1:3000\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Created .env.local. Your login password is APP_PASSWORD in that file.',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env.local already exists; left it unchanged.');
}
