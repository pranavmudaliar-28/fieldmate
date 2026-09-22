#!/usr/bin/env node
/**
 * Points the local .env files at this machine's LAN address.
 *
 * The phone reaches the API and the photo storage over Wi-Fi, so both need a
 * real LAN IP rather than localhost. That address changes whenever the machine
 * joins a different network, and a stale one shows up as a phone that loads the
 * app but cannot log in.
 *
 * Run it with `npm run dev:ip`, or pass an address: `npm run dev:ip -- 10.0.0.5`.
 */
import { networkInterfaces } from 'node:os';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Virtual adapters answer first but are unreachable from a phone. */
const VIRTUAL = /^(vEthernet|VirtualBox|VMware|Loopback|Hyper-V|Docker|WSL)/i;

function detectLanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (address.address.startsWith('169.254.')) continue;
      candidates.push({ name, ip: address.address });
    }
  }
  // Prefer Wi-Fi, then anything else that is left.
  return candidates.find((c) => /wi-?fi|wlan/i.test(c.name)) ?? candidates[0];
}

const override = process.argv[2];
const found = override ? { name: 'given', ip: override } : detectLanAddress();

if (!found) {
  console.error(
    'No LAN address found. Connect to a network, or pass one: npm run dev:ip -- 10.0.0.5',
  );
  process.exit(1);
}

const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

/** Rewrites only the host part of URLs, leaving ports and paths alone. */
const files = [
  { path: join(root, 'apps/mobile/.env'), keys: ['EXPO_PUBLIC_API_BASE_URL'] },
  { path: join(root, 'apps/api/.env'), keys: ['FILE_STORAGE_ENDPOINT'] },
];

let changed = 0;
for (const { path, keys } of files) {
  if (!existsSync(path)) {
    console.warn(`skipped ${path} (not found — copy it from .env.example first)`);
    continue;
  }

  const before = readFileSync(path, 'utf8');
  const after = before
    .split('\n')
    .map((line) => {
      const key = line.split('=')[0]?.trim();
      if (!key || !keys.includes(key)) return line;
      return line.replace(IPV4, found.ip);
    })
    .join('\n');

  if (after !== before) {
    writeFileSync(path, after);
    changed += 1;
  }
  for (const key of keys) {
    const value = after.split('\n').find((l) => l.startsWith(`${key}=`));
    if (value) console.log(`  ${value}`);
  }
}

console.log(`\nUsing ${found.ip} (${found.name}).`);
if (changed > 0) {
  console.log('Restart the API and Metro: EXPO_PUBLIC_* values are baked into the bundle.');
} else {
  console.log('Already up to date.');
}
