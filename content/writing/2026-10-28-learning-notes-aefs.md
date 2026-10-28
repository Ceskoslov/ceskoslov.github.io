+++
title = "Recapture What is Skipped"
date = 2026-10-28
description = "Anyhow."
draft = false

[taxonomies]
tags = ["Techs", "Learn"]

[extra]
language = "en"

+++

[Ceskoslov/ai-engineering-from-scratch: Learn it. Build it. Ship it for others.](https://github.com/Ceskoslov/ai-engineering-from-scratch)

Just started over from scratch. I reviewed 297 lessons across 14 phases, from development tooling and mathematics to transformers, multimodal systems, and tool protocols. 

Here are the ideas I want to carry forward from each phase.

### Phase 00 — Setup & Tooling: trace what the environment actually does.

Small execution details exposed gaps in otherwise familiar tools. Shell redirections apply from left to right. Assignment can create an alias rather than a copy. A generator stays exhausted after consumption. Inside a container, `localhost` refers to that container. My remaining priorities are shell redirection and Python reference behavior: both still caused mistakes after retakes.

### Phase 01 — Math Foundations: keep track of assumptions and units.

This phase required substantial correction. PCA chooses maximum-variance directions; truncated-SVD Frobenius error uses the square root of the sum of squared discarded singular values. Convexity permits multiple global minima, and Cholesky requires a symmetric positive-definite matrix. I also need to keep probability units explicit: perplexity is `exp(H)` for loss in nats and `2**H` for loss in bits. Remembering a formula is only useful if I remember its conditions.

### Phase 02 — ML Fundamentals: validation is part of the model.

Preprocessing belongs inside the validation procedure. A scaler must be fitted on each fold's training subset, and time-series evaluation must train strictly before the evaluation interval. I also revisited why ensembles work: random forests benefit from less correlated trees, while boosting and stacking combine models through different mechanisms. The recurring question is what information the system was allowed to use before making a prediction.

### Phase 03 — Deep Learning Core: check the training interface.

Several mistakes came from confusing related operations. Initialization standard deviation is the square root of variance. Label smoothing changes targets; temperature scaling changes logits. `CrossEntropyLoss` expects raw logits. Evaluation mode changes dropout and BatchNorm behavior. Framework conventions also matter: JAX passes and returns training state explicitly rather than accumulating gradients in PyTorch-style `.grad` attributes.

### Phase 04 — Computer Vision: preserve structure and define the metric.

Averaging frame embeddings loses temporal order, while PointNet deliberately removes point-order dependence through shared processing and symmetric pooling. I also revisited gradient boundaries: `fake.detach()` blocks the path back to the generator while allowing discriminator training. My clearest remaining metric mistake was the lesson's recall@K protocol: three successful queries out of four give 3/4. Counting retrieved items answers a different question.

### Phase 05 — NLP: direction and reduction order matter.

Skip-gram predicts context from a center word; CBOW predicts the center word from context. A bidirectional LSTM needs future input, so it cannot supply its full representation in strict prefix-only streaming. TextRank restores source order after selecting sentences, and MaxSim takes a maximum for each query token before summing. These are compact distinctions with direct consequences for implementation.

### Phase 06 — Speech & Audio: follow time and state explicitly.

I need to distinguish consecutive silence from accumulated silence by tracing counter resets. CTC sums over valid alignments rather than assigning equal durations to transcript tokens. Throughput and latency also measure different things: RTFx compares audio duration with processing time, while response latency measures waiting time. Averaging utterance WER and computing corpus WER can produce different results because they weight examples differently.

### Phase 07 — Transformers: count every dimension.

KV-cache memory accounting was one of my most persistent weaknesses. The calculation must include both keys and values, layers, batch size, cached tokens, KV heads, head dimension, and bytes per element. Other corrections were equally concrete: preserve the original residual in pre-norm blocks, retain labels for selected-but-unchanged MLM tokens, and include special tokens in sequence counts. Teacher-forced training can run in parallel even though autoregressive generation proceeds sequentially.

### Phase 08 — Generative AI: distinguish sampling, objectives, and evaluation.

A model that generates samples does not necessarily provide a tractable density evaluator. An epsilon-prediction diffusion objective learns sampled noise through squared error. Conditional generation also needs conditional checks: a matching pooled mean can conceal swapped outputs across conditions. I still need to reinforce the probability chain rule: conditional probabilities multiply, while their logarithms add.

### Phase 09 — Reinforcement Learning: write down the return before choosing the update.

This was another difficult phase. Monte Carlo uses complete sampled returns; TD bootstraps from estimated values. First-visit counting depends on the relevant state or state-action pair. State representations must retain predictive information, and discounting changes the effective horizon. In DQN, the target network is temporarily frozen while the online network trains; terminal targets omit successor-state value. These distinctions remain high-priority recall topics after multiple retakes.

### Phase 10 — LLMs from Scratch: inspect the whole pipeline.

Pre-tokenization constrains where BPE merges can occur. LSH proposes candidates that still need verification. Padding masks do not automatically isolate packed documents. KV caching reuses earlier projections, but each decode step still computes the next-token distribution. I also revisited the evidence behind training and evaluation: paired and unpaired preference feedback require different methods, and benchmark contamination can inflate apparent performance through memorization.

### Phase 11 — LLM Engineering: inspect what a successful result establishes.

Valid JSON does not guarantee the required object shape. A perfect evaluator score can come from an early return when nothing qualifies for evaluation. A zero-vector guard prevents an invalid division without establishing retrieval relevance. Streaming requires incremental delivery to the caller; buffering a complete response does not provide it. These examples remind me to examine success conditions and edge cases before trusting a result.

### Phase 12 — Multimodal AI: follow the representation across boundaries.

Projection can change embedding width while preserving token count. Attention dimensions follow query and patch counts. Prompt metadata can record image tokens without implementing their insertion. Modality ID ranges need disjoint, correctly calculated boundaries: `end = start + size`, and the last valid ID is `end - 1`. That boundary calculation remained a weakness after the retake. Fused retrieval scores also need care: they are not automatically calibrated confidence probabilities.

### Phase 13 — Tools & Protocols: enforce the contract where execution happens.

Filtering a tool out of discovery does not block direct dispatch. Descriptor pinning needs a canonical digest of the complete descriptor, and admission checks must run before execution. In the binary-analysis lessons, plausible decoded instructions were also insufficient evidence of reachable code: linear sweep can decode embedded data. Across both topics, I need to connect a claimed property to the mechanism and evidence that establish it.

### Three patterns stood out across the review.

First, many errors involved **boundaries and accounting**: bytes versus vectors, variance versus standard deviation, queries versus retrieved items, and inclusive versus exclusive endpoints. Writing down units, dimensions, and denominators before calculating is a practical habit to carry into future work.

Second, **code tracing exposed assumptions that conceptual familiarity missed**. A function name or description could suggest behavior that its branches did not implement. Counter resets, early returns, truthiness, and fallback values repeatedly determined the actual result.

Third, **a passing result still leaves review priorities**. Transformers, reinforcement learning, and mathematics need continued recall, especially KV-cache sizing, MC versus TD, state and return formulation, and the assumptions behind mathematical operations. Retake success is useful evidence, but some of these topics took several attempts.

### What is next?

Complete it, built it, and ship it by myself. 

Grasp an oppurtunity.
