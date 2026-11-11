import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePageSelection, presetPages } from '../page-ranges.js';
test('extract in chosen order', () => assert.deepEqual(parsePageSelection('3, 1-2, 5', 5), [2,0,1,4]));
test('preserve duplicates', () => assert.deepEqual(parsePageSelection('2, 2, 2', 3), [1,1,1]));
test('only valid range bounds', () => {
  for (const str of ['0', '4', '2-4', '3-1', '1,,2', 'one', '1;2', '']) assert.throws(() => parsePageSelection(str, 3));
});
test('single page and spacing', () => assert.deepEqual(parsePageSelection(' 1 - 2 , 4 ', 4), [0,1,3]));
test('presets', () => {
  assert.equal(presetPages('all', 4), '1-4');
  assert.equal(presetPages('odd', 5), '1, 3, 5');
  assert.equal(presetPages('even', 5), '2, 4');
  assert.equal(presetPages('last', 5), '5');
});
