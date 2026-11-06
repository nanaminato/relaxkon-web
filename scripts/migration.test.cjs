const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname, '..');
const read = path => readFileSync(join(root, path), 'utf8');
const json = path => JSON.parse(read(path));

test('npm package and lockfile use the same Relaxkon identity without publishing', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  assert.equal(pkg.name, 'relaxkon-web');
  assert.equal(pkg.private, true);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
});

test('production and development API addresses remain deployment-compatible', () => {
  assert.match(read('src/environments/environment.prod.ts'), /apiUrl:\s*['"]\/['"]/);
  assert.match(read('src/environments/environment.ts'), /apiUrl:\s*['"]http:\/\/localhost:5111\/['"]/);
  assert.match(read('src/services/normal-services/feature-access.service.ts'), /api\/feature-access/);
});

test('existing Angular build target, output path and production replacement survive', () => {
  const project = json('angular.json').projects.app;
  assert.equal(project.architect.build.options.outputPath, 'dist/app');
  assert.equal(project.architect.serve.configurations.production.buildTarget, 'app:build:production');
  assert.ok(project.architect.build.configurations.production.fileReplacements.some(
    entry => entry.replace === 'src/environments/environment.ts' && entry.with === 'src/environments/environment.prod.ts'));
});

test('PWA branding changes without changing installed-app identity or scope', () => {
  const manifest = json('src/manifest.webmanifest');
  assert.equal(manifest.name, 'Relaxkon');
  assert.equal(manifest.short_name, 'Relaxkon');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, undefined); // Existing installs use start_url as identity.
  assert.match(read('src/index.html'), /<title>Relaxkon<\/title>/);
});

test('browser database, in-flight image receipts and exported settings retain legacy identifiers', () => {
  assert.match(read('src/services/db-services/db.service.ts'), /factory:\s*\(\) => 'chatDb-v1'/);
  assert.match(read('src/pages/imageStudio/apimart-image/apimart-image.component.ts'), /'turbo-apimart-receipt:'/);
  assert.match(read('src/pages/settings/config-export/config-export.ts'), /export const turboMask = "Turbo:\/\/"/);
  assert.match(read('src/pages/settings/config-import/config-import.ts'), /this\.json\.startsWith\(turboMask\)/);
});

test('one frontend still hosts user and administrator routes', () => {
  const routes = read('src/app/app.routes.ts');
  for (const route of ['chat', 'accounts', 'admin', 'image-studio', 'media-studio']) {
    assert.match(routes, new RegExp(`path: '${route}'`));
  }
  for (const template of ['src/pages/chat-page/chat-page.html', 'src/admin/pages/admin.component.html', 'src/pages/accounts/account/account.html']) {
    assert.match(read(template), /Relaxkon/);
    assert.doesNotMatch(read(template), /Turbo AI/);
  }
});
