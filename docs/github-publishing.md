# What belongs on GitHub

Updated October 8, 2026. This guide covers the current FiskGrad project and research evidence. It does not authorize a push or change repository access.

| Push after review | Keep local |
| --- | --- |
| Backend and frontend source, including the Research Lab and evidence viewers | `.env`, `.env.local`, passwords, Gemini keys, Supabase JWT secrets, service-role keys, database connection credentials and private keys |
| Tests, dependency manifests/lockfiles, setup scripts and SQL definitions without credentials or production records | `node_modules`, virtual environments, `.next`, compiler caches and downloaded `.research-upstream` checkouts |
| Research methods, assumptions, logs of research decisions, protocol versions and source citations | Runtime `logs/`, private uploads, real transcripts/student records, account exports and database dumps |
| Official repository URLs and exact pinned revisions | Gated/restricted datasets or copied upstream datasets without permitted redistribution |
| Reviewed synthetic/public-task results, including failures, with provenance and limitations | Unreviewed raw provider logs, authentication tokens, session artifacts or responses containing private data |
| Reviewed final report, figures and screenshots without private data | Video recordings by default; submit the actual presentation to Canvas |

## Research evidence

`docs/research/baselines/results/` and `docs/research/progress-report-1/evidence/` are intentionally eligible for Git because reproducible research requires the actual outcomes, including failed attempts. That eligibility is not automatic approval of every new file. Check each new batch for credentials, real student data, licensed content and unnecessary provider metadata before staging it. Public benchmark customers are simulated; do not silently replace them with real records.

The report includes the author's name and the configured GitHub URL as requested. Screenshots must not include secrets, unrelated personal tabs or private academic information. Page previews and older drafts are optional; the final PDF, current builder/script, results and method records are the useful submission evidence.

Keep exact historical research artifacts intact. If a file needs redaction, create a clearly labeled sanitized publication copy and record what was removed; keep the original in ignored local storage. Do not alter hashes or rerun unfavorable outcomes to make them look better.

## Before staging or pushing

From the repository root:

```powershell
python Backend/scripts/check_publish.py
git status --short
git diff --cached --stat
git diff --cached --check
```

The read-only checker scans working-tree and indexed candidates for known local credential values, selected credential patterns, private paths and oversized files. It prints filenames and setting names, never values. Its report stays in ignored `.publish-audit/`. It does not inspect Git history, remote access, compressed PDF contents, all personal data or redistribution permissions. Passing is useful evidence, not a guarantee.

Stage specific reviewed paths in VS Code, then inspect the staged diff. Existing staged changes may differ from the latest working files; `AM` or `MM` in status means the current file has additional unstaged edits. The new Research Lab component `web/components/research-evidence.tsx` must accompany the page importing it.

### Already tracked compiler cache

`web/tsconfig.tsbuildinfo` is currently tracked. The updated ignore rule prevents new caches from being added, but does not remove this existing entry. To stop tracking only this generated file while keeping the local copy, run:

```powershell
git rm --cached -- web/tsconfig.tsbuildinfo
```

This stages its removal from Git; it does not delete the local file. Review that change with your other staged work. Never force-add ignored credentials to bypass the rules.

No commit, push, index cleanup or deletion was performed when writing this guide.
