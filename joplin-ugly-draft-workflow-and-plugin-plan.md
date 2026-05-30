# Joplin Adaptation: Ugly Draft → Polished Story

This adapts the editing system to Joplin Markdown notes, where the raw editor cannot reliably color-code arbitrary sentences unless a plugin is developed.

## The key adjustment

In Joplin, make the workflow **tag-driven and checklist-driven**, not color-driven.

Instead of relying on colored text, use:

- standardized bracket tags: `[GAP]`, `[ALT]`, `[FIX]`, `[CHAR]`, `[FACT]`, `[CUT?]`, `[KEEP]`
- Markdown checkboxes for editing passes
- collapsible sections only if supported by your setup, otherwise headings
- predictable note structure
- optional Joplin tags such as `editing/raw`, `editing/pass-2`, `editing/polish`
- search queries to locate all unresolved issues
- optional plugin later for highlighting, sidebar, commands, and reports

---

# Recommended Joplin Note Structure

Use one note per chapter/story draft.

```markdown
# Story / Chapter Title

status: raw
project: 
version: v1
word_target: 3000
current_pass: 0-quarantine

---

## Editing Dashboard

### Passes
- [ ] 0 Quarantine: every messy interruption is tagged
- [ ] 1 Skeleton: scene card and five-sentence summary complete
- [ ] 2 Completion: all holes are readable placeholder prose
- [ ] 3 Triage: paragraphs marked S/R/C/M
- [ ] 4 Character: wants, fears, tactics, leaks checked
- [ ] 5 Synonyms: all `[ALT]` choices resolved
- [ ] 6 Prose: compress/expand, rhythm, sentence cuts
- [ ] 7 Polish: final read-through and cleanup

### Current session
Pass:
Timer:
Mechanical task:
Definition of done:

---

## Scene Card

POV:
Location:
Time:
Scene type:
Opening situation:
Main want:
Opposition:
Turn/change:
Ending situation:
Question pulled into next scene:
Emotional temperature at start:
Emotional temperature at end:

## Five-Sentence Scene Summary

1. Someone wants:
2. Opposition:
3. Tactic:
4. Change/turn:
5. New state:

---

## Character Checks

### Character A
Surface goal:
Hidden need/fear:
What they are not saying:
What they misunderstand:
What they are trying to control:
How they protect themselves:
How they show emotion indirectly:
What changes by the end:

### Character B
Surface goal:
Hidden need/fear:
What they are not saying:
What they misunderstand:
What they are trying to control:
How they protect themselves:
How they show emotion indirectly:
What changes by the end:

---

## Draft

Write or paste the actual story here.

---

## Parking Lot

### Lines/images to maybe reuse
- 

### Continuity questions
- 

### Cut but maybe reusable
- 

---

## Triage Log

- Beat/paragraph 1: S/R/C/M — reason:
- Beat/paragraph 2: S/R/C/M — reason:

---

## Synonym Decisions

| Location | Options | Choice | Reason |
|---|---|---|---|
|  |  |  | meaning / POV / register / sound / image / freshness / continuity |
```

---

# Tag Conventions for Joplin

Use tags in a machine-readable way so they can be searched or parsed later.

## Inline issue tags

Prefer this:

```markdown
She reached for the cup. [ALT: trembling | shaking | unsteady] [CHAR: what is she hiding?]
```

Over this:

```markdown
She reached for the trembling/shaking/unsteady cup because [what is she hiding?]
```

Why: the first version keeps the sentence readable and makes unresolved issues searchable.

## Recommended tag meanings

- `[GAP: ...]` missing action, transition, information, or emotional beat.
- `[ALT: a | b | c]` word or phrase choice still undecided.
- `[FIX: ...]` grammar/syntax broken.
- `[CHAR: ...]` motivation, voice, subtext, relationship issue.
- `[FACT: ...]` canon, continuity, timeline, worldbuilding, research.
- `[CUT?: ...]` probably unnecessary.
- `[KEEP: ...]` ugly but alive; preserve the function or image.
- `[S]`, `[R]`, `[C]`, `[M]` paragraph triage markers: Salvage, Rewrite, Cut, Move.

---

# Joplin-Compatible Pass Workflow

## Pass 0: Quarantine

Do not polish. Search for all raw brackets and convert them into standardized tags.

Session task examples:

- Convert ten messy comments into `[GAP]`, `[ALT]`, `[FIX]`, etc.
- Move orphan ideas to Parking Lot.
- Mark three good-but-rough lines as `[KEEP]`.

Definition of done:

- Every interruption has a recognizable tag.
- Random notes are no longer embedded mid-sentence.

## Pass 1: Skeleton

Fill the Scene Card and Five-Sentence Scene Summary.

Definition of done:

- The scene has a want, opposition, turn, and changed ending state.

## Pass 2: Completion

Search for `[GAP:` and `[FIX:`. Replace each with ugly but complete prose.

Allowed placeholder style:

```markdown
He was angry because she had lied.
She noticed the blood on his sleeve.
This is where he decides not to tell her.
```

Definition of done:

- The story can be read start to finish without falling into a missing section.

## Pass 3: Triage

Mark each paragraph or beat with one of:

- `[S]` salvage
- `[R]` rewrite
- `[C]` cut
- `[M]` move

Example:

```markdown
[R] She looked away, thinking about everything that had happened, and how it all felt too big somehow.
```

Then rewrite from function:

```markdown
What this paragraph must do:
1. Show she is ashamed.
2. Show she still wants him to ask.
3. Delay the reveal by one beat.
```

Definition of done:

- Every paragraph has a reason to remain or a decision attached.

## Pass 4: Character

