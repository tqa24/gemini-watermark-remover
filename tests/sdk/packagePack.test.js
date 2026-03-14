import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const WINDOWS_SHELL = process.env.ComSpec || 'cmd.exe';

function run(command, args, cwd) {
    const result = spawnSync(
        process.platform === 'win32' && command === 'pnpm' ? WINDOWS_SHELL : command,
        process.platform === 'win32' && command === 'pnpm'
            ? ['/d', '/s', '/c', command, ...args]
            : args,
        {
        cwd,
        encoding: 'utf8'
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const details = [result.stdout, result.stderr]
            .filter(Boolean)
            .join('\n')
            .trim();
        throw new Error(details || `${command} failed`);
    }
    return result;
}

test('pnpm pack should publish sdk entrypoints without shipping test fixtures', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wm-pack-'));
    run('pnpm', ['pack', '--pack-destination', tempDir], ROOT_DIR);

    const packedFiles = await readdir(tempDir);
    assert.equal(packedFiles.length, 1, `expected exactly one tarball, got ${packedFiles.join(', ')}`);

    const tarballPath = path.join(tempDir, packedFiles[0]);
    const listing = run('tar', ['-tf', tarballPath], ROOT_DIR).stdout
        .split(/\r?\n/)
        .filter(Boolean);

    assert.ok(listing.includes('package/package.json'));
    assert.ok(listing.includes('package/src/sdk/index.js'));
    assert.ok(listing.includes('package/src/sdk/browser.js'));
    assert.ok(listing.includes('package/src/sdk/image-data.js'));
    assert.ok(listing.includes('package/src/sdk/node.js'));
    assert.ok(listing.includes('package/src/core/watermarkProcessor.js'));
    assert.ok(listing.includes('package/README.md'));
    assert.ok(listing.includes('package/LICENSE'));
    assert.equal(listing.some((item) => item.startsWith('package/tests/')), false);
    assert.equal(listing.some((item) => item.startsWith('package/public/')), false);
    assert.equal(listing.some((item) => item.startsWith('package/src/assets/')), false);
});
