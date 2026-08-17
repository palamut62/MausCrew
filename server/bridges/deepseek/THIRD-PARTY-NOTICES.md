# Third-party notices — DeepSeek Harness bridge

This bridge (`server/bridges/deepseek/`) is OpenMausBot code and is not a
DeepSeek Harness fork (see `docs/deepseek-harness-compatibility.md` and
`OpenMausBot_DeepSeek_Harness_Integration_Guide.md` §3 — no upstream source is
vendored into this repository). It does, at runtime, spawn a Python process
that imports the following third-party packages, installed separately by the
user per `requirements-deepseek.txt`. None of their source is copied here;
this file exists so a packaged build's license notices are accurate about
what the DeepSeek Harness engine causes to run once a user opts in and
installs it.

| Package | Version pinned | License | Source |
| --- | --- | --- | --- |
| [`deepseek-harness-sdk`](https://pypi.org/project/deepseek-harness-sdk/) | 0.1.0rc6 | MIT | https://github.com/deepseek-ai/deepseek-harness |
| [`deepseek-harness-runtime-bin`](https://pypi.org/project/deepseek-harness-runtime-bin/) | 0.1.0rc6 | MIT | https://github.com/deepseek-ai/deepseek-harness (packaged `dsh-jsonrpc-agent` binary) |
| [`pydantic`](https://pypi.org/project/pydantic/) | `>=2.12,<3` (resolved by pip, not vendored) | MIT | https://github.com/pydantic/pydantic |

`deepseek-harness-sdk` and `deepseek-harness-runtime-bin` both declare
`license_expression: MIT` on PyPI (checked against `0.1.0rc6` on
2026-08-17 — see `docs/deepseek-harness-compatibility.md` for how to
re-verify before bumping the pin). Their full license text ships inside each
wheel's `LICENSE` file (PyPI metadata: `license_files: ["LICENSE"]`) and is
not reproduced here; consult the installed package or the upstream repository
for the canonical copy.

`pydantic` is a transitive dependency of `deepseek-harness-sdk` and is not
version-pinned by this file — see `requirements-deepseek.txt` for why. Its
license is MIT.

This file only covers the Python side. The Node/TypeScript side of this
integration (`server/drivers/deepseek/`) imports no DeepSeek code; its
dependencies are covered by the root `package.json` / `pnpm-lock.yaml` and
whatever license-notice generation the rest of OpenMausBot's packaging
already does.
