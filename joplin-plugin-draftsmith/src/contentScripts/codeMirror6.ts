import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin } from '@codemirror/view';

type HighlightPattern = {
	id: string;
	label: string;
	regex: string;
	enabled: boolean;
	background: string;
	foreground: string;
	count: boolean;
	isMarker?: boolean;
};

type PluginConfig = {
	version: number;
	patterns: HighlightPattern[];
};

const EDITOR_SET_CONFIG_COMMAND = 'draftSmith__setConfig';

const fallbackConfig: PluginConfig = {
	version: 1,
	patterns: [
		{ id: 'GAP', label: 'GAP', regex: String.raw`\[GAP(?::[^\]\n]*)?\]`, enabled: true, background: '#ffd6d6', foreground: '#5f0000', count: true },
		{ id: 'ALT', label: 'ALT', regex: String.raw`\[ALT(?::[^\]\n]*)?\]`, enabled: true, background: '#d7e7ff', foreground: '#003a75', count: true },
		{ id: 'FIX', label: 'FIX', regex: String.raw`\[FIX(?::[^\]\n]*)?\]`, enabled: true, background: '#ffe0bf', foreground: '#6b3500', count: true },
		{ id: 'CHAR', label: 'CHAR', regex: String.raw`\[CHAR(?::[^\]\n]*)?\]`, enabled: true, background: '#ecd8ff', foreground: '#4a1175', count: true },
		{ id: 'FACT', label: 'FACT', regex: String.raw`\[FACT(?::[^\]\n]*)?\]`, enabled: true, background: '#fff1a8', foreground: '#5a4500', count: true },
		{ id: 'CUT?', label: 'CUT?', regex: String.raw`\[CUT\?(?::[^\]\n]*)?\]`, enabled: true, background: '#dedede', foreground: '#303030', count: true },
		{ id: 'KEEP', label: 'KEEP', regex: String.raw`\[KEEP(?::[^\]\n]*)?\]`, enabled: true, background: '#d8f5d0', foreground: '#155800', count: true },
	],
};

function normalizeConfig(input: any): PluginConfig {
	if (!input || !Array.isArray(input.patterns)) return fallbackConfig;
	return {
		version: 1,
		patterns: input.patterns
			.filter((p: any) => p && typeof p.regex === 'string')
			.map((p: any) => ({
				id: String(p.id || p.label || p.regex),
				label: String(p.label || p.id || p.regex),
				regex: String(p.regex),
				enabled: !!p.enabled,
				background: String(p.background || '#fff0b3'),
				foreground: String(p.foreground || '#000000'),
				count: p.count !== false,
				isMarker: !!p.isMarker,
			})),
	};
}

function safeCssColor(value: string, fallback: string): string {
	const s = String(value || '').trim();
	if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
	if (/^var\(\s*--[a-zA-Z0-9_-]+(?:\s*,\s*(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+))?\s*\)$/.test(s)) return s;
	return fallback;
}

function safeStyle(pattern: HighlightPattern): string {
	const background = safeCssColor(pattern.background, '#fff0b3');
	const foreground = safeCssColor(pattern.foreground, '#000000');
	return [
		`background-color: ${background} !important`,
		`color: ${foreground} !important`,
		'text-decoration: none !important',
		'text-decoration-line: none !important',
		'border-radius: 3px',
		'padding: 0 1px',
		'box-shadow: inset 0 0 0 1px rgba(0,0,0,.10)',
	].join('; ');
}

const setConfigEffect = StateEffect.define<PluginConfig>();

const configField = StateField.define<PluginConfig>({
	create() {
		return fallbackConfig;
	},
	update(value, transaction) {
		for (const effect of transaction.effects) {
			if (effect.is(setConfigEffect)) return normalizeConfig(effect.value);
		}
		return value;
	},
});

