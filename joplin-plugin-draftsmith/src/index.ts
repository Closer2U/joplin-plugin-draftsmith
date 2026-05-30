import joplin from 'api';
import { ContentScriptType, MenuItemLocation, SettingItemType, ToolbarButtonLocation } from 'api/types';

type HighlightPattern = {
	id: string;
	label: string;
	description?: string;
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

type Counts = Record<string, number>;
type PatternSettingField = 'enabled' | 'background' | 'foreground';

const SECTION = 'draftSmith';
const PATTERNS_SETTING = 'patternsJson';
const PANEL_VISIBLE_SETTING = 'panelVisible';
const CONTENT_SCRIPT_ID = 'draftSmithCodeMirror6';
const EDITOR_SET_CONFIG_COMMAND = 'draftSmith__setConfig';
const SYNC_NOTE_TITLE = 'DraftSmith Settings';
const SYNC_NOTE_REF_SETTING = 'syncNoteRef';

let panelHandle: string | null = null;
let internalSettingsUpdate = false;
let panelStatusMessage = '';
const registeredSettingKeys = new Set<string>();

const defaultPatterns = (): HighlightPattern[] => [
	{ id: 'GAP', label: 'GAP', description: 'missing material or hole', regex: String.raw`\[GAP(?::[^\]\n]*)?\]`, enabled: true, background: '#ffd6d6', foreground: '#5f0000', count: true },
	{ id: 'ALT', label: 'ALT', description: 'undecided wording/synonym', regex: String.raw`\[ALT(?::[^\]\n]*)?\]`, enabled: true, background: '#d7e7ff', foreground: '#003a75', count: true },
	{ id: 'FIX', label: 'FIX', description: 'broken syntax or sentence repair', regex: String.raw`\[FIX(?::[^\]\n]*)?\]`, enabled: true, background: '#ffe0bf', foreground: '#6b3500', count: true },
	{ id: 'CHAR', label: 'CHAR', description: 'motivation, voice, or subtext', regex: String.raw`\[CHAR(?::[^\]\n]*)?\]`, enabled: true, background: '#ecd8ff', foreground: '#4a1175', count: true },
	{ id: 'FACT', label: 'FACT', description: 'continuity, canon, or research', regex: String.raw`\[FACT(?::[^\]\n]*)?\]`, enabled: true, background: '#fff1a8', foreground: '#5a4500', count: true },
	{ id: 'CUT?', label: 'CUT?', description: 'probably removable', regex: String.raw`\[CUT\?(?::[^\]\n]*)?\]`, enabled: true, background: '#dedede', foreground: '#303030', count: true },
	{ id: 'KEEP', label: 'KEEP', description: 'rough but alive', regex: String.raw`\[KEEP(?::[^\]\n]*)?\]`, enabled: true, background: '#d8f5d0', foreground: '#155800', count: true },
	{ id: 'TODO', label: 'TODO', description: 'general task/reminder', regex: String.raw`\[TODO(?::[^\]\n]*)?\]`, enabled: false, background: '#c9f7ff', foreground: '#00505c', count: true },
	{ id: 'S', label: 'Triage [S]/[+]', description: 'salvage: works, improve prose', regex: String.raw`\[(?:S|\+)\]`, enabled: false, background: '#e1f7d5', foreground: '#245400', count: true, isMarker: true },
	{ id: 'R', label: 'Triage [R]/[·]', description: 'rewrite: idea needed, wording fails', regex: String.raw`\[(?:R|·)\]`, enabled: false, background: '#f4dcff', foreground: '#5b006f', count: true, isMarker: true },
	{ id: 'C', label: 'Triage [C]/[-]', description: 'cut: likely unnecessary', regex: String.raw`\[(?:C|-)\]`, enabled: false, background: '#e0e0e0', foreground: '#303030', count: true, isMarker: true },
	{ id: 'M', label: 'Triage [M]/[^]', description: 'move: belongs elsewhere', regex: String.raw`\[(?:M|\^)\]`, enabled: false, background: '#dff2ff', foreground: '#004563', count: true, isMarker: true },
];

const defaultConfig = (): PluginConfig => ({ version: 1, patterns: defaultPatterns() });

function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attrEncode(value: unknown): string {
	return escapeHtml(encodeURIComponent(String(value ?? '')));
}

function tagToRegex(tag: string): string {
	return `\\[${escapeRegex(tag)}(?::[^\\]\\n]*)?\\]`;
}

function safeSettingSegment(id: string): string {
	return id.replace(/\?/g, 'Q').replace(/[^a-zA-Z0-9_]/g, '_');
}

function patternSettingKey(id: string, field: PatternSettingField): string {
	return `pattern_${safeSettingSegment(id)}_${field}`;
}

function normalizeColor(value: unknown, fallback: string): string {
	const s = String(value || '').trim();
	if (/^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{8}$/.test(s)) return s;
	// Allow safe CSS custom properties such as var(--joplin-code) or var(--joplin-code, #fff).
	// This keeps settings flexible while avoiding arbitrary inline CSS injection.
	if (/^var\(\s*--[a-zA-Z0-9_-]+(?:\s*,\s*(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+))?\s*\)$/.test(s)) return s;
	return fallback;
}

function normalizeTagName(raw: unknown): string {
	return String(raw || '')
		.trim()
		.replace(/^\[|\]$/g, '')
		.replace(/:.*$/, '')
		.replace(/[^a-zA-Z0-9_? -]/g, '')
		.trim();
}

function normalizeConfig(config: any): PluginConfig {
	const defaults = defaultConfig();
	const byId: Record<string, HighlightPattern> = {};
	for (const pattern of defaults.patterns) byId[pattern.id] = pattern;

	const inputPatterns = Array.isArray(config?.patterns) ? config.patterns : [];
	for (const raw of inputPatterns) {
		if (!raw || typeof raw !== 'object') continue;
		const id = String(raw.id || raw.label || '').trim();
		if (!id) continue;
		const existing = byId[id] || {
			id,
			label: id,
			description: 'custom bracket tag',
			regex: tagToRegex(id),
			enabled: true,
			background: '#fff0b3',
			foreground: '#3d3000',
			count: true,
		};
		byId[id] = {
			...existing,
			...raw,
			id,
			label: String(raw.label || existing.label || id),
			description: String(raw.description || existing.description || 'custom bracket tag'),
			regex: String(raw.regex || existing.regex || tagToRegex(id)),
			enabled: !!raw.enabled,
			background: normalizeColor(raw.background, existing.background || '#fff0b3'),
			foreground: normalizeColor(raw.foreground, existing.foreground || '#000000'),
			count: raw.count !== false,
			isMarker: !!(raw.isMarker ?? existing.isMarker),
		};
		// Migrate older built-in triage marker regexes to include aliases while keeping user colors/toggles.
		if (['S', 'R', 'C', 'M'].includes(id) && ['\\[S\\]', '\\[R\\]', '\\[C\\]', '\\[M\\]'].includes(String(raw.regex || ''))) {
			byId[id].regex = existing.regex;
			byId[id].label = existing.label;
			byId[id].description = existing.description;
		}
	}

	const orderedIds = [
		...defaults.patterns.map(p => p.id),
		...Object.keys(byId).filter(id => !defaults.patterns.find(p => p.id === id)),
	];

	return { version: 1, patterns: orderedIds.map(id => byId[id]).filter(Boolean) };
}

async function getRawConfigFromSetting(): Promise<PluginConfig> {
	const raw = await joplin.settings.value(PATTERNS_SETTING) as string;
	try {
		if (!raw || !raw.trim()) throw new Error('Empty pattern JSON');
		return normalizeConfig(JSON.parse(raw));
	} catch (error) {
		console.warn('DraftSmith: Could not parse pattern JSON; restoring defaults.', error);
		const fallback = defaultConfig();
		await joplin.settings.setValue(PATTERNS_SETTING, JSON.stringify(fallback, null, 2));
		return fallback;
	}
}

async function safeSettingValue(key: string, fallback: unknown): Promise<unknown> {
	try {
		return await joplin.settings.value(key);
	} catch (error) {
		return fallback;
	}
}

async function getConfig(): Promise<PluginConfig> {
	const config = await getRawConfigFromSetting();
	for (const pattern of config.patterns) {
		const enabledKey = patternSettingKey(pattern.id, 'enabled');
		const backgroundKey = patternSettingKey(pattern.id, 'background');
		const foregroundKey = patternSettingKey(pattern.id, 'foreground');
		if (!registeredSettingKeys.has(enabledKey)) continue;
		pattern.enabled = !!(await safeSettingValue(enabledKey, pattern.enabled));
		pattern.background = normalizeColor(await safeSettingValue(backgroundKey, pattern.background), pattern.background);
		pattern.foreground = normalizeColor(await safeSettingValue(foregroundKey, pattern.foreground), pattern.foreground);
	}
	return config;
}

async function registerPatternSettings(patterns: HighlightPattern[]) {
	const settings: Record<string, any> = {};
	for (const pattern of patterns) {
		const enabledKey = patternSettingKey(pattern.id, 'enabled');
		const backgroundKey = patternSettingKey(pattern.id, 'background');
		const foregroundKey = patternSettingKey(pattern.id, 'foreground');
		if (!registeredSettingKeys.has(enabledKey)) {
			settings[enabledKey] = {
				section: SECTION,
				value: pattern.enabled,
				type: SettingItemType.Bool,
				public: true,
				label: `${pattern.label}: highlight enabled`,
				description: pattern.description || 'custom bracket tag',
			};
		}
		if (!registeredSettingKeys.has(backgroundKey)) {
			settings[backgroundKey] = {
				section: SECTION,
				value: pattern.background,
				type: SettingItemType.String,
				public: true,
				label: `${pattern.label}: background color`,
				description: 'Hex color or safe CSS variable, for example #ffd6d6 or var(--joplin-code).',
			};
		}
		if (!registeredSettingKeys.has(foregroundKey)) {
			settings[foregroundKey] = {
				section: SECTION,
				value: pattern.foreground,
				type: SettingItemType.String,
				public: true,
				label: `${pattern.label}: text color`,
				description: 'Hex color or safe CSS variable, for example #5f0000 or var(--joplin-color).',
			};
		}
	}

	const keys = Object.keys(settings);
	if (!keys.length) return;
	await joplin.settings.registerSettings(settings);
	for (const key of keys) registeredSettingKeys.add(key);
}

async function writeConfigToPatternSettings(config: PluginConfig) {
	await registerPatternSettings(config.patterns);
	for (const pattern of config.patterns) {
		await joplin.settings.setValue(patternSettingKey(pattern.id, 'enabled'), !!pattern.enabled);
		await joplin.settings.setValue(patternSettingKey(pattern.id, 'background'), normalizeColor(pattern.background, '#fff0b3'));
		await joplin.settings.setValue(patternSettingKey(pattern.id, 'foreground'), normalizeColor(pattern.foreground, '#000000'));
	}
}

async function writeJsonFromPatternSettings() {
	const config = await getConfig();
	await registerPatternSettings(config.patterns);
	await joplin.settings.setValue(PATTERNS_SETTING, JSON.stringify(normalizeConfig(config), null, 2));
}

async function saveConfig(config: PluginConfig) {
	const normalized = normalizeConfig(config);
	internalSettingsUpdate = true;
	try {
		await writeConfigToPatternSettings(normalized);
		await joplin.settings.setValue(PATTERNS_SETTING, JSON.stringify(normalized, null, 2));
	} finally {
		internalSettingsUpdate = false;
	}
}

function countMatches(body: string, regexSource: string): number {
	try {
		const re = new RegExp(regexSource, 'g');
		let count = 0;
		let match: RegExpExecArray | null;
		while ((match = re.exec(body)) !== null) {
			count++;
			if (match[0].length === 0) re.lastIndex++;
		}
		return count;
	} catch (error) {
		return -1;
	}
}

function countAll(body: string, config: PluginConfig): Counts {
	const counts: Counts = {};
	for (const pattern of config.patterns) {
		if (!pattern.count) continue;
		counts[pattern.id] = countMatches(body, pattern.regex);
	}
	return counts;
}

async function syncEditorConfig() {
	try {
		await joplin.commands.execute('editor.execCommand', {
			name: EDITOR_SET_CONFIG_COMMAND,
			args: [await getConfig()],
		});
	} catch (error) {
		console.info('DraftSmith: editor config sync deferred.', error?.message || error);
	}
}

function configNoteBody(config: PluginConfig): string {
	return `# ${SYNC_NOTE_TITLE}\n\nThis note is used by the DraftSmith plugin to sync settings between devices. You can set this note explicitly with the plugin setting 'Sync note ID/ref'.\n\n\`\`\`json\n${JSON.stringify(normalizeConfig(config), null, 2)}\n\`\`\`\n`;
}

function parseConfigFromNoteBody(body: string): PluginConfig {
	const fenced = body.match(/```json\s*([\s\S]*?)```/i);
	const jsonText = fenced ? fenced[1] : body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1);
	return normalizeConfig(JSON.parse(jsonText));
}

