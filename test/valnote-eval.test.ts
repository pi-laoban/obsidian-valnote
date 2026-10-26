import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateLines, expressionEnd, valnoteSpans } from '../src/valnote-eval';

describe('evaluateLines', () => {
	it('evaluates arithmetic and mod', () => {
		const lines = evaluateLines(['1 + 1', '120321 mod 2', '1 - 1']);
		assert.equal(lines[0]?.display, '2');
		assert.equal(lines[1]?.display, '1');
		assert.equal(lines[2]?.display, '0');
	});

	it('keeps prev across blank, comment, and broken lines', () => {
		const lines = evaluateLines(['1336', '23 /', '# comment', '   ', 'test', 'prev+1']);
		assert.equal(lines[0]?.display, '1336');
		assert.equal(lines[1], null);
		assert.equal(lines[2], null);
		assert.equal(lines[3], null);
		assert.equal(lines[4], null);
		assert.equal(lines[5]?.display, '1337');
	});

	it('remembers assignments inside one block only', () => {
		const first = evaluateLines(['a = 2', 'a + 3']);
		const second = evaluateLines(['a + 1']);
		assert.equal(first[1]?.display, '5');
		assert.equal(second[0], null);
	});

	it('copies fixed notation and displays the short form', () => {
		const line = evaluateLines(['1/3'])[0];
		assert.equal(line?.display, '0.33333333');
		assert.equal(line?.copy, '0.3333333333333333');
	});
});

describe('expressionEnd', () => {
	it('keeps trailing spaces in front of the result mark', () => {
		assert.equal(expressionEnd('1 + 1   '), '1 + 1   '.length);
		assert.equal(expressionEnd('prev * 2 # 256'), 'prev * 2 '.length);
		assert.equal(expressionEnd('# only'), 0);
	});

	it('ignores a hash inside a string', () => {
		assert.equal(expressionEnd('"a # b"'), '"a # b"'.length);
		assert.equal(expressionEnd('"a\\" # b"'), '"a\\" # b"'.length);
	});
});

describe('valnoteSpans', () => {
	it('reads closed fences and ignores an unclosed opener', () => {
		assert.deepEqual(valnoteSpans(['```valnote', '1 + 1', '```']), [{ start: 1, end: 2 }]);
		assert.deepEqual(valnoteSpans(['```valnote', '1 + 1']), []);
		assert.deepEqual(valnoteSpans(['```valnote', '1', '```js']), []);
	});

	it('accepts tildes, indent, and a longer opener', () => {
		assert.deepEqual(valnoteSpans(['~~~valnote', '1', '~~~']), [{ start: 1, end: 2 }]);
		assert.deepEqual(valnoteSpans(['   ```valnote extra', '1 + 1', '   ```']), [
			{ start: 1, end: 2 },
		]);
		assert.deepEqual(valnoteSpans(['````valnote', '```', '1 + 1', '````']), [
			{ start: 1, end: 3 },
		]);
		assert.deepEqual(valnoteSpans(['```valnote-x', '1', '```']), []);
	});

	it('keeps two blocks apart', () => {
		assert.deepEqual(
			valnoteSpans(['```valnote', '1 + 1', '```', 'text', '```valnote', '2 + 2', '```']),
			[
				{ start: 1, end: 2 },
				{ start: 5, end: 6 },
			],
		);
	});
});
