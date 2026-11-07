import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const file = 'supabase/.temp/paused-containers.json';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
if (process.argv[2] === 'pause') {
  if (existsSync(file)) throw new Error('A pause record exists. Restore it before pausing again.');
  const names = docker('ps', '--format', '{{.Names}}').split('\n').filter((name) => /^supabase_.+_hack-iloilo(?:-sms-nlp|-notifications)?$/.test(name));
  mkdirSync('supabase/.temp', { recursive: true });
  writeFileSync(file, JSON.stringify(names));
  if (names.length) docker('stop', ...names);
  console.log(`Paused ${names.length} containers; volumes preserved.`);
} else if (process.argv[2] === 'restore') {
  if (!existsSync(file)) { console.log('No containers recorded for restoration.'); process.exit(); }
  const names = JSON.parse(readFileSync(file, 'utf8'));
  if (names.length) docker('start', ...names);
  unlinkSync(file);
  console.log(`Restored ${names.length} previously running containers.`);
} else throw new Error('Use pause or restore. This script never deletes containers or volumes.');
