# FMW RAG Evaluation

Upload the eight `weblogic-rca` files as the authenticated user, then run:

```bash
curl -X POST http://localhost:3000/api/evals/rag \
  --cookie "weblogic_copilot_session=YOUR_SESSION_COOKIE"
```

The evaluator runs eight labeled FMW questions and reports deterministic specialist-routing accuracy, expected-document recall at the configured retrieval `topK`, and expected-term coverage. It deliberately does not call the chat model, so it can be run repeatedly without model-token cost.

Passing targets for the seeded dataset after all files are indexed:

| Metric | Target |
|---|---:|
| Specialist accuracy | 100% |
| Document recall@6 | 90%+ |
| Expected-term coverage@6 | 85%+ |

The output includes per-case expected/found documents and terms to diagnose retrieval regressions caused by embeddings, chunking, prompts, or routing changes.
