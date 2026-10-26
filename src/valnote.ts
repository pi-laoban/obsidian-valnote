import { RangeSetBuilder, type EditorState } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	type ViewUpdate,
} from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import {
	evaluateLines,
	valnoteSpans,
	type LineSpan,
	type LineValue,
} from './valnote-eval';

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

export function renderValnote(source: string, el: HTMLElement): void {
	el.empty();
	el.addClass('valnote-block');
	const lines = sourceLines(source);
	const values = evaluateLines(lines);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const value = values[i] ?? null;
		appendLine(el, line, value);
	}
}

function appendLine(el: HTMLElement, line: string, value: LineValue | null): void {
	const row = el.createDiv({ cls: 'valnote-line' });
	const end = value?.exprEnd ?? line.length;
	row.createSpan({ text: line.slice(0, end) });
	if (value) row.appendChild(createResult(value.display, value.copy));
	const rest = line.slice(end);
	if (rest.length > 0) row.createSpan({ text: rest });
}

// ponytail: whole-note rescan on each edit. Invalidate only the edited block if a large note stutters.
function buildDecorations(view: EditorView): DecorationSet {
	const doc = view.state.doc;
	const lines: string[] = [];
	for (let n = 1; n <= doc.lines; n++) lines.push(doc.line(n).text);

	const live = view.state.field(editorLivePreviewField, false) === true;
	const builder = new RangeSetBuilder<Decoration>();
	for (const span of valnoteSpans(lines)) {
		if (live && !selectionInside(view.state, span)) continue;
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
			const live = update.state.field(editorLivePreviewField, false) === true;
			const liveChanged =
				live !== (update.startState.field(editorLivePreviewField, false) === true);
			if (update.docChanged || liveChanged || (live && update.selectionSet)) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (plugin) => plugin.decorations },
);

function selectionInside(state: EditorState, span: LineSpan): boolean {
	const doc = state.doc;
	// span.start is the opener's 1-based line. span.end is the closer's 0-based index.
	const from = doc.line(span.start).from;
	const to = doc.line(span.end + 1).to;
	return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}
