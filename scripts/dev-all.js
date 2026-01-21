import { spawn } from 'node:child_process';

const commands = [
  { name: 'vite', cmd: 'npm', args: ['run', 'dev'] },
  { name: 'functions', cmd: 'supabase', args: ['functions', 'serve'] },
  { name: 'worker', cmd: 'node', args: ['scripts/worker.js'] },
];

const processes = commands.map(({ name, cmd, args }) => {
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[dev-all] ${name} exited with code ${code}`);
    }
  });
  return child;
});

const shutdown = () => {
  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
