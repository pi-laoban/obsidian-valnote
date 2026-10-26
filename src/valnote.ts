import { RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	type ViewUpdate,
} from '@codemirror/view';
import { evaluateLines, valnoteSpans, type LineValue } from './valnote-eval';

const COPIED_MS = 800;

class ResultWidget extends WidgetType {
	constructor(
		readonly display: string,
		readonly copy: string,
	) {
		super();
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof ResultWidget &&
			other.display === this.display &&
			other.copy === this.copy
		);
	}

	toDOM(): HTMLElement {
		return createResult(this.display, this.copy);
	}
}

function createResult(display: string, copy: string): HTMLElement {
	const wrap = createSpan({ cls: 'valnote-result-wrap' });
	const badge = wrap.createSpan({ cls: 'valnote-result', text: display });
	badge.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void navigator.clipboard.writeText(copy).then(
			() => {
				wrap.querySelector('.valnote-result-copied')?.remove();
				const note = wrap.createSpan({
					cls: 'valnote-result-copied',
					text: 'Copied!',
				});
				window.setTimeout(() => note.remove(), COPIED_MS);
			},
			() => undefined,
		);
	});
	return wrap;
}

function sourceLines(source: string): string[] {
	const text = source.endsWith('\n') ? source.slice(0, -1) : source;
	if (text.length === 0) return [];
	return text.split('\n');
}

export function decorateValnoteReading(root: ParentNode): Promise<void[]> | void {
	const jobs: Promise<void>[] = [];
	root.querySelectorAll('code.language-valnote, pre.language-valnote > code').forEach((code) => {
		if (!code.instanceOf(HTMLElement) || code.dataset.valnoteReady === '1') return;
		jobs.push(
			whenHighlighted(code).then(() => {
				if (code.isConnected) decorateValnoteCode(code);
			}),
		);
	});
	if (jobs.length > 0) return Promise.all(jobs);
}

function whenHighlighted(code: HTMLElement): Promise<void> {
	if (code.hasClass('is-loaded')) return Promise.resolve();
	return new Promise((resolve) => {
		const win = code.win as Window & { MutationObserver: typeof MutationObserver };
		const done = () => {
			observer.disconnect();
			win.clearTimeout(timer);
			resolve();
		};
		const observer = new win.MutationObserver(() => {
			if (code.hasClass('is-loaded')) done();
		});
		// ponytail: 1s cap if Prism never adds is-loaded. Drop the timer if reading view stops highlighting language-* blocks.
		const timer = win.setTimeout(done, 1000);
		observer.observe(code, { attributes: true, attributeFilter: ['class'] });
	});
}

function decorateValnoteCode(code: HTMLElement): void {
	if (code.dataset.valnoteReady === '1') return;
	const source = code.textContent ?? '';
	code.dataset.valnoteReady = '1';
	code.empty();
	const lines = sourceLines(source);
	const values = evaluateLines(lines);
	for (let i = 0; i < lines.length; i++) {
		if (i > 0) code.appendText('\n');
		appendLine(code, lines[i] ?? '', values[i] ?? null);
	}
}

function appendLine(el: HTMLElement, line: string, value: LineValue | null): void {
	const end = value?.exprEnd ?? line.length;
	el.appendText(line.slice(0, end));
	if (value) el.appendChild(createResult(value.display, value.copy));
	const rest = line.slice(end);
	if (rest.length > 0) el.appendText(rest);
}

// ponytail: whole-note rescan on each edit. Invalidate only the edited block if a large note stutters.
function buildDecorations(view: EditorView): DecorationSet {
	const doc = view.state.doc;
	const lines: string[] = [];
	for (let n = 1; n <= doc.lines; n++) lines.push(doc.line(n).text);

	const builder = new RangeSetBuilder<Decoration>();
	for (const span of valnoteSpans(lines)) {
		const values = evaluateLines(lines.slice(span.start, span.end));
		for (let i = 0; i < values.length; i++) {
			const value = values[i];
			if (!value) continue;
			const line = doc.line(span.start + i + 1);
			const pos = Math.min(line.from + value.exprEnd, line.to);
			builder.add(
				pos,
				pos,
				Decoration.widget({
					widget: new ResultWidget(value.display, value.copy),
					side: 1,
				}),
			);
		}
	}
	return builder.finish();
}

export const valnoteExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate): void {
			if (update.docChanged) this.decorations = buildDecorations(update.view);
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);
