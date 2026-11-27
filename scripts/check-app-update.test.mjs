import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../public/app-update.js', import.meta.url), 'utf8');
const old = 'a'.repeat(40), latest = 'b'.repeat(40);
async function simulate({ version = latest, release = old, editing = false, href = 'https://example.test/?install=1', offline = false } = {}) {
  const events = {}, navigations = [], requests = [];
  const doc = { hidden: false, baseURI: 'https://example.test/', querySelector: s => s.startsWith('meta') ? { content: release } : editing ? {} : null, querySelectorAll: () => [], addEventListener: (name, fn) => events[name] = fn };
  runInNewContext(source, { document: doc, window: { addEventListener: (name,fn) => events[name] = fn }, location: { href, replace: url => navigations.push(url) }, fetch: async (url, opts) => { requests.push(opts.cache); if (offline) throw Error('offline'); return { ok: true, json: async () => ({ version }) }; }, URL, Date, setInterval: () => 0 });
  await new Promise(resolve => setImmediate(resolve));
  return { navigations, requests, events };
}
test('new release loads automatically preserving existing query', async () => { const r = await simulate(); assert.equal(r.navigations[0], 'https://example.test/?install=1&__release=' + latest); assert.deepEqual(r.requests,['no-store']); });
test('unchanged release does not reload', async () => assert.equal((await simulate({version:old})).navigations.length,0));
test('open editor is not interrupted', async () => assert.equal((await simulate({editing:true})).requests.length,0));
test('offline remains usable', async () => assert.equal((await simulate({offline:true})).navigations.length,0));
test('stale response does not trigger a redirect loop', async () => assert.equal((await simulate({href:'https://example.test/?__release='+latest})).navigations.length,0));
test('development and preview are not redirected', async () => assert.equal((await simulate({release:'development'})).requests.length,0));
