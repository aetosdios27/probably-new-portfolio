import { test } from 'node:test';
import assert from 'node:assert/strict';
const expect = (actual: unknown) => ({ toEqual: (expected: unknown) => assert.deepEqual(actual, expected), toBe: (expected: unknown) => assert.equal(actual, expected), toBeNull: () => assert.equal(actual, null) });
import { intro, benchmarks, screenshotUrls, readmeLinks } from './extract';

test('intro retains original prose and handles an About heading, badges, and HTML', () => {
  expect(intro('# Title\n\n![badge](https://shield/x.svg)\n\n<p>Original **wording** here.</p>\n\nSecond paragraph.\n\n## Install\n\nDo not extract.')).toEqual(['Original wording here.', 'Second paragraph.']);
  expect(intro('## About\n\nThe original intro.\n\n## Usage\n\nIgnore.')).toEqual(['The original intro.']);
});
test('comparison uses literal same-unit values and the nearest before column', () => {
  const rows = benchmarks('## Performance\n\n| metric | before | after |\n|---|---|---|\n| reads | 280K ops/s | 4.91M ops/s |');
  expect(rows?.[0].delta).toBe(1653.6);
  expect(rows?.[0].baseline).toBe('280K ops/s');
  expect(benchmarks('## Results\n\n| metric | before | after |\n|---|---|---|\n| latency | 1ms | 300us |')?.[0].delta).toBeNull();
});
test('does not treat version numbers, counts or missing measurements as benchmarks', () => {
  expect(benchmarks('## Results\n\n| name | threads |\n|---|---|\n| foo | 32 |\n\n- Node.js 18 is required.')).toBeNull();
  expect(benchmarks('## Results\n\n| name | before | after |\n|---|---|---|\n| foo | 200us | ~110-120us |')).toBeNull();
});
test('ignores numbers quoted outside a performance section', () => {
  expect(benchmarks('## Key Capabilities\n\n- **Zero-Latency Typing:** Sub-10ms editor response.\n\n## Technical Stack\n\n| Component | Technology | Reasoning |\n|---|---|---|\n| Runtime | Tauri | <10MB binary |')).toBeNull();
});
test('filters badges and recognizes GitHub image assets without extensions', () => {
  expect(screenshotUrls('![badge](https://img.shields.io/foo.png)\n![Screenshot](./ui.png)\n<img src="https://github.com/u/r/assets/123/id" />', 'https://raw.githubusercontent.com/u/r/main/README.md')).toEqual(['https://raw.githubusercontent.com/u/r/main/ui.png', 'https://github.com/u/r/assets/123/id']);
  expect(readmeLinks('[Live demo](https://example.com) [Source](https://github.com/u/r)')).toEqual([{ label: 'Live demo', url: 'https://example.com' }]);
});
