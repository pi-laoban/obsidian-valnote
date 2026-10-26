import { Plugin } from 'obsidian';
import { decorateValnoteReading, valnoteExtension } from './valnote';

export default class ValnotePlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerEditorExtension(valnoteExtension);
		// Prism rewrites language-* blocks at sort order 100.
		this.registerMarkdownPostProcessor((el) => decorateValnoteReading(el), 101);
	}
}
