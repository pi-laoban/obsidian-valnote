import { Plugin } from 'obsidian';
import { decorateValnoteCode, valnoteExtension } from './valnote';

export default class ValnotePlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerEditorExtension(valnoteExtension);
		this.registerMarkdownPostProcessor((el) => {
			el.querySelectorAll('code.language-valnote, pre.language-valnote > code').forEach(
				(code) => {
					if (code.instanceOf(HTMLElement)) decorateValnoteCode(code);
				},
			);
		});
	}
}
