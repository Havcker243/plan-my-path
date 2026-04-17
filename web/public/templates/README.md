# Degree Audit PDF Templates

The degree audit export works without a template by generating a clean PDF from the current balance-sheet data.

Optional institutional templates can be added here later. The PDF fill engine checks these paths, in order:

1. `<major-code>-balance-sheet.pdf`
2. `degree-audit-template.pdf`
3. `cs-balance-sheet.pdf`

Major codes are lowercased and normalized for filenames. For example, `FIN-ECON` maps to `fin-econ-balance-sheet.pdf`.