function buildDecorations(state: EditorState): DecorationSet {
	const config = state.field(configField, false) || fallbackConfig;
	const text = state.doc.toString();
	const ranges: Array<{ from: number; to: number; deco: Decoration }> = [];

	for (const pattern of config.patterns) {
		if (!pattern.enabled) continue;
		let regex: RegExp;
		try {
			regex = new RegExp(pattern.regex, 'g');
		} catch (error) {
			continue;
		}

		let match: RegExpExecArray | null;
		while ((match = regex.exec(text)) !== null) {
			const matched = match[0];
			if (!matched.length) {
				regex.lastIndex++;
				continue;
			}
			ranges.push({
				from: match.index,
				to: match.index + matched.length,
				deco: Decoration.mark({
					class: `draftsmith-highlight draftsmith-${pattern.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
					attributes: {
						style: safeStyle(pattern),
						title: pattern.label,
					},
				}),
			});
		}
	}

	ranges.sort((a, b) => a.from - b.from || a.to - b.to);
	const builder = new RangeSetBuilder<Decoration>();
	let lastFrom = -1;
	let lastTo = -1;
	for (const range of ranges) {
		if (range.from === lastFrom && range.to === lastTo) continue;
		builder.add(range.from, range.to, range.deco);
		lastFrom = range.from;
		lastTo = range.to;
	}
	return builder.finish();
}

const decorationsField = StateField.define<DecorationSet>({
	create(state) {
		return buildDecorations(state);
	},
	update(value, transaction) {
		const configChanged = transaction.effects.some(effect => effect.is(setConfigEffect));
		if (transaction.docChanged || configChanged) {
			return buildDecorations(transaction.state);
		}
		return value.map(transaction.changes);
	},
	provide: field => EditorView.decorations.from(field),
});

const highlighterTheme = EditorView.baseTheme({
	'.draftsmith-highlight': {
		color: 'inherit !important',
		textDecoration: 'none !important',
		textDecorationLine: 'none !important',
	},
	'.draftsmith-highlight *': {
		color: 'inherit !important',
		textDecoration: 'none !important',
		textDecorationLine: 'none !important',
	},
	'.cm-line .draftsmith-highlight.cm-link, .cm-line .draftsmith-highlight .cm-link': {
		color: 'inherit !important',
		textDecoration: 'none !important',
		textDecorationLine: 'none !important',
	},
});

function makeConfigSyncPlugin(context: { contentScriptId: string; postMessage: any }) {
	return ViewPlugin.fromClass(class {
		private view: EditorView;
		private timer: any = null;
		private lastConfigJson = '';
		private focusHandler: () => void;
		private requestInFlight = false;

		constructor(view: EditorView) {
			this.view = view;
			this.focusHandler = () => { void this.requestConfig(true); };
			this.view.dom.addEventListener('focusin', this.focusHandler);
			void this.requestConfig(true);

			this.timer = setInterval(() => {
				if (!this.view.dom.isConnected) {
					clearInterval(this.timer);
					this.timer = null;
					return;
				}
				void this.requestConfig(false);
			}, 1000);
		}

		async requestConfig(force: boolean) {
			if (this.requestInFlight) return;
			this.requestInFlight = true;
			try {
				const config = normalizeConfig(await context.postMessage({ type: 'getConfig' }));
				const configJson = JSON.stringify(config);
				if (force || configJson !== this.lastConfigJson) {
					this.lastConfigJson = configJson;
					this.view.dispatch({ effects: setConfigEffect.of(config) });
				}
			} catch (error) {
				console.warn('DraftSmith: Could not refresh config.', error);
			} finally {
				this.requestInFlight = false;
			}
		}

		destroy() {
			if (this.timer) clearInterval(this.timer);
			this.view.dom.removeEventListener('focusin', this.focusHandler);
		}
	});
}

export default (context: { contentScriptId: string; postMessage: any }) => {
	return {
		plugin: async (codeMirrorWrapper: any) => {
			const editor: EditorView | undefined = codeMirrorWrapper?.editor || codeMirrorWrapper?.cm6;
			if (!editor || typeof editor.dispatch !== 'function') return;

			codeMirrorWrapper.addExtension([
				configField,
				decorationsField,
				highlighterTheme,
				makeConfigSyncPlugin(context),
			]);

			codeMirrorWrapper.registerCommand(EDITOR_SET_CONFIG_COMMAND, (config: PluginConfig) => {
				const latestEditor: EditorView | undefined = codeMirrorWrapper?.editor || codeMirrorWrapper?.cm6;
				if (!latestEditor || typeof latestEditor.dispatch !== 'function') return;
				latestEditor.dispatch({ effects: setConfigEffect.of(normalizeConfig(config)) });
			});

			try {
				const config = await context.postMessage({ type: 'getConfig' });
				editor.dispatch({ effects: setConfigEffect.of(normalizeConfig(config)) });
			} catch (error) {
				console.warn('DraftSmith: Could not load config.', error);
			}
		},
	};
};
