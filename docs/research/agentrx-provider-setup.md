# AgentRx provider setup

Verified October 9, 2026 against the pinned local source and official provider documentation. The isolated interpreter exists, all declared core modules import successfully, and `run.py --help` works. `copilot`, `az`, and `pwsh` were not found on the current shell PATH. The current shell is PowerShell 5.1; Node is 22.23.2. Missing tools on this PATH do not prove they are absent everywhere on the machine.

## GitHub Copilot route

The pinned runner and the site's AgentRx action use `--endpoint copilot`. First confirm access to GitHub Copilot and, for an organization account, that CLI access is permitted. [GitHub installation documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) specifies Node 22 or later for npm and PowerShell 6 or later on Windows.

In a supported PowerShell terminal:

```powershell
npm install -g @github/copilot
copilot
```

Inside Copilot, enter `/login` and complete GitHub's browser sign-in. [Authentication documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli). Do not put account secrets or tokens in the report, repository, or chat.

After installation/sign-in, start the backend from a fresh terminal so it sees the updated PATH. Check the CLI version, then perform a bounded provider/AgentRx preflight before launching all diagnostic stages. Authentication and entitlement must be verified; CLI presence alone is insufficient. The existing site readiness rule only checks the interpreter and CLI presence, so an enabled button is not proof of provider availability.

From the project root, the existing preserved-evidence wrapper is:

```powershell
Backend\.venv\Scripts\python.exe Backend/research/official_baselines.py agentrx-full
```

This uses one fixed public sample and all official pipeline stages. Successful process completion is not proof of correct failure localization or full dataset reproduction. Inspect logs and stage artifacts; preserve model/CLI version and provider deviations.

## Azure route

The pinned source also supports `--endpoint azure`. This requires an existing Azure OpenAI resource/deployment, authorized identity and matching `AGENT_VERIFY_ENDPOINT`, `AGENT_VERIFY_DEPLOYMENT`, and `AGENT_VERIFY_MODEL_NAME` configuration. The [official AgentRx README](https://github.com/microsoft/AgentRx) describes Azure AD authentication through Azure CLI or managed identity. The site's current action is configured for Copilot; choosing Azure requires explicit local configuration and a separately recorded invocation, not merely a Gemini key.

Do not create a billed cloud resource or assume account access. TRAPI is Microsoft Research internal and is not the external-user route. Modern Copilot CLI also documents BYOK, but that configuration has not been evaluated with our pinned AgentRx runner and must not be claimed to work here.

## Current status

Updated after the student confirmed Copilot access: CLI 1.0.94 is installed and an authenticated text-generation request succeeded. All six stages completed on one public sample using a clean pinned checkout and explicit Copilot-auto model substitution. [Findings and evidence](baselines/results/agentrx-full-20261009T093620Z-3eec32/findings.md). No ground-truth diagnosis accuracy or full-dataset reproduction is established. Earlier installation guidance remains applicable to a new machine; it does not describe the current installed status.

The original local AgentRx checkout has a model-default edit and is preserved. Use the tested clean copy explicitly:

```powershell
$env:AGENT_VERIFY_COPILOT_BIN = Join-Path (Get-Location) 'Backend/research/agentrx_copilot_text_only.cmd'
$env:AGENT_VERIFY_COPILOT_MODEL = 'auto'
$env:AGENT_VERIFY_COPILOT_TIMEOUT = '120'
Backend\.venv\Scripts\python.exe Backend/research/official_baselines.py agentrx-full --endpoint copilot --checkout .research-upstream/AgentRx-clean-20261009 --python .research-upstream/AgentRx/.venv/Scripts/python.exe
```

Run from the project root. The text-only wrapper currently targets the verified machine's `C:\nvm4w\nodejs\copilot.cmd`; verify/update that path on another machine. The site action now supplies these same settings, and the backend was restarted after nine integration tests passed. Do not rerun simply to replace an unfavorable prediction.