function noteIdFromRef(value: unknown): string {
	const raw = String(value || '').trim();
	if (!raw) return '';
	const match = raw.match(/(?:^|:\/)([a-zA-Z0-9]{20,40})$/);
	return match ? match[1] : raw.replace(/^:\//, '');
}

function noteRefFromId(id: string): string {
	return id ? `:/${id}` : '';
}

async function findSyncNote(): Promise<any | null> {
	const configuredId = noteIdFromRef(await safeSettingValue(SYNC_NOTE_REF_SETTING, ''));
	if (configuredId) {
		try {
			return await joplin.data.get(['notes', configuredId], { fields: 'id,title,body' }) as any;
		} catch (error) {
			console.warn('DraftSmith: configured sync note not found; falling back to title search.', error?.message || error);
		}
	}

	const result = await joplin.data.get(['search'], {
		query: SYNC_NOTE_TITLE,
		type: 'note',
		fields: 'id,title,body',
		limit: 50,
	}) as any;
	const items = result?.items || [];
	const found = items.find((item: any) => item.title === SYNC_NOTE_TITLE) || null;
	if (found?.id) await joplin.settings.setValue(SYNC_NOTE_REF_SETTING, noteRefFromId(found.id));
	return found;
}

async function saveConfigToSyncNote() {
	const config = await getConfig();
	const body = configNoteBody(config);
	const existing = await findSyncNote();
	if (existing?.id) {
		await joplin.data.put(['notes', existing.id], null, { title: existing.title || SYNC_NOTE_TITLE, body });
		await joplin.settings.setValue(SYNC_NOTE_REF_SETTING, noteRefFromId(existing.id));
		panelStatusMessage = `Saved settings to sync note ${noteRefFromId(existing.id)}.`;
		return;
	}

	let parent_id: string | undefined;
	try {
		const folder = await joplin.workspace.selectedFolder() as any;
		parent_id = folder?.id;
	} catch (error) {
		parent_id = undefined;
	}
	const created = await joplin.data.post(['notes'], null, { title: SYNC_NOTE_TITLE, body, ...(parent_id ? { parent_id } : {}) }) as any;
	if (created?.id) await joplin.settings.setValue(SYNC_NOTE_REF_SETTING, noteRefFromId(created.id));
	panelStatusMessage = `Created settings sync note ${noteRefFromId(created?.id || '')}.`;
}

async function loadConfigFromSyncNote() {
	const note = await findSyncNote();
	if (!note?.body) {
		panelStatusMessage = 'No settings sync note found.';
		return;
	}
	const config = parseConfigFromNoteBody(note.body);
	await saveConfig(config);
	panelStatusMessage = 'Loaded settings from sync note.';
}

function renderPanel(config: PluginConfig, counts: Counts, noteTitle: string): string {
	const totalIssues = config.patterns
		.filter(p => p.count && !p.isMarker)
		.reduce((sum, p) => sum + Math.max(0, counts[p.id] ?? 0), 0);
	const totalMarkers = config.patterns
		.filter(p => p.count && p.isMarker)
		.reduce((sum, p) => sum + Math.max(0, counts[p.id] ?? 0), 0);

	const rows = config.patterns.map(pattern => {
		const count = counts[pattern.id];
		const invalid = count === -1;
		return `
			<tr>
				<td><input type="checkbox" ${pattern.enabled ? 'checked' : ''} onchange="togglePattern('${attrEncode(pattern.id)}', this.checked)" title="Toggle editor highlight" /></td>
				<td><span class="swatch" style="background:${escapeHtml(pattern.background)};color:${escapeHtml(pattern.foreground)}">${escapeHtml(pattern.label)}</span><div class="desc">${escapeHtml(pattern.description || 'custom bracket tag')}</div></td>
				<td class="count ${invalid ? 'bad' : ''}">${invalid ? 'regex error' : escapeHtml(count ?? 0)}</td>
			</tr>`;
	}).join('');

	return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
	:root { color-scheme: light dark; }
	body { font-family: var(--joplin-font-family, system-ui, sans-serif); font-size: 13px; color: var(--joplin-color); background: var(--joplin-background-color); padding: 10px; }
	h1 { font-size: 16px; margin: 0 0 8px; }
	h2 { font-size: 13px; margin: 14px 0 6px; }
	details { border: 1px solid var(--joplin-divider-color, #9995); border-radius: 6px; padding: 6px 8px; margin: 10px 0; }
	summary { cursor: pointer; font-weight: 700; padding: 4px 0; }
	.note { opacity: .8; margin-bottom: 8px; overflow-wrap: anywhere; }
	.status { margin: 8px 0; padding: 6px 8px; border-radius: 5px; background: var(--joplin-background-color2, #8882); }
	.summaryGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 12px; }
	.card { border: 1px solid var(--joplin-divider-color, #9995); border-radius: 6px; padding: 8px; text-align: center; }
	.big { font-size: 24px; font-weight: 700; }
	table { width: 100%; border-collapse: collapse; }
	td, th { padding: 5px 3px; border-bottom: 1px solid var(--joplin-divider-color, #9993); vertical-align: middle; }
	th { text-align: left; font-size: 11px; opacity: .75; }
	.count { text-align: right; font-variant-numeric: tabular-nums; }
	.bad { color: #d33; font-size: 11px; }
	.swatch { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-decoration: none; }
	.desc { font-size: 11px; opacity: .72; margin-top: 2px; line-height: 1.25; }
	button { margin: 4px 4px 4px 0; padding: 5px 8px; border-radius: 5px; border: 1px solid var(--joplin-divider-color, #9996); background: var(--joplin-background-color2, transparent); color: var(--joplin-color); }
	input[type="text"] { width: 7.5rem; max-width: 50%; padding: 4px; }
	.small { font-size: 11px; opacity: .75; line-height: 1.35; }
	.controls { margin: 8px 0; }
</style>
</head>
<body>
	<h1>DraftSmith</h1>
	<div class="note">${escapeHtml(noteTitle || 'No note selected')}</div>
	${panelStatusMessage ? `<div class="status">${escapeHtml(panelStatusMessage)}</div>` : ''}
	<div class="summaryGrid">
		<div class="card"><div class="big">${totalIssues}</div><div>issue tags</div></div>
		<div class="card"><div class="big">${totalMarkers}</div><div>triage markers</div></div>
	</div>
	<div class="controls">
		<button onclick="applyHighlights()">Apply highlights</button>
		<button onclick="refresh()">Recalculate counts</button>
		<button onclick="saveSyncNote()">Save sync note</button>
		<button onclick="loadSyncNote()">Load sync note</button>
		<button onclick="setOnlyIssues()">Issue tags only</button>
		<button onclick="setOnlyGaps()">Only GAP</button>
		<button onclick="enableAll()">Enable all</button>
		<button onclick="disableAll()">Disable all</button>
	</div>
	<details>
		<summary>Highlight toggles & counts</summary>
		<table>
			<thead><tr><th>On</th><th>Pattern</th><th class="count">Count</th></tr></thead>
			<tbody>${rows}</tbody>
		</table>
	</details>
	<details>
		<summary>Add bracket tag</summary>
		<div>
			<input id="newTag" type="text" placeholder="TODO" />
			<button onclick="addTag()">Add [TAG:...]</button>
		</div>
	</details>
	<p class="small">Panel checkboxes control which tags are highlighted. Colors are edited in plugin settings. Save/load the sync note to move settings between desktop and mobile through normal Joplin sync.</p>
<script>
	function post(message) { return webviewApi.postMessage(message); }
	function decodeId(id) { try { return decodeURIComponent(id); } catch (e) { return id; } }
	function togglePattern(id, enabled) { post({ type: 'togglePattern', id: decodeId(id), enabled }); }
	function refresh() { post({ type: 'refresh' }); }
	function applyHighlights() { post({ type: 'apply' }); }
	function saveSyncNote() { post({ type: 'saveSyncNote' }); }
	function loadSyncNote() { post({ type: 'loadSyncNote' }); }
	function enableAll() { post({ type: 'bulkEnable', mode: 'all' }); }
	function disableAll() { post({ type: 'bulkEnable', mode: 'none' }); }
	function setOnlyGaps() { post({ type: 'bulkEnable', mode: 'only', ids: ['GAP'] }); }
	function setOnlyIssues() { post({ type: 'bulkEnable', mode: 'issues' }); }
	function addTag() {
		const input = document.getElementById('newTag');
		post({ type: 'addTag', tag: input.value });
		input.value = '';
	}
</script>
</body>
</html>`;
}

async function updatePanel() {
	if (!panelHandle) return;
	const config = await getConfig();
	const note = await joplin.workspace.selectedNote() as any;
	const body = note?.body || '';
	await joplin.views.panels.setHtml(panelHandle, renderPanel(config, countAll(body, config), note?.title || ''));
}

async function registerSettings() {
	const versionInfo = await joplin.versionInfo();
	const isDesktop = versionInfo.platform === 'desktop';

	await joplin.settings.registerSection(SECTION, {
		label: 'DraftSmith',
		description: 'Configurable bracket-tag highlighting for messy fiction drafts.',
		iconName: 'fas fa-highlighter',
	});

	await joplin.settings.registerSettings({
		[PATTERNS_SETTING]: {
			section: SECTION,
			value: JSON.stringify(defaultConfig(), null, 2),
			type: SettingItemType.String,
			public: isDesktop,
			label: 'Pattern configuration JSON',
			description: isDesktop
				? 'Advanced desktop setting: edit supported patterns and regexes. This JSON is updated when color/toggle settings or custom tags change.'
				: 'Internal advanced/example config. Hidden on mobile to avoid breaking the mobile settings screen.',
		},
		[PANEL_VISIBLE_SETTING]: {
			section: SECTION,
			value: true,
			type: SettingItemType.Bool,
			public: true,
			label: 'Show overview panel on startup',
		},
		[SYNC_NOTE_REF_SETTING]: {
			section: SECTION,
			value: '',
			type: SettingItemType.String,
			public: true,
			label: 'Sync note ID/ref',
			description: 'Optional note reference for import/export, expected format :/<ID>. If empty, the plugin searches for/creates a note titled DraftSmith Settings.',
		},
	});

	const config = await getRawConfigFromSetting();
	await registerPatternSettings(config.patterns);
	await writeConfigToPatternSettings(config);
}

async function handlePanelMessage(message: any) {
	const config = await getConfig();
	const pattern = (id: string) => config.patterns.find(p => p.id === id);

	try {
		if (message?.type === 'togglePattern') {
			const p = pattern(String(message.id));
			if (p) p.enabled = !!message.enabled;
			await saveConfig(config);
		}

		if (message?.type === 'bulkEnable') {
			if (message.mode === 'all') config.patterns.forEach(p => p.enabled = true);
			if (message.mode === 'none') config.patterns.forEach(p => p.enabled = false);
			if (message.mode === 'issues') config.patterns.forEach(p => p.enabled = !p.isMarker);
			if (message.mode === 'only') {
				const ids = new Set((message.ids || []).map((id: any) => String(id)));
				config.patterns.forEach(p => p.enabled = ids.has(p.id));
			}
			await saveConfig(config);
		}

		if (message?.type === 'addTag') {
			const tag = normalizeTagName(message.tag);
			if (tag && !pattern(tag)) {
				const newPattern: HighlightPattern = {
					id: tag,
					label: tag,
					description: 'custom bracket tag',
					regex: tagToRegex(tag),
					enabled: true,
					background: '#c9f7ff',
					foreground: '#00505c',
					count: true,
				};
				config.patterns.push(newPattern);
				await registerPatternSettings([newPattern]);
				await saveConfig(config);
				panelStatusMessage = `Added tag ${tag}.`;
			}
		}

		if (message?.type === 'saveSyncNote') await saveConfigToSyncNote();
		if (message?.type === 'loadSyncNote') await loadConfigFromSyncNote();
		if (message?.type === 'apply') panelStatusMessage = 'Applied highlights.';
		if (message?.type === 'refresh') panelStatusMessage = 'Recalculated counts.';
	} catch (error) {
		panelStatusMessage = `Error: ${error?.message || error}`;
	}

	await syncEditorConfig();
	await updatePanel();
}

async function registerPanel() {
	panelHandle = await joplin.views.panels.create('draftSmithPanel');
	await joplin.views.panels.onMessage(panelHandle, handlePanelMessage);
	const showPanel = await joplin.settings.value(PANEL_VISIBLE_SETTING);
	await joplin.views.panels.show(panelHandle, !!showPanel);
	await updatePanel();
}

async function registerContentScriptMessages() {
	await joplin.contentScripts.onMessage(CONTENT_SCRIPT_ID, async (message: any) => {
		if (message === 'getConfig' || message?.type === 'getConfig') return await getConfig();
		return null;
	});
}

async function registerCommands() {
	await joplin.commands.register({
		name: 'draftSmithRefresh',
		label: 'Refresh DraftSmith',
		iconName: 'fas fa-sync',
		execute: async () => {
			await syncEditorConfig();
			await updatePanel();
		},
	});

	await joplin.commands.register({
		name: 'draftSmithTogglePanel',
		label: 'Toggle DraftSmith Panel',
		iconName: 'fas fa-highlighter',
		execute: async () => {
			if (!panelHandle) return;
			const visible = await joplin.views.panels.visible(panelHandle);
			await joplin.views.panels.show(panelHandle, !visible);
		},
	});

	try {
		await joplin.views.toolbarButtons.create('draftSmithTogglePanelButton', 'draftSmithTogglePanel', ToolbarButtonLocation.NoteToolbar);
	} catch (error) {
		console.info('DraftSmith: toolbar button unavailable.', error?.message || error);
	}

	try {
		await joplin.views.menuItems.create('draftSmithTogglePanelMenuItem', 'draftSmithTogglePanel', MenuItemLocation.View);
	} catch (error) {
		console.info('DraftSmith: View menu item unavailable.', error?.message || error);
	}
}

joplin.plugins.register({
	onStart: async function() {
		await registerSettings();
		await registerContentScriptMessages();
		await joplin.contentScripts.register(ContentScriptType.CodeMirrorPlugin, CONTENT_SCRIPT_ID, './contentScripts/codeMirror6.js');

		await registerCommands();
		await registerPanel();

		await joplin.workspace.onNoteSelectionChange(async () => updatePanel());
		await joplin.workspace.onNoteChange(async () => updatePanel());
		await joplin.settings.onChange(async () => {
			if (internalSettingsUpdate) return;
			internalSettingsUpdate = true;
			try {
				await writeJsonFromPatternSettings();
			} finally {
				internalSettingsUpdate = false;
			}
			await syncEditorConfig();
			await updatePanel();
		});
	},
});
