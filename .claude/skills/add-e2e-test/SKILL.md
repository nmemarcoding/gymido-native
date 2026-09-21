---
name: add-e2e-test
description: Runs the 4-agent e2e-coverage pipeline for gymido-native — finds a feature with no Maestro test coverage, drafts a skeleton, writes the real flow, and statically validates it. Use when asked to add e2e test coverage, find untested features, or run the e2e test team/pipeline.
---

# Add e2e Test Coverage (4-agent pipeline)

This project keeps its e2e tests as Maestro flows under `e2e/maestro/*.yaml` (see
`e2e/maestro/README.md`). This skill runs a fixed 4-agent pipeline to find one feature lacking
coverage and add a real, runnable flow for it. There is no Maestro CLI or device/simulator in
this environment — the last step is static validation, not a live test run.

## Steps

Run these as separate `Agent` tool calls, in order, each depending on the previous one's
output — do not run them in parallel, and do not skip straight to writing the flow yourself.

1. **Scan** — spawn `subagent_type: "e2e-test-scanner"` with no extra context needed (it
   explores the repo itself). Capture its report: the chosen feature, source files, testIDs,
   suggested flow number/filename, and relevant README conventions.

2. **Skeleton** — spawn `subagent_type: "e2e-test-skeleton-writer"`, passing it the scanner's
   full report in the prompt. It writes `e2e/maestro/skeletons/<NN>-<name>.skel.yaml`.

3. **Write** — spawn `subagent_type: "e2e-test-writer"`, telling it which skeleton file to
   read and turn into the real flow. It writes `e2e/maestro/<NN>-<name>.yaml`.

4. **Validate** — spawn `subagent_type: "e2e-test-validator"`, telling it which new flow (and
   companion skeleton) to check. It reports PASS/FAIL per check and may fix small issues
   directly.

## After the pipeline

- Summarize the outcome for the user: which feature was picked, what files were created, and
  the validator's verdict.
- Do not commit or push automatically — ask the user first, per this repo's normal git
  workflow (stage the new flow + skeleton files, commit, push to the current branch).
- If the validator reports something it couldn't fix confidently, surface that to the user
  instead of guessing.

## Notes

- If the user wants a *different* test paradigm (Cucumber/Gherkin-style `.feature` + `.step`
  files instead of Maestro `.yaml`), that's a framework change, not this pipeline — confirm
  with the user before doing that instead, since it's a bigger switch than a file rename.
- Skeleton files must stay under `e2e/maestro/skeletons/` (not directly in `e2e/maestro/`),
  since `e2e/maestro/config.yaml`'s flow glob (`*.yaml`, non-recursive) would otherwise try to
  run them as tests and fail.
