import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const file = 'supabase/.temp/paused-containers.json';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
if (process.argv[2] === 'pause') {
  if (existsSync(file)) throw new Error('A pause record exists. Restore it before pausing again.');
  const projects = process.argv.slice(3);
  if (!projects.length || projects.some((name) => !/^[a-zA-Z0-9_-]+$/.test(name) || name === 'tinir')) throw new Error('Pass the other Supabase project IDs to pause; Tinir cannot be selected.');
  const names = docker('ps', '--format', '{{.Names}}').split('\n').filter((name) => name.startsWith('supabase_') && projects.some((project) => name.endsWith(`_${project}`)));
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
