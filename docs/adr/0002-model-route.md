# 0002. The helper's model runs on the owner's Claude plan

## Decision
The Claude-based helper runs through headless Claude Code on the owner's plan. Runs are chunked and resumable, and usage is checked between chunks. It's compared against a rules baseline under a decision rule written before the first run.

## Alternatives
The paid Anthropic API, or no language model at all.

## Why
It costs nothing, and the eval decides whether the model earns its place.

## Consequences
Runs use the weekly allowance and are slower. An empty reply is treated as a possible usage limit: the run stops and resumes.