Use the Character Checks section, then scan dialogue for:

- literal text
- tactic
- leak/subtext

Definition of done:

- Main characters want something, hide something, and change tactics.

## Pass 5: Synonyms

Search for `[ALT:` and resolve them one by one.

Use this decision ladder:

1. Meaning
2. POV
3. Register
4. Sound
5. Image
6. Freshness
7. Continuity

Record hard choices in the Synonym Decisions table.

Definition of done:

- No unresolved `[ALT:]` remains, or remaining ones are deliberately deferred.

## Pass 6: Prose

Search for `[CUT?:`, `[R]`, repeated words, and weak paragraph openings.

Use the accordion method:

- Compress routine logistics.
- Expand choices, reversals, intimacy, danger, and reveals.

Definition of done:

- Attention is proportional to importance.

## Pass 7: Polish

Now use readability and sentence-length tools.

Final search targets:

```text
[GAP:
[ALT:
[FIX:
[CHAR:
[FACT:
[CUT?:
[KEEP:
[S]
[R]
[C]
[M]
```

Definition of done:

- No accidental scaffolding remains in the reader-facing version.

---

# Useful Joplin Searches

Depending on Joplin search behavior and your exact syntax, you can search for these strings:

```text
[GAP:
[ALT:
[FIX:
[CHAR:
[FACT:
[CUT?:
[KEEP:
```

You can also use Joplin tags at the note level:

- `draft/raw`
- `draft/legible`
- `draft/scene-pass`
- `draft/character-pass`
- `draft/prose-pass`
- `draft/polished`
- `needs/gaps`
- `needs/character`
- `needs/continuity`
- `needs/synonyms`

---

# Plugin Feasibility Plan

A dedicated Joplin plugin for this system is feasible, especially on desktop. A cross-platform desktop/mobile plugin is also plausible if built against Joplin's current CodeMirror 6 editor/plugin model, but mobile plugin support should be treated as more constrained and tested early.

## MVP plugin features

### 1. Highlight issue tags in the Markdown editor

Use a CodeMirror 6 content script to decorate ranges like:

- `[GAP: ...]` with red/pink background
- `[ALT: ...]` with blue background
- `[CHAR: ...]` with purple background
- `[FACT: ...]` with amber background
- `[CUT?: ...]` with gray background
- `[KEEP: ...]` with green background

This would solve the missing color-coding problem directly inside the editor.

### 2. Sidebar editing dashboard

Use a Joplin panel to show:

- current note status
- pass checkboxes
- counts of unresolved tags
- buttons for “Next GAP”, “Next ALT”, “Insert Scene Card”, “Insert Worksheet”
- list of current issues extracted from the note

On desktop this can live as a side panel. On mobile, panels may appear differently, so design it as a compact dashboard rather than assuming a permanent sidebar.

### 3. Insert template commands

Commands:

- Insert Ugly Draft Worksheet
- Insert Scene Card
- Insert Character Check
- Insert Synonym Decision Table
- Convert selected bracket note to `[GAP:]`
- Convert selected bracket note to `[ALT:]`
- Mark paragraph `[S]`, `[R]`, `[C]`, `[M]`

### 4. Note status updater

A command that changes the YAML-ish header:

```markdown
status: raw
current_pass: 2-completion
```

or applies Joplin tags such as `draft/legible`.

### 5. Cleanup/report command

Generate an editing report:

```markdown
## Editing Report
GAP: 4
ALT: 12
FIX: 2
CHAR: 3
FACT: 1
CUT?: 5
```

Optional: append the report to the note or display it in the panel.

## Nice later features

- “Next unresolved issue” navigation.
- One-click resolve: remove the tag and save the decision.
- Paragraph triage heatmap.
- Character checklist per named character.
- Session mode: pick one pass, hide unrelated issue types.
- Export clean copy: duplicate note and strip all workflow scaffolding.
- Draft version command: duplicate current note with suffix `v2_legible`, `v3_scene`, etc.
- Review mode that shows only paragraphs marked `[R]` or `[CUT?]`.
- Word repetition report.
- Dialogue-only extraction for character voice revision.

---

# No-Plugin Workarounds

## 1. Use issue tags as visual anchors

The tags themselves become your color system.

`[GAP]` = red problem  
`[ALT]` = blue problem  
`[CHAR]` = purple problem  
`[CUT?]` = gray problem  
`[KEEP]` = green signal

## 2. Keep the dashboard at the top

The first screen of the note should always tell you what pass you are in and what remains.

## 3. Use one mechanical command per session

Examples:

- “Resolve all `[GAP:]` tags.”
- “Resolve ten `[ALT:]` tags.”
- “Mark all paragraphs `[S/R/C/M]`.”
- “Fill only the Character Checks.”

## 4. Use separate notes for big rewrites

For messy rewrite experiments, create sibling notes:

- `Story Title — v1 raw`
- `Story Title — v2 legible`
- `Story Title — v3 scene pass`
- `Story Title — v4 polish`

Or keep all versions in one notebook.

## 5. Use the split viewer carefully

If you use Joplin's editor + rendered Markdown view, the rendered side can show checkboxes and any HTML/CSS styling you add. But do not depend on the preview for actual editing decisions unless your setup supports it comfortably.

---

# Practical Recommendation

Start with the no-plugin workflow for 2–3 stories. This will reveal which friction points are real.

Then build the plugin in stages:

1. Tag highlighter in editor.
2. Insert-template commands.
3. Dashboard panel with unresolved counts.
4. Navigation/resolution commands.
5. Clean export/versioning tools.

The plugin should enhance the process, not define it. The durable part is the tag grammar and pass checklist.
