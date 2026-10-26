import { all, create, type MathJsInstance } from 'mathjs';

export type LineValue = {
	exprEnd: number;
	display: string;
	copy: string;
};

export type LineSpan = {
	start: number;
	end: number;
};

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// Scientific notation only outside 1e-6..1e8, matching Heynote's defaults.
const DISPLAY_FORMAT = { precision: 8, upperExp: 8, lowerExp: -6 };

let math: MathJsInstance | undefined;

function getMath(): MathJsInstance {
	if (math) return math;
	if (!all) throw new Error('mathjs is unavailable');
	math = create(all);
	return math;
}

export function expressionEnd(line: string): number {
	let quote = '';
	for (let i = 0; i < line.length; i++) {
		const c = line.charAt(i);
		if (quote) {
			if (c === '\\') {
				i++;
				continue;
			}
			if (c === quote) quote = '';
			continue;
		}
		if (c === '"' || c === "'") {
			quote = c;
			continue;
		}
		if (c === '#') return i;
	}
	return line.length;
}

function fenceLanguage(info: string): string {
	return info.trim().split(/\s+/, 1)[0] ?? '';
}

function closesFence(open: string, close: string, info: string): boolean {
	return (
		info.trim() === '' &&
		close.length >= open.length &&
		close.charAt(0) === open.charAt(0)
	);
}

// An unclosed fence is not a block. A stray opener must not decorate the rest of the note.
export function valnoteSpans(lines: readonly string[]): LineSpan[] {
	const spans: LineSpan[] = [];
	let marker = '';
	let contentStart = 0;
	for (let i = 0; i < lines.length; i++) {
		const match = FENCE.exec(lines[i] ?? '');
		if (!match) continue;
		const ticks = match[1] ?? '';
		const info = match[2] ?? '';
		if (!marker) {
			if (fenceLanguage(info) === 'valnote') {
				marker = ticks;
				contentStart = i + 1;
			}
			continue;
		}
		if (closesFence(marker, ticks, info)) {
			spans.push({ start: contentStart, end: i });
			marker = '';
		}
	}
	return spans;
}

function formatResult(result: unknown): { display: string; copy: string } {
	if (typeof result === 'string') return { display: result, copy: result };
	const lib = getMath();
	const display = lib.format(result, DISPLAY_FORMAT);
	try {
		return { display, copy: lib.format(result, { notation: 'fixed' }) };
	} catch {
		return { display, copy: display };
	}
}

export function evaluateLines(lines: readonly string[]): Array<LineValue | null> {
	const parser = getMath().parser();
	let prev: unknown;
	let hasPrev = false;
	return lines.map((line) => {
		const exprEnd = expressionEnd(line);
		if (exprEnd === 0) return null;
		try {
			if (hasPrev) parser.set('prev', prev);
			const result = parser.evaluate(line) as unknown;
			if (result === undefined) return null;
			const formatted = formatResult(result);
			prev = result;
			hasPrev = true;
			return { exprEnd, display: formatted.display, copy: formatted.copy };
		} catch {
			return null;
		}
	});
}
