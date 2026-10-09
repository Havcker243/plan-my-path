# Progress Report 1 — submission checklist

Prepared October 8, 2026.

## Prepared artifacts

- [Four-page PDF report](progress-report-1.pdf): overview, work completed, quantitative evidence, challenges, next steps and primary-source links.
- [Editable report](progress-report-1.html), generated from [current builder](build_submission.py).
- [Final video script](video-script-final.md): approximately four-minute actual-work demonstration.
- [Evidence input hashes](report-build-manifest.json) and [page previews](qa/).

The older build_report.py and video-script.md are superseded drafts. Use build_submission.py and video-script-final.md. Do not rebuild using the old generator.

## Still required from the presenter

1. Read the report, verify it reflects your individual work, and revise any wording you cannot explain or substantiate. Follow course disclosure requirements if applicable.
2. Check the configured GitHub remote, https://github.com/Havcker243/plan-my-path, is accessible to your instructor and has the referenced work. No push or repository access change was made for this package.
3. Rehearse the script and record a 2–5 minute screen demonstration with your narration. The script is not the video deliverable.
4. Watch the exported video and open the final PDF once more.
5. Upload the PDF and actual video to Canvas. Check the course deadline and confirm both uploads completed.

## Rebuild

From the repository root, using Python with PyMuPDF installed:

```powershell
python docs/research/progress-report-1/build_submission.py
```

The builder reads preserved evidence, generates a PDF/HTML and page previews, rejects page overflow, and records input hashes. It makes no model calls and does not rerun experiments. Verification claims in the report are dated historical checks, not new tests executed by the builder.
