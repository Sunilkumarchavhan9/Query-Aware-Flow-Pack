# Query-Aware Flow Pack

## Problem
Rocket.Chat's monorepo is too large for naive full-context agent workflows.

## Prototype idea
This prototype builds semantic skeletons from a small Rocket.Chat message-sending flow, ranks files for a query, and assembles a query-aware context pack instead of loading full raw code.

## Chosen flow
Query: `how are messages sent`

Files analyzed:
- `apps/meteor/app/lib/server/methods/sendMessage.ts`
- `apps/meteor/app/lib/server/functions/sendMessage.ts`
- `apps/meteor/app/authorization/server/functions/canSendMessage.ts`
- `apps/meteor/app/lib/server/functions/insertMessage.ts`
- `apps/meteor/app/lib/server/lib/sendNotificationsOnMessage.ts`

## Pipeline
1. Extract skeletons with `ts-morph`
2. Rank files for the query
3. Build a lightweight flow pack from top-ranked files
4. Benchmark raw vs reduced context

## Results
- Raw: 30169 chars, 1021 lines, 7544 approx tokens
- Skeletons: 4658 chars, 158 lines, 1165 approx tokens
- Flow pack: 4432 chars, 137 lines, 1108 approx tokens
- Raw -> Skeleton reduction: 84.56%
- Raw -> Flow pack reduction: 85.31%

## Why this matters
The prototype preserves structure relevant to a specific question while reducing context size dramatically compared to raw source files.

## Next steps
- Add token-budget-based packing limits
- Expand only selected bodies lazily for deeper answers
- Improve query intent handling for auth/permission flows
- Adapt as a `gemini-cli` extension or preprocessor

## Run
```bash
npm install
npm run dev
npm run match
npm run flowpack
npm run benchmark
```
