import { Plugin } from 'obsidian';
import { renderValnote, valnoteExtension } from './valnote';

export default class ValnotePlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerEditorExtension(valnoteExtension);
		this.registerMarkdownCodeBlockProcessor('valnote', (source, el) => {
			renderValnote(source, el);
		});
	}
}
