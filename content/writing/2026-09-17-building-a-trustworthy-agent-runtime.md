+++
title = "Building a Trustworthy Agent Runtime"
date = 2026-09-17
description = "Notes from September 11–12"
draft = false

[taxonomies]
tags = ["Techs", "Agents"]

[extra]
language = "en"

+++

[Ceskoslov/Nausicaa: A toy agent harness for Ulysses.](https://github.com/Ceskoslov/Nausicaa)

A harness through context, tools, constraints, verification, and correction . Those responsibilities map directly onto the problems September 11–12  commits address: preserving task requirements, checking results, controlling execution, and explaining interrupted work.

My main lesson is that an agent runtime needs precise meanings for its outcomes. A response can finish while a task remains incomplete. A process can stop after changing the world. A test can pass while answering a narrower question than the user intended.

## Turning principles into runtime boundaries

The September 11 reliability changes (`8bb9e1e`) strengthened the distinction between model output and executable authority. Incomplete or contradictory model stops fail the turn; accepted calls still receive closing receipts. Recovery and turn execution are serialized within one runtime instance. Worker results require the current lease owner, attempt, and unexpired host time.

Nausicaa's existing separation of preparation and execution gives that principle a concrete shape: approval binds to an exact canonical action, and execution uses the prepared value. Prompt instructions and recalled context cannot grant permission.

I also learned to describe guarantees at their actual boundary. Process-group cleanup helps manage descendants, but it is not an OS sandbox. An in-process guard prevents overlapping operations in that runtime; it does not coordinate separate processes. Reliability claims become useful when their limits are explicit.

## Giving “done” an independent meaning

The task layer (`a7b1138`) adds immutable criteria, retained artifact snapshots, deterministic acceptance, and bounded attempts outside the core loop. `TurnCompleted` still means a normal model turn ended. The host supplies evidence for a separate task verdict, and verification runs even on the final allowed attempt. Unknown execution outcomes block acceptance and require reconciliation.

The component producing an answer should not be the sole authority on whether the work succeeded. The first implementation deliberately checks exact UTF-8 contents. That makes its behavior reproducible, while limiting what passing actually proves.

The [September 11 Nemotron report]([Nausicaa/crates/eval/reports/2026-09-11-nemotron-free.md at main · Ceskoslov/Nausicaa](https://github.com/Ceskoslov/Nausicaa/blob/main/crates/eval/reports/2026-09-11-nemotron-free.md)) made that limitation especially instructive. None of eight live runs met the exact-content contract. Six generated artifacts differed from the expected source only in whitespace and passed supplementary compilation and simple behavioral tests. The correct response was to retain both findings. Quietly relaxing the checker would have changed the experiment after observing its results.

The deliberately naive core-only metric counted four false completions; task mode counted zero, with zero accepted tasks. This demonstrated more accurate reporting under the chosen contract. It did not demonstrate better coding ability. A future behavioral checker needs an explicit contract and version, so historical evidence retains its meaning.

## Managing context without losing evidence

The September 11 context commits (`d284cce`, `43277a4`) turn the observation that information has unequal value into three separate responsibilities: pin the task contract, externalize oversized tool outputs, and account for the final provider request.

The task wrapper inserts immutable requirements after inner context compilation. Archived outputs become references in model context while original durable receipts remain intact. Retrieval uses the normal authorization and execution path. This preserves an important distinction between reducing what the model sees now and discarding what the system can later verify.

Final request accounting happens after provider mapping, including tool schemas and output reservation. It requires a trusted model-specific counter; a character limit cannot establish the same guarantee. Over-budget requests fail before transport rather than silently losing constraints. Automatic semantic summarization and cumulative task spending limits remain separate work.

For me, this changed context management from a text-shortening problem into a question of ownership: which facts must survive, where evidence lives, and who may retrieve it.

## Making progress visible and interruption honest

September 12 added bounded streaming previews, request timings, and cancellation across the provider and TUI (`cf48126`, `4d05072`). Previews help users see activity, while incomplete tool fragments never enter execution. The final response still passes through the runtime's validation boundary.

The [DeepSeek validation report]([Nausicaa/crates/provider-openai/reports/2026-09-12-deepseek.md at main · Ceskoslov/Nausicaa](https://github.com/Ceskoslov/Nausicaa/blob/main/crates/provider-openai/reports/2026-09-12-deepseek.md)) records visible streaming and an active cancellation whose UI termination was observed 51 ms after Ctrl-C. That is useful compatibility evidence for the tested route. It does not establish a latency benchmark or prove upstream generation and billing stopped. First network byte and first model text also measure different events.

Shell cancellation (`acc2d27`) exposed a deeper issue. Killing a running command cannot undo a file write or an external request it already made. The runtime therefore persists an unknown-effect receipt before recording turn cancellation. Missing certainty is a state to reconcile, not permission to repeat the action. This gives the recovery a concrete constraint: recovery decisions must account for possible side effects.

The credential fix (`7db6b61`) supplied a smaller but memorable lesson. Earlier validation scripts stripped whitespace, while the documented shell loading path retained a carriage return from a CRLF key file. The request failed before networking. Trimming surrounding credential whitespace fixed startup while interior CR/LF remained invalid. Testing the actual user path revealed what the convenience script had hidden.

## What I would carry forward

Completing a verifiable workflow does not necessarily establish meaningful progress. These changes reinforce that warning. Deterministic fixtures validate control flow; live checks validate particular integrations; neither automatically establishes broad task quality.

My next development habit is to attach each claim to its evidence and preserve failures as carefully as successes. Broader behavioral acceptance, clearer repair feedback, and eventual resumable execution should build on these boundaries. Their value will depend on independently checked outcomes, bounded correction, and honest treatment of uncertainty.
