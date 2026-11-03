const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' ? Object.entries(flatten(child, `${prefix}${key}.`)) : [[prefix + key, child]]));
}
const dictionaries = Object.fromEntries(['zh', 'en', 'jp'].map(lang => [lang,
  flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '../src/assets/i18n', `${lang}.json`), 'utf8')))]));
const placeholders = text => [...text.matchAll(/{{\s*([^}]+?)\s*}}/g)].map(match => match[1]).sort();

for (const lang of ['en', 'jp']) {
  test(`${lang} has every translation key and matching interpolation parameters`, () => {
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), Object.keys(dictionaries.zh).sort());
    for (const [key, value] of Object.entries(dictionaries.zh)) {
      assert.ok(dictionaries[lang][key].trim(), `${lang}: empty ${key}`);
      assert.deepEqual(placeholders(dictionaries[lang][key]), placeholders(value), `${lang}: ${key}`);
    }
  });
}

function* sources(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* sources(file);
    else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) yield file;
  }
}
test('literal translation references exist in all languages', () => {
  for (const file of sources(path.join(__dirname, '../src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const references = [...source.matchAll(/['"]([\w.-]+)['"]\s*\|\s*translate\b/g),
      ...source.matchAll(/(?:\.text|\.instant)\(\s*['"]([\w.-]+)['"]/g)];
    for (const expression of source.matchAll(/(?:="([^"\n]*\|\s*translate[^"\n]*)"|{{([^}]*\|\s*translate[^}]*)}})/g)) {
      // Comparison operands and a dynamic key prefix are not complete translation keys.
      const value = (expression[1] || expression[2]).replace(/(?:===|!==|==|!=)\s*['"][\w.-]+['"]/g, '');
      for (const match of value.matchAll(/['"]([\w.-]+)['"]/g)) {
        if (!value.slice(match.index + match[0].length).trimStart().startsWith('+')) references.push(match);
      }
    }
    for (const [, key] of references) {
      for (const lang of Object.keys(dictionaries)) assert.ok(key in dictionaries[lang], `${file}: ${lang} missing ${key}`);
    }
  }
});

test('English translations contain no untranslated Chinese or Japanese text', () => {
  for (const [key, text] of Object.entries(dictionaries.en)) {
    assert.ok(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text), `en: ${key}`);
  }
});

test('image parameter option values have translated labels in every language', () => {
  const ts = require('typescript');
  const options = new Set(['backgrounds', 'moderations', 'qualities', 'styles', 'image_response_formats']);
  for (const relative of ['gpt-image/gpt-image-create.component.ts', 'apimart-image/apimart-image.component.ts']) {
    const file = path.join(__dirname, '../src/pages/imageStudio', relative);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      const name = ts.isPropertyDeclaration(node) ? node.name.getText(source)
        : ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) ? node.left.name.text : '';
      const value = ts.isPropertyDeclaration(node) ? node.initializer
        : ts.isBinaryExpression(node) ? node.right : undefined;
      if (options.has(name) && value && ts.isArrayLiteralExpression(value)) {
        for (const option of value.elements) {
          if (ts.isStringLiteral(option)) for (const lang of Object.keys(dictionaries)) {
            assert.ok(`imageOptions.${option.text}` in dictionaries[lang], `${relative}: ${lang} missing label for ${option.text}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test('translation dictionaries do not contain duplicate keys that shadow previous text', () => {
  const ts = require('typescript');
  for (const lang of Object.keys(dictionaries)) {
    const file = path.join(__dirname, '../src/assets/i18n', `${lang}.json`);
    const syntax = ts.parseJsonText(file, fs.readFileSync(file, 'utf8'));
    function visit(node) {
      if (ts.isObjectLiteralExpression(node)) {
        const keys = new Set();
        for (const property of node.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key = property.name.text;
          assert.ok(!keys.has(key), `${lang}: duplicate key ${key}`);
          keys.add(key);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(syntax);
  }
});
