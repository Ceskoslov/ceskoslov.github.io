+++
title = "RAG Demo Update"
date = 2026-10-20
description = "10 commits"
draft = false

[taxonomies]
tags = ["Techs", "RAG"]

[extra]
language = "en"

+++

[Ceskoslov/rag-prototype](https://github.com/Ceskoslov/rag-prototype)

## Startup is part of the application

The first commit, `b56ccb9`, aligns local configuration and container startup. Compose runs database migrations before starting the API, checks the ARQ worker's health before seeding, and passes consistent provider settings to backend services. Local HTTP works without certificate setup. Vite and Nginx attach the shared API key on the server side, removing the need to put it in browser configuration.

Explicit mock embeddings also make an offline startup possible. They provide deterministic vectors for integration checks; real semantic retrieval still requires a configured local or cloud embedding provider.

The later runtime fixes show why startup deserves regression coverage. The frontend's health probe needed `127.0.0.1` to match Vite's IPv4 binding. A successful seed process also needed a `service_completed_successfully` dependency so Compose could distinguish a finished job from a failed persistent service.

Readiness, liveness, and successful job completion describe different lifecycle states. A working process can still fail an incorrectly specified startup contract.

## Answer verification needs the original evidence

Commit `c859935` strengthens the retrieve → generate → critique loop. The critic receives the original question, generated answer, and complete numbered passages. Its response must pass a structured JSON schema with an approval status and bounded confidence value. Malformed responses are rejected, and deterministic checks reject missing or out-of-range citation numbers.

Rejected answers can trigger query rewriting and another retrieval attempt. When the iteration budget is exhausted, the answer becomes an explicit statement that verified evidence is insufficient. The system no longer treats reaching the retry limit as permission to return an unsupported draft.

Citation identity is preserved per passage, including when multiple passages come from one file. Complete evidence is retained for inspection and later evaluation.

Valid citation numbers establish a structural contract. Whether those passages actually support the claims remains an evidence-judging task; the critic's confidence is an estimate, not a calibrated probability.

## Publish indexes as complete snapshots

Commit `c0884c3` changes ingestion from updating the serving index in place to building a shadow collection. Only a completed build updates the catalog pointer that identifies the active index. Failed builds leave the previous snapshot available.

A manifest fingerprints document contents, embedding configuration, and chunking configuration. This supports unchanged-build detection, removal of deleted content on rebuild, and rejection of queries whose embedding configuration no longer matches the stored index. Redis parent passages are versioned with their index; old entries receive a reader grace period, and obsolete Chroma snapshots are collected during later ingestion.

Retrieval follows those versions too. BM25 caches refresh when active collections change. Chinese and Japanese character bigrams improve lexical matching, BM25L supplies lexical scores, and dense and lexical candidates are ranked across the targeted knowledge bases before reciprocal-rank fusion. Parent passages are fetched in batches, with optional reranking after expansion.

Index freshness includes vectors, parent text, lexical caches, and model compatibility. Publishing a new vector collection alone cannot keep all four consistent.

## Evaluate against independent references

Commit `1990283` adds independently written reference answers and a fictional multilingual regression corpus. Cases include English, Chinese, Japanese, cross-base retrieval, distractors, an unanswerable question, and an imported prompt injection.

The evaluation service uses complete retrieved passages and Ragas collection metrics. References are supplied separately by question. Without a reference, reference-based context recall remains null. Historical conversations containing only shortened source snippets are excluded, and stored results record evaluator and reference provenance.

The benchmark reports source recall, reciprocal rank, citation-number validity, abstention, and latency. Its default deterministic embedding mode checks retrieval wiring. Real generation and optional judging require configured providers.

an independently authored answer makes evaluation more meaningful, but a small fictional corpus still measures regression behavior within a narrow scope.

## Streaming adds a draft lifecycle

Commit `aab9265` introduces async graph execution with actual model chunks, progress events, verification events, and replacement events. The UI marks in-flight text as unverified. A retry replaces the previous draft; final rejection replaces it with an evidence-insufficient response.

Cancellation propagates to model generation, heartbeats keep slow streams active, and the frontend handles server errors and premature stream termination. New chat creates a fresh backend session, saved sessions can be restored, and each assistant answer retains its own evidence for source inspection and download.

Document management joins the same workflow: users can upload, delete, rebuild, and inspect indexing progress. Traces expose stage timings, first-token latency, and provider-reported graph token usage. Separate health and readiness endpoints distinguish process life from dependency availability, while request logs add IDs and timings without recording prompts or document bodies.

Streaming makes provisional output visible. Verification and replacement must therefore be explicit application events that both server and client understand.

## Make verification reproducible

Commit `3b731be` separates heavyweight local-model and evaluation dependencies from the base install, removes unused frontend packages, tightens Docker build contexts, and adds CI coverage for backend tests, evaluator contracts, retrieval regression, migrations, frontend checks, browser contracts, and container smoke tests.

The remaining fixes pin `setup-uv` to a published release, record executable script modes, repair the IPv4 probe, and declare the seed job's completion condition. They turn assumptions that worked in one environment into explicit repository configuration.

The [implementation record](https://github.com/Ceskoslov/rag-prototype/blob/main/docs/implementation-progress.md) reports 81 backend tests for the base installation, 82 with evaluation dependencies, 40 frontend unit tests, and two Playwright workflows. It also records offline Recall@6 of 1.0 and MRR of 0.9722 across 19 cases. Those figures are historical validation results, not fresh measurements for this article or evidence of real-model answer quality. Browser workflows use API fixtures; backend tests and container smoke checks cover other integration boundaries.

The recorded container follow-up confirms migrations, API readiness, worker health, and seed knowledge bases, then documents the final startup fixes. It does not record a completed acceptance run after the last fix. Real-provider quality and latency also remain separate validation work. The demo still uses shared credentials and sessions; user isolation, OCR, and billing attribution remain outside this change set.
