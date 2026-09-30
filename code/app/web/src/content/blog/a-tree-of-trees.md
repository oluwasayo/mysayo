---
title: 'Task Orchestration: A Tree of Trees'
description: 'Why durable task orchestration exists: when the thinking loop moves from the human to the server, request/response stops being enough.'
slug: a-tree-of-trees
pubDate: 2026-07-27
draft: false
tags:
  - ARCHITECTURE
  - BACKEND
  - LAMBDA
  - POSTGRES
  - SQS
  - TERRAFORM
  - TESTING
---

For most of the history of the web, a request was a conversation turn and a response was the end of the thought. The browser sent a form. The server wrote a row, maybe sent an email, and returned HTML or JSON. If anything took longer than a few seconds, we pretended it didn't: a spinner, a "we'll email you," a cron that ran overnight. The interesting loop (decide, act, observe, decide again) lived in a person's head: the user filled the next field, clicked the next button, supplied the next prompt. The server was a clerk; the person was the agent.

That split is dissolving. Products now fetch a dozen sources, summarize each in parallel, wait on an external model job, stitch a report, notify a teammate, and retry the one step that timed out, all without a human driving the workflow. Coding agents open pull requests. Support agents walk tickets. Background work fans out into smaller pieces of work, each of which potentially also fans out, and so forth; forming trees that take minutes, hours or even days. The interface still looks like request/response at the boundary, but the thinking and looping have moved onto the server.

<figure class="work-diagram">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="d2-title d2-desc">
<title id="d2-title">Server-side orchestration as a tree</title>
<desc id="d2-desc">A root task fans out into parallel source fetches, then fans in to a synthesize step, then a notify step.</desc>
<defs><filter id="rgh-w2" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-w2)">
<rect class="d-fill" x="280" y="20" width="160" height="44"/>
<rect class="d-fill" x="40" y="120" width="140" height="44"/>
<rect class="d-fill" x="220" y="120" width="140" height="44"/>
<rect class="d-fill" x="400" y="120" width="140" height="44"/>
<rect class="d-fill" x="580" y="120" width="120" height="44"/>
<rect class="d-fill" x="250" y="220" width="220" height="44"/>
<rect class="d-dash" x="250" y="280" width="220" height="36"/>
<path d="M360 64 L 110 120"/>
<path d="M360 64 L 290 120"/>
<path d="M360 64 L 470 120"/>
<path d="M360 64 L 640 120"/>
<path d="M110 164 L 360 220"/>
<path d="M290 164 L 360 220"/>
<path d="M470 164 L 360 220"/>
<path d="M640 164 L 360 220"/>
<path d="M360 264 L 360 280"/>
</g>
<text x="304" y="48" class="d-t-accent">brief/compile</text>
<text x="58" y="148">source A</text>
<text x="238" y="148">source B</text>
<text x="418" y="148">source C</text>
<text x="598" y="148">source N</text>
<text x="278" y="248" class="d-t-accent">synthesize (fan-in)</text>
<text x="300" y="304" class="d-t-muted">notify / share</text>
</svg>
<figcaption>A root brief/compile fans out into parallel source fetches, then fans in to synthesize, then notify.</figcaption>
</figure>

Just as files deserved a [blob primitive](/writing/everything-is-a-blob), asynchronous work deserves an infrastructural one: a small abstraction for publishing typed tasks, surviving retries, joining fan-outs, and working out what failed at 3am. I've designed, built, and currently operate a system very close to the one described here in production, so this isn't hypothetical. A big shoutout to my former employer, [Swarmia](https://www.swarmia.com/), whose internal task orchestration heavily inspired what I'm describing, and is more sophisticated in plenty of ways. That said, this essay is about how I reason about the design, not a tour of Swarmia's internals or of any particular implementation.

<aside class="callout">

One note before we start: the examples use SQS for the work queue, Lambda for consumers, Postgres for control-plane state, S3 for oversized payloads, EventBridge for scheduled release, Terraform for infrastructure, and TypeScript with Zod for contracts. None of those choices are essential. Any durable queue with visibility timeouts, any worker runtime with bounded concurrency, any relational database, any object store, any scheduler, and any typed schema library can sit behind the same ideas. The design is the primitive; the examples are one way to realize it.

</aside>

Here I discuss **durable execution**: a single task, or a tree that fans out from one. The work often outlives the process that published it, whether that was an HTTP handler, an ops CLI, a cron, or another message. Research pipelines, agent tool loops, webhook fan-outs, inbox linking, status polls against slow vendors, anything that may fork, wait, retry, and eventually settle. That is not a database transaction, a websocket protocol, or a general workflow product with versioned histories. If you need human-in-the-loop signals, long-lived workflow versioning, or a visual designer for business processes, look at purpose-built engines. Here, the unit of work is a typed message, and orchestration is encoded in handlers plus a few Postgres tables.

The running example below is invented on purpose: an internal product that compiles a **research brief** from many sources. Swap in invoice OCR, KYC document packs, or PR review agents; the tree is what matters, not the nouns.

That scope gives the design its goals:

- **Survive the process that started the work.** A deploy, a Lambda timeout, or a crashed container must not erase in-flight messages or trees.
- **Make fan-out and fan-in ordinary.** Publishing N children and waiting for all of them should be a first-class option, not a bespoke polling loop in every feature.
- **Prefer framework-level safety over handler-level heroics.** Idempotency claims, retry budgets, typed payloads, and dead-letter capture should be simple defaults, not copy-pasted into each worker.
- **Stay operable under pressure.** An on-call engineer should be able to inspect a tree, replay a dead letter, and see who published whom without piecing it together from CloudWatch logs.
- **Test the real path.** Local emulators and helpers that publish, consume, and drain should exercise the same code production runs, not a parallel fake framework.

## The human was the orchestrator

Picture a person operating a SaaS app. They open a topic, click "compile brief," skim the sources, reject a bad PDF, re-fetch two URLs, approve the draft, and schedule the share. Each click is a short request. Between clicks, *they* hold the plan: which step failed, what to retry, whether every source is ready, when to move on. The server never has to remember that a tree of work exists, because the tree lives in working memory and a browser tab.

<figure class="work-diagram">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="d1-title d1-desc">
<title id="d1-title">Human-in-the-loop orchestration</title>
<desc id="d1-desc">A person holds the plan and issues short request/response turns to a server that forgets between clicks.</desc>
<defs><filter id="rgh-w1" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-w1)">
<rect class="d-fill" x="40" y="48" width="220" height="180"/>
<rect class="d-fill" x="460" y="78" width="220" height="120"/>
<path d="M270 110 C 340 100 390 100 450 110"/>
<path d="M450 110 l -12 -3 m 12 3 l -10 8"/>
<path d="M450 160 C 390 170 340 170 270 160"/>
<path d="M270 160 l 12 3 m -12 -3 l 10 -8"/>
</g>
<text x="56" y="36" class="d-t-label">human</text>
<text x="56" y="88">decide next step</text>
<text x="56" y="118">retry the bad one</text>
<text x="56" y="148">wait for sources</text>
<text x="56" y="178">approve &amp; share</text>
<text x="56" y="208" class="d-t-muted">loop lives here</text>
<text x="476" y="64" class="d-t-label">server</text>
<text x="476" y="120">POST /briefs</text>
<text x="476" y="150">200 OK + brief id</text>
<text x="476" y="180" class="d-t-muted">forgets between turns</text>
<text x="300" y="92" class="d-t-muted">request</text>
<text x="300" y="188" class="d-t-muted">response</text>
</svg>
<figcaption>Classic apps outsource orchestration to the operator. The server only sees isolated turns.</figcaption>
</figure>

Agents invert that. The chat UI still streams tokens, but the durable plan has to live somewhere the process can die and resume. "Fetch these URLs, summarize each source in parallel, synthesize when all are ready, poll the model job, dead-letter the fatal ones" doesn't fit in a single Lambda invocation or a single Postgres transaction. It's a **tree**: a root message, children, grandchildren, join barriers, delayed polls, and an audit trail of who published what. And because each child can fan out again (every source fetch spawning its own parse, extract, and summarize steps), the plan is really a tree of trees.

Request/response is still the right pattern for "read this row" and "save this form," but it's the wrong one for "keep thinking until the work is done." Once you accept that, the question isn't whether you need background processing; it's how much of the reliability story you want every feature team to reinvent.

## Why a framework, not a bunch of `sendMessage` calls

Six months into a product that "just uses SQS," you usually have: five slightly different retry helpers, three notions of a dead letter, payloads that are `Record<string, unknown>`, no parent pointers when a child fails, and a Slack thread titled _"did synthesize ever run?"_

A task orchestration framework is the standard that stops that drift. Publish goes through one function. Consume goes through one processor. Message types are Zod schemas registered in one place. Idempotency, dependencies, delays, and DLQ writes are options on that path rather than separate code paths. Features compose the primitive the way they compose a database pool: they declare *what* work is, and the framework owns *how* work survives.

Let's briefly consider a few alternatives:

| Approach | What you get | What you take on |
| --- | --- | --- |
| **Inline in the request** | Simplicity | Timeouts, deploys, and user retries become your orchestrator |
| **Postgres-only jobs** (`SKIP LOCKED`, pg-boss, etc.) | One system to operate; transactional enqueue with business data; natural `ORDER BY priority` | DB becomes your broker; polling workers; burst load shares fate with OLTP |
| **Temporal / Cadence / Restate** | Durable workflows, timers, signals, history replay, task-queue rate limits | Another runtime and worker fleets; deterministic workflow code; patching discipline for code changes |
| **AWS Step Functions** | Managed state machines, native AWS integrations, visual runs; Map `MaxConcurrency` | ASL/state-machine model; Retry/Catch in ASL; local fidelity differs from plain TypeScript handlers |
| **Vercel Workflows** | Durable async TypeScript (`"use workflow"` / `"use step"`); immediate `Promise.all` fan-in; deployment pinning | Platform-coupled; step retries / FatalError; DB backpressure still mostly yours today |
| **Raw SQS + Lambda** | Managed scale-out, visibility timeouts, cheap fan-out | You still must invent typing, idempotency, fan-in, DLQ ops, and testing |
| **A small framework on SQS + Postgres** | Queue for delivery; database for control plane; typed handlers | You own the orchestration semantics; no free workflow history UI |

I'm not anti-Temporal, Step Functions, or Vercel Workflows. If your product *is* long-lived business processes with signals, versioning, and human approvals, or you want a managed orchestrator that already speaks your cloud, buy that. I'm not anti-Postgres queues either. If your scale fits and you want enqueue atomic with the business transaction, that's a coherent design. The hybrid I describe exists for teams that already live in AWS, already have Postgres as the system of record, already think in TypeScript, and want **durable trees of handlers** without standing up a second orchestration product. The tradeoff is that you don't get Temporal's workflow history, Step Functions' execution diagram, or Vercel's directive-level durable async; you get messages, claims, and SQL join barriers, and you own what they mean.

<details class="callout">
<summary>Alternative: keep the queue in Postgres</summary>

A `jobs` table with `SKIP LOCKED` is a legitimate broker. Enqueue can share a transaction with "create the brief," which eliminates a whole class of "row committed, message lost" bugs. For many products that is enough.

What pushed me off a pure Postgres queue at the workloads I care about: worker fleets that poll, visibility semantics you end up reimplementing, and the way a burst of fetch jobs turns into a connection and lock storm next to OLTP traffic. A managed queue absorbs the delivery spikes. Postgres still holds the *control plane* (idempotency claims, tracked trees, delayed waiters, application DLQ), which is the part that needs queries and transactions. The hybrid puts each concern where it is strong.

</details>

<details class="callout">
<summary>Alternative: Temporal, Step Functions, Vercel Workflows</summary>

All of these make orchestration a first-class runtime concern; they differ on where it lives, how failures retry, how code changes meet in-flight runs, and how you protect a hot database.

**Temporal** (and kin) make orchestration a durable function with an event history. Activities retry under a [Retry Policy](https://docs.temporal.io/encyclopedia/retry-policies) by default; mark permanent failures non-retryable ([Application Failure](https://docs.temporal.io/best-practices/error-handling)). Workflow code must stay deterministic so the runtime can replay history after a worker crash or deploy. Changing that orchestration logic for runs already in flight means [patching](https://docs.temporal.io/patching) (`patched` / `GetVersion`) or worker versioning, not silently swapping the function body. Long histories use [Continue-As-New](https://docs.temporal.io/design-patterns/continue-as-new). Downstream protection is a real platform knob: put heavy Activities on a dedicated task queue and cap dispatch with worker settings such as `maxConcurrentActivities` and server-enforced `maxTaskQueueActivitiesPerSecond` ([rate-limit downstream APIs](https://docs.temporal.io/guides/rate-limit-downstream-apis)). You pay for another runtime, worker fleets, and that determinism discipline.

**[AWS Step Functions](https://aws.amazon.com/step-functions/)** make orchestration an explicit state machine. Without `Retry` / `Catch` on a Task, Map, or Parallel state, a reported error [fails the execution](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html); with them, you get ASL-declared retries and fallback transitions. Fan-out concurrency is explicit: Inline Map defaults to at most 40 concurrent iterations; Distributed Map (Standard workflows) can run far more and exposes [`MaxConcurrency`](https://docs.aws.amazon.com/step-functions/latest/dg/state-map.html) when you need to protect a downstream. [State machine versions](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-state-machine-version.html) are immutable snapshots; an execution stays on the version (or alias routing) it started under. Excellent when the graph is the product and you want AWS to store and visualize the run. Weaker when you want the unit of abstraction to stay "a Zod-typed TypeScript handler that publishes children." AWS has also folded a Temporal-style model into Lambda as [durable functions](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html): checkpointed steps and suspended waits inside an ordinary handler.

**[Vercel Workflows](https://vercel.com/docs/workflows)** make durability feel like ordinary async TypeScript via `"use workflow"` and `"use step"`, with queues and persistence on the platform. Fan-in is immediate: `await Promise.all` over steps suspends the run until those steps settle, with no cron join. On errors ([docs](https://workflow-sdk.dev/docs/foundations/errors-and-retries)): an ordinary throw inside a step is retried (default `maxRetries = 3`, so four attempts); `RetryableError` sets the delay (`retryAfter`); `FatalError` skips retries and bubbles to the workflow function, where you can catch it or let the run end `failed` (a terminal state in the [event log](https://workflow-sdk.dev/docs/how-it-works/event-sourcing)). Retried steps re-execute from the start, so side effects need to be idempotent.

Compensating "rollback" steps are an application pattern, not a built-in DLQ table. [Versioning](https://workflow-sdk.dev/docs/foundations/versioning) pins each run to the deployment that started it (skew protection): deploys do not rewrite in-flight code. To apply a fix, the documented path is cancel (if still running) and **Rerun on latest** / `start(..., { deploymentId: "latest" })` with the same inputs, which starts a *new* run rather than mutating the old one's history mid-flight. Long-lived work that should pick up new code is modeled as a sequence of runs that pass serializable state forward (similar in spirit to Continue-As-New).

On backpressure: platform rate limits protect Workflows/Queues infrastructure and slow starts under load; they are not an RDS governor. A first-class concurrency `lock` / max-concurrency API for steps is [proposed](https://github.com/vercel/workflow/discussions/301) and not the stable "throttle when the DB is hot" story yet, so today you bound fan-out, throw `RetryableError` on overload, or bring your own semaphore. Compelling when the app already ships on Vercel. Less of a fit when workers, VPC data stores, and ops already center on SQS + Postgres elsewhere.

If most of your async work is "publish typed messages that fan out and sometimes wait," a message framework is less ceremony. If most of it is "run this multi-day process with signals, sleeps, and versioned steps," a durable workflow product is the better fit.

</details>

The rest of this essay builds the primitive in twelve acts, each responding to a failure mode the previous act exposed. If you want the finished structure first, skip ahead to [Putting the story together](#putting-the-story-together) and work backwards.

## Act I: no background processing

Start with the failure mode everyone ships first:

```ts
app.post('/briefs', async (req, res) => {
  const brief = await createBrief(req.body)
  await fetchAllSources(brief)      // Minutes.
  await synthesizeBrief(brief)      // More minutes.
  await notifyStakeholders(brief)
  res.json({ ok: true })
})
```

The load balancer times out. The client retries and you double-bill the model provider. A deploy kills the process halfway through: maybe the sources are fetched and synthesize never runs, with no checkpoint to resume from. There is no DLQ, only logs, if you are lucky. When a person drove the loop, at least somebody noticed; here nobody does.

## Act II: fire and forget

The first instinct is to just stop awaiting:

```ts
app.post('/briefs', async (req, res) => {
  const brief = await createBrief(req.body)

  // No queue, no await: respond now, work "later".
  void compileBrief(brief)
    .catch(error => log.error('compile failed', error))

  res.status(202).json({ briefId: brief.id })
})
```

A floating promise, or a `setTimeout`, a `queueMicrotask`, an `EventEmitter` in a corner of the codebase. It works in demos because a warm dev server finishes the work every time.

In production the work exists only in one process's memory. A deploy rotates the container mid-compile and the brief silently never finishes; an autoscaler scaling in does the same. On serverless it's worse: Lambda freezes the execution environment as soon as the handler returns, so the floating promise may never run at all. There is no durability, because the intent to work dies with the process. There is no idempotency, so the user clicks again and you compile twice. There is no observability: no depth to graph, no age to alarm on, no retry budget, no record that work was ever owed. Act I at least failed inside the request, where someone was watching; this fails after the response, where nobody is.

Orchestration has nowhere to live either. "Run these five in parallel, then this one when the whole subtree finishes" (Act VII's `delayUntilFinished`) turns into follow-ups hand-wired inside the callbacks that precede them, invisible at the call site that started the work. Testing inherits the same problem: with no queue to publish to, consume from, or drain, tests sleep and hope, fake timers, or trigger follow-ups by hand, and every feature invents its own way to check whether the background work finished.

The fix: accept the command, **persist the intent somewhere that outlives the process**, and return.

```ts
app.post('/briefs', async (req, res) => {
  const brief = await createBrief(req.body)

  // Resolves when the message is published, not when a consumer has handled it.
  await publishMessage({
    type: 'brief/compile',
    payload: { briefId: brief.id },
  })

  res
    .status(202)
    .location(`/briefs/${brief.id}`)
    .json({ briefId: brief.id })
})
```

That `202` states the new contract: **the HTTP request is no longer the unit of work.** Two notes on the endpoint itself. The `Location` header gives the caller a status URL to poll instead of leaving acceptance open-ended; if the message is later lost, that status page is how you learn the brief is stuck in "pending," not the HTTP response. And you cannot wrap `createBrief` and `publishMessage` in one database transaction: a message that hits SQS before the brief commits can be consumed against a row that is not visible yet (or never will be). The usual order is commit, then publish, which leaves a narrow window if the process dies between them; Act IX returns to that. A related edge: the publish can succeed and the `202` still never reach the client (connection drop), so the client retries and you create a second brief unless create is idempotent on a client key.

## Act III: a queue, and nothing more

SQS gives you a queue, a consumer, a visibility timeout, and a redrive policy. In Terraform it looks roughly like this:

```hcl
resource "aws_sqs_queue" "main_dlq" {
  name                       = "${var.project}-${var.environment}-sqs-main-dlq"
  message_retention_seconds  = 1209600 # 14 days, longer than the source queue
  max_message_size           = 1048576
  sqs_managed_sse_enabled    = true
}

resource "aws_sqs_queue" "main" {
  name                       = "${var.project}-${var.environment}-sqs-main-queue"
  max_message_size           = 1048576
  message_retention_seconds  = 345600 # 4 days; age carries into the DLQ, so keep the source shorter
  visibility_timeout_seconds = 5400 # 6x the function timeout, per AWS guidance for Lambda sources
  receive_wait_time_seconds  = 20  # long polling
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.main_dlq.arn
    maxReceiveCount     = var.sqs_max_receive_count
  })
}
```

Wire Lambda with an event source mapping, reserved concurrency, and permission to receive/delete/send:

```hcl
resource "aws_lambda_function" "main_queue_handler" {
  function_name                  = "${var.project}-${var.environment}-main-queue-handler"
  role                           = aws_iam_role.lambda_main_queue_handler.arn
  runtime                        = "nodejs24.x"
  timeout                        = 900
  memory_size                    = 2048
  reserved_concurrent_executions = 300
  # . . .
}

resource "aws_lambda_event_source_mapping" "main_queue_handler_trigger" {
  event_source_arn        = aws_sqs_queue.main.arn
  function_name           = aws_lambda_function.main_queue_handler.arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 300
  }
}

# Handlers publish children back onto the same queue on purpose.
resource "aws_lambda_function_recursion_config" "main_queue_handler" {
  function_name  = aws_lambda_function.main_queue_handler.function_name
  recursive_loop = "Allow"
}
```

Allowing recursion switches off Lambda's own loop detector, so the framework has to carry that guard instead: the publish chain introduced in Act IV doubles as a depth budget you can cap and alarm on.

Basic monitoring is not optional. Depth tells you about backlog. Age of the oldest message tells you about stuck work. DLQ depth tells you about poison:

```hcl
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${var.project}-${var.environment}-dlq-messages"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  period              = 300
  evaluation_periods  = 1
  statistic           = "Maximum" # any non-zero sample; Average can smear a blip toward 0
  dimensions          = { QueueName = aws_sqs_queue.main_dlq.name }
}

resource "aws_cloudwatch_metric_alarm" "main_queue_depth" {
  alarm_name          = "${var.project}-${var.environment}-main-queue-depth"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.sqs_queue_depth_threshold
  period              = 300
  evaluation_periods  = 2
  statistic           = "Maximum" # catch spikes; use Average only if you mean sustained backlog
  dimensions          = { QueueName = aws_sqs_queue.main.name }
}

resource "aws_cloudwatch_metric_alarm" "main_queue_age" {
  alarm_name          = "${var.project}-${var.environment}-main-queue-age"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.sqs_queue_age_threshold
  period              = 300
  evaluation_periods  = 2
  statistic           = "Maximum" # each sample is already oldest-age; Average masks a stuck message
  dimensions          = { QueueName = aws_sqs_queue.main.name }
}
```

At this point you have distributed delivery, but not yet a system. The failure modes show up immediately. Visibility timeouts misaligned with handler timeouts double-execute work. Partial batch failures need `ReportBatchItemFailures` enabled on the mapping *and* an explicit `batchItemFailures` response keyed by the SQS record's `messageId`, or one bad record retries the whole batch. Hit the reserved-concurrency or account concurrency ceiling and messages age in the queue while looking "stuck" even though nothing is poisoned. Leave a message longer than retention and SQS deletes it with no handler ever seeing it; that is silent loss, not a DLQ entry. Allowing recursion without a depth guard turns a bug into a self-amplifying publish loop until you hit cost or throttling. Fairness between tenants is something you must opt into, and priority does not exist at all. And every producer is still inventing its own JSON structure.

<figure class="work-diagram">
<svg viewBox="0 0 720 220" role="img" aria-labelledby="d3-title d3-desc">
<title id="d3-title">Publish path from API to worker</title>
<desc id="d3-desc">API publishes to SQS; Lambda consumes via event source mapping; workers talk to Postgres through RDS Proxy.</desc>
<defs><filter id="rgh-w3" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-w3)">
<rect class="d-fill" x="24" y="70" width="110" height="70"/>
<rect class="d-fill" x="180" y="70" width="110" height="70"/>
<rect class="d-fill" x="340" y="70" width="120" height="70"/>
<rect class="d-fill" x="510" y="70" width="90" height="70"/>
<rect class="d-fill" x="640" y="70" width="60" height="70"/>
<path d="M134 105 L 176 105"/>
<path d="M176 105 l -8 -5 m 8 5 l -8 5"/>
<path d="M290 105 L 336 105"/>
<path d="M336 105 l -8 -5 m 8 5 l -8 5"/>
<path d="M460 105 L 506 105"/>
<path d="M506 105 l -8 -5 m 8 5 l -8 5"/>
<path d="M600 105 L 636 105"/>
<path d="M636 105 l -8 -5 m 8 5 l -8 5"/>
</g>
<text x="40" y="100">API</text>
<text x="40" y="124" class="d-t-muted">202 + publish</text>
<text x="200" y="100">SQS</text>
<text x="200" y="124" class="d-t-muted">visibility</text>
<text x="356" y="100">Lambda</text>
<text x="356" y="124" class="d-t-muted">batch ≤10</text>
<text x="522" y="100">Proxy</text>
<text x="522" y="124" class="d-t-muted">pool</text>
<text x="650" y="100">RDS</text>
<text x="648" y="124" class="d-t-muted">OLTP</text>
</svg>
<figcaption>Delivery is SQS. Authority and control-plane state stay in Postgres, reached through a proxy so Lambda bursts do not open a thousand connections.</figcaption>
</figure>

## Act IV: type the message, or regret it later

The smallest high-leverage move is to stop treating queue bodies as anonymous JSON. A message has a **type**, a **payload schema**, and an envelope the framework owns:

```ts
const BaseMessage = z.object({
  type: z.string(), // Each spec narrows this to its own literal.
  payload: z.looseObject({}), // Each spec narrows this to its own schema.
  scope: z.object({
    tenantId: z.string().optional(),
    // Other discriminators you care about for fairness,
    // blast radius, log aggregation, etc.
  }),
  metadata: z.object({
    messageId: z.uuid(),
    rootMessageId: z.uuid(),
    parentMessageId: z.uuid().optional(),
    publishChain: z.array(z.string()),
    retryCount: z.int().min(0).default(0),
    timestamp: z.iso.datetime(),
    initiatingWebRequest: z
      .object({
        requestId: z.string(),
        userId: z.string().optional(),
      })
      .optional(),
    isTrackedMessage: z.boolean().optional(),
  }),
})
```

`scope` is not the work; it is the partition the work belongs to. Fair queues, per-tenant concurrency, and "which customer blew up the DLQ" all want the same axes, so stamp them once at publish time rather than burying them in each payload schema. Producers do not fill in the rest of the envelope by hand. They publish a minimal `{ type, payload, scope? }`. The framework stamps identity (its own `messageId`, distinct from the transport-level SQS record id), parent linkage, root id, and a **publish chain** of stack-frame breadcrumbs so ops can see the call path that created a child. Handlers are specs: schema plus function, optionally an idempotency key extractor:

```ts
const schema = defineMessageSchema(
  'brief/fetchSource',
  z.object({
    briefId: z.uuid(),
    sourceId: z.uuid(),
    url: z.httpUrl(),
  }),
)

export const spec = defineMessageSpec({
  schema,
  source: fileURLToPath(import.meta.url),
  idempotencyKey: ({ payload }) => `${payload.briefId}:${payload.sourceId}`,
  async handler(message) {
    await fetchAndStoreSource(message.payload)
  },
})
```

Two conventions carry most of the weight. First, **path equals type**: `brief/fetchSource` lives in `queue/message/brief/fetchSource.ts`, asserted at boot outside the Lambda bundle. Second, a codegen step builds a discriminated union of every publishable message so `publishMessage({ type: 'brief/compile', payload: { … } })` is checked at compile time. Wrong payload fields become compile errors instead of poison messages discovered in the DLQ.

Typing does not remove schema evolution. A payload schema you tighten today will Zod-fail messages already on the queue that were published under yesterday's schema; those become application DLQ entries you must decide to migrate, replay with a shim, or drop. That is also the first place a quiet failure mode shows up: the processor writes the row, deletes from SQS, and moves on, so the Act III CloudWatch alarm on the *AWS* DLQ never fires. Without a separate signal on application-DLQ inserts (Act XI), a bad deploy can park a whole class of work in Postgres while every SQS graph stays green. Remove or rename a type while old bodies still sit in SQS or the delayed table and consumers get "unknown type" at runtime; same sink, same silence. Treat in-flight messages as part of the deploy: expand schemas before you tighten them, and keep handlers for retired types until retention and delayed rows drain.

That is the entire producer surface for most features: one typed publish. The framework owns enrichment.

## Act V: retry policies

At-least-once delivery is the contract. The framework's job is to make the *kinds* of failure explicit when the thrower knows them:

```ts
class FatalError extends QueueError {}
class TransientError extends QueueError {} // Optional custom delay.
class IdempotencyConflictError extends QueueError {}
```

Queue-aware handlers can throw those directly. Shared domain code should not: a service reachable from both a worker and a web request has no business importing `FatalError`, and forcing every call site to wrap throws in framework types just leaks the queue into the wrong layer. So the processor owns a **default classification** for everything that is not a `QueueError` subclass:

| Outcome | Behavior |
| --- | --- |
| Success | Delete from SQS; mark tracked message completed |
| `FatalError` | Application DLQ immediately |
| `TransientError` with delay | Retry with that delay + jitter; budget of N attempts |
| `IdempotencyConflictError` | Wait for the in-flight claim; **do not** burn the retry budget |
| Known non-retryable (`ZodError`, obvious poison, selected DB errors, …) | Same as `FatalError` |
| Everything else | Same as `TransientError`: exponential backoff + jitter up to a cap; then application DLQ |

The allowlist of "known non-retryable" is a product decision you keep short and simple: schema failures and constraint violations that will not heal on retry are good examples. The distinction between "this work is impossible" and "try again in 30 seconds" sounds pedantic until you have watched a misconfigured API key generate five exponential retries and a DLQ entry that should have been fatal on the first throw. The opposite mistake is as bad: classifying an overloaded dependency as fatal and DLQ-ing work that would have succeeded ten seconds later. Prefer explicit `QueueError` subclasses at the worker boundary when you know; otherwise throw ordinary domain errors and let the processor map them.

Error *messages* stay fixed strings: `"Source fetch returned 404"`, not `` `Source ${url} returned ${status}` ``. Variable detail belongs in structured fields on the error (and then in `error_thrown` on the DLQ row). Act XI's alerting fingerprints on message type plus that fixed text; interpolate into the message and every URL becomes its own Sentry issue.

Retry budgets also come in pairs. The envelope's `retryCount` is the framework's budget; SQS separately counts every receive that ends without a delete toward `maxReceiveCount`. Retries in this design are republish-then-delete rather than throw-and-let-SQS-redeliver, which keeps the AWS counter at one and leaves redrive as a true backstop rather than a competing policy. Without that discipline, a transient outage burns `maxReceiveCount`, the AWS DLQ fills, and you lose the structured error payload the application DLQ would have stored. Retries also amplify load: a dependency that is already failing gets N times the traffic from every in-flight tree, which is why backoff and concurrency caps belong in the same design.

The timeouts also have to agree with each other. Lambda refuses an event source mapping whose queue visibility timeout is shorter than the function timeout, and AWS recommends visibility of at least six times the function timeout so throttled or retried batches do not resurface mid-run. The handler's own deadline should sit just under the Lambda timeout, and the idempotency claim lease should cover the whole attempt. If visibility still expires while a handler runs, SQS redelivers, a second invocation fights for the claim, and you need a defined conflict path. If the claim outlives the worker by hours, stuck keys block legitimate retries.

Aligned clocks still leave a harder failure mode: **the work itself does not fit in one Lambda invocation** (fifteen minutes today). A soft deadline just under that limit is how you keep the claim releasable and the DLQ error meaningful instead of a hard kill mid-flight; it does not make a forty-minute synthesize fit. Miss the wall, release the claim, retry, and you burn the budget on a message that was never going to finish in one shot, then land in the application DLQ looking like a flaky handler. The design answer is almost always to stop treating "one long function" as the unit of work: fan out into smaller typed children, checkpoint progress and publish a continuation message that resumes from stored state, or park on a vendor with `TransientError` / `delayUntilTimestamp` while something else runs. If a single step truly needs hours of CPU in one process, that consumer should not be this Lambda path; move it to a long-lived worker and keep the queue contract (typed publish, claims, DLQ) in front of it. The tree exists partly so wall-clock limits become structural, not something you negotiate by raising the function timeout.

## Act VI: idempotency as a framework feature

Every serious queue tutorial ends with "make your handlers idempotent." Most codebases interpret that as "try to remember." The better move is to **claim work in Postgres before side effects**, keyed by something the feature understands:

```ts
// claimIdempotencyKey: INSERT … ON CONFLICT; win if the key is free,
// expired, or already ours (same claim token).
// markIdempotencyDone / releaseIdempotencyKey: UPDATE … WHERE the claim
// token matches; a worker that lost its lease updates zero rows.
```

The handler declares the key; the framework prefixes it with the message type so namespaces do not collide; the claim carries a lease that covers the worker timeout. Concurrent deliveries either skip (already done), wait (conflict), or proceed (won the claim), and every completion or release must present the claim token, so a worker that lost its lease cannot clobber the new owner. Key granularity is a product decision with failure modes on both sides: too coarse (one key for a whole brief) and unrelated work blocks on a false conflict; too fine (a new key every attempt) and you lose protection and double-apply side effects.

Message-level claims stop accidental re-entry of the whole handler. They do not, by themselves, make every side effect safe: a charge that succeeds remotely and then dies before `markIdempotencyDone` will run again on retry. The fix is not a broad `unsafeToRetry` flag on the handler (too coarse: one email and one DB upsert should not share fate). It is a **record per side effect**. Write the intent (or completion) under a stable key in the same Postgres transaction you care about; run the external call; if the call throws, the transaction rolls back and the record never stuck; if a retry finds the record already committed, skip the call. Provider keys (`Idempotency-Key` headers, upserts by natural key) still help when the remote side has its own dedupe. The framework support is a small helper rather than a handler-wide marker:

```ts
await withIdempotency(`brief:${briefId}:notify-email`, async () => {
  await sendEmail(...)
})
```

Message claims remain the outer gate for redrives and visibility races; `withIdempotency` (or an equivalent side-effect table) is the inner gate for "this email / this charge / this webhook" so retries after a timeout or lease release do not double-apply. When the happy path is "claim done, then delete from SQS" and the delete fails, redelivery should hit the already-done branch and no-op; if your handler treats "already done" as an error, you invent a poison loop.

<details class="callout">
<summary>Caveat: release-on-timeout still overlaps the outer claim</summary>

If a handler runs longer than the claim lease, the claim expires and a retry may start while the first attempt is still finishing remote work. Keep handlers inside the lease when you can; for the side effects that must not double, lean on the per-key record (and provider idempotency), not on hoping the outer claim outlives every network call.

</details>

## Act VII: parent ids, fan-out, fan-in

Once handlers publish children while handling a parent, the framework can propagate lineage automatically:

```ts
// Publishing from inside a handler; a publish from a web request
// has no parent and becomes its own root.
parentMessageId = messageBeingHandled.metadata.messageId
rootMessageId   = messageBeingHandled.metadata.rootMessageId ?? messageId
publishChain    = [
  ...messageBeingHandled.metadata.publishChain,
  'src/brief/compile.ts:204',
]
```

Fan-out is then ordinary concurrency:

```ts
await promiseMap(
  sources,
  source =>
    publishMessage(
      {
        type: 'brief/fetchSource',
        payload: {
          briefId,
          sourceId: source.id,
          url: source.url,
        },
        scope: publishScope,
      },
      { tracked: true },
    ),
  { concurrency: X },
)

await publishMessage(
  {
    type: 'brief/synthesize',
    payload: { briefId },
    scope: publishScope,
  },
  { delayUntilFinished: message.metadata.messageId }, // Fan-in on this tree.
)
```

`tracked: true` writes a row the control plane can see. `delayUntilFinished` parks a message in Postgres until its target tracked message has `completed_at`. The reference must itself be tracked: the framework rejects a `delayUntilFinished` pointing at an untracked message, which is why the Act II publish of `brief/compile` grows a `{ tracked: true }` option the moment fan-in enters the picture.

Fan-out itself has crash modes. Publish three of ten children and die before the rest (and before the waiter): on redelivery the parent handler runs again, so child publishes must be idempotent (natural keys, or claims) or you get duplicate work. Publish all children and die before the `delayUntilFinished` waiter: the subtree may finish with nobody waiting, and synthesize never runs unless something republishes the waiter. Publish the waiter while forgetting `tracked: true` on a child: that child is invisible to the level check, the parent can look "complete" early, and the join fires with work still outstanding. A cycle in `parentMessageId` (or unbounded depth) is a logic bug the publish-chain budget is there to catch before it becomes a cost incident.

The target becomes complete by **level bubbling after each handler**, not by a cron polling a recursive CTE. When a tracked message finishes, the framework marks it complete and asks one indexed question: are all tracked children of its parent done?

```sql
-- Level complete? $1 = parent_message_id of the message that just finished.
SELECT 1
FROM tracked_queue_message
WHERE metadata_parent_message_id = $1
  AND completed_at IS NULL
LIMIT 1;
-- No rows → this level is done; mark the parent complete and continue.
```

If siblings remain, stop. If the level is done, mark the parent complete, release any `delayed_message` waiting on that parent onto SQS, and if a waiter was released, end the climb there (the redriven message continues the chain when it runs). Otherwise climb one hop and repeat until the root or an incomplete sibling set. Semantically the waiter still joins on a whole subtree: every descendant must finish before the ancestor they hang from can complete. Operationally each hop only inspects **direct children**, the same pattern as `await Promise.all` at each level of a durable workflow. Depth stays modest (keep trees under something like twenty); with indexes on `(metadata_parent_message_id, completed_at)` each hop is cheap.

Make the climb idempotent and tied to the same completion path that SQS redelivery will retry, so a crash mid-climb does not need a fan-in sweeper: either the child `completed_at` never committed and the handler runs again, or a redelivery sees an already-complete row and re-runs the climb harmlessly. The hotspot to watch is a wide fan-out's last child updating one parent row, not the walk itself. Two more release failures: the climb decides a waiter is ready and the republish to SQS fails (row must stay delayed and retryable, not marked gone); or the last child is not in the DLQ but simply never completes (hung handler, stalled dependency), in which case the waiter ages forever and only queue/delay age alarms tell you.

<figure class="work-diagram">
<svg viewBox="0 0 720 260" role="img" aria-labelledby="d4-title d4-desc">
<title id="d4-title">Fan-in via delayUntilFinished</title>
<desc id="d4-desc">Children complete over time; level completion bubbles up tracked rows; a synthesize message waiting on the parent enters SQS when that parent completes.</desc>
<defs><filter id="rgh-w4" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-w4)">
<rect class="d-fill" x="40" y="40" width="200" height="180"/>
<rect class="d-dash" x="300" y="70" width="180" height="120"/>
<rect class="d-fill" x="540" y="90" width="140" height="80"/>
<path d="M240 100 C 270 100 280 100 300 100"/>
<path d="M480 130 L 536 130"/>
<path d="M536 130 l -8 -5 m 8 5 l -8 5"/>
</g>
<text x="56" y="28" class="d-t-label">sqs (running)</text>
<text x="56" y="78">source A ✓</text>
<text x="56" y="110">source B ✓</text>
<text x="56" y="142">source C …</text>
<text x="56" y="174" class="d-t-muted">tracked rows</text>
<text x="318" y="56" class="d-t-label">postgres</text>
<text x="318" y="110">synthesize</text>
<text x="318" y="138" class="d-t-accent">delayUntilFinished</text>
<text x="318" y="166" class="d-t-muted">waiting on parent</text>
<text x="558" y="78" class="d-t-label">on complete</text>
<text x="558" y="128">synthesize</text>
<text x="558" y="152" class="d-t-muted">on SQS</text>
</svg>
<figcaption>Fan-in is a parked message plus level completion that bubbles toward the root after each handler.</figcaption>
</figure>

Time-based delay is a separate feature and the only reason for a release cron. SQS natively delays up to fifteen minutes; longer waits land in `delayed_message` with a `delayUntilTimestamp` and a cron (or EventBridge schedule) claims due rows with `FOR UPDATE SKIP LOCKED` and publishes them to SQS. Polling a slow vendor job becomes `TransientError` with a delay, or an explicit timestamp, instead of a busy loop. Fan-in waiters do not ride that cron.

One subtle correctness rule: if a tracked message dead-letters, leave `completed_at` null. Waiters must not proceed on a failed branch as if success happened. Replay from the application DLQ **preserves `messageId`** so the existing tracked row is the one that eventually closes and releases the join. That is easy to get wrong if "replay" means "publish a new message that looks similar."

## Act VIII: one queue or many, priorities, and protecting the database

Fan-out without bounds is how one customer recompiles every brief in their workspace and starves everyone else's password resets. Before you reach for exotic schedulers, put a ceiling on the consumer:

1. **Reserved concurrency on the Lambda.** A hard ceiling on the function's concurrent executions, carved out of the account quota.
2. **Event source `maximum_concurrency`.** Stops one queue from pulling faster than you are willing to run ([per-source, not per-function](https://aws.amazon.com/blogs/compute/introducing-maximum-concurrency-of-aws-lambda-functions-when-using-amazon-sqs-as-an-event-source/)). It is a ceiling, not a reservation.
3. **In-process concurrency limits.** For when a single handler publishes hundreds of children.
4. **RDS Proxy in front of Postgres.** Lambda is spiky; a proxy multiplexes connections so a burst of workers does not open a thousand sessions into the primary. Multiplexing erodes when session state pins connections (`SET`, prepared statements, advisory locks), so keep handlers transaction-scoped.

```hcl
resource "aws_db_proxy" "main" {
  name                   = "${var.project}-${var.environment}-rds-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  # auth, vpc_subnet_ids, proxy target, and DB ingress: elided
}

resource "aws_security_group_rule" "rds_proxy_from_lambda_main_queue_handler" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = aws_security_group.lambda_main_queue_handler.id
}
```

That is back pressure, which is not the same thing as fairness or priority. Caps have their own failure modes: set them too low and interactive latency burns while the queue ages; set them too high and the database is the fuse. RDS Proxy helps only if handlers stay transaction-scoped; session pinning (`SET`, long-lived prepared statements, advisory locks held across awaits) collapses multiplexing and you are back to connection exhaustion under a different name.

Fairness on a single standard queue you can now get almost for free: stamp a `MessageGroupId` (tenant id, or message type) on every publish and [SQS fair queues](https://aws.amazon.com/blogs/compute/building-resilient-multi-tenant-systems-with-amazon-sqs-fair-queues/) kick in automatically. When one group hogs consumer capacity, SQS deprioritizes its delivery so quiet groups keep flowing instead of aging behind it, with no consumer changes and no throughput limits. That single attribute blunts most noisy-neighbor incidents before you touch the architecture, provided the group id matches your actual contention axis. Pick the wrong axis (type when the bully is a tenant, or the reverse) and fair queues politely balance the wrong thing while the real victim still starves.

So a single shared standard queue with a global concurrency cap and group-tagged messages is a coherent **v1**: one URL to publish to, one DLQ story, one set of alarms, one LocalStack path in tests, and every message type shares fate. Stamp the `MessageGroupId` from day one; it costs one line at the publish chokepoint. Most products should start there. The hard question arrives the week interactive work (`auth/sendMagicLink`, `brief/notify`) needs to *preempt* a multi-hour `brief/fetchSource` backlog, not just keep flowing beside it. Fairness gives every group a share; it cannot say some work matters more.

Standard SQS has **no priority field that affects dequeue order**: `priority: 'high'` in the JSON body does nothing, sorting a received batch reorders only one invoke's ten messages, and with Lambda event source mappings **you do not own the poll loop** ([documented pain](https://lucvandonkersgoed.com/2022/04/25/implement-the-priority-queue-pattern-with-sqs-and-lambda/), still true). `MessageGroupId` does not change that: on a standard queue it buys fairness, convergence toward "nobody gets starved," not priority, which is "this class always wins under contention" (on a FIFO queue the same field means strict per-group ordering with serialized groups; same attribute, two unrelated contracts). If your broker were Postgres, `ORDER BY priority` with `SKIP LOCKED` would make single-table priority natural; it is one reason some teams stay on a DB broker until they cannot. On SQS, priority means more queues, and that is a design fork to take deliberately, not a default.

<details class="callout">
<summary>Design fork: priority tiers and an adaptive governor</summary>

When interactive work must outrank bulk, the fork looks like this: one queue per tier (`high`, `default`, `bulk`), each with its own SQS DLQ, depth and age alarms, and event source mapping pointing at the **same handler code**. `publishMessage` learns a queue selector (a type→tier map at the publish chokepoint), and each mapping gets its own `maximum_concurrency` budget: high large, bulk small, function reserved concurrency at least the sum. Priority here means capacity share under contention, not "message 7 always runs before message 8." Expect the ops surface to multiply: alarms, IAM, Terraform, test fixtures, and the delayed-release path must all learn which queue receives which message.

Tiers also give you a lever when the database itself is overloaded. AWS has no built-in loop from RDS health to consumer throughput, but every actuator is runtime-adjustable: a small governor Lambda on an EventBridge schedule watches DB metrics (CPU, `DBLoad`, freeable memory) and walks the budgets down bulk-first with `UpdateEventSourceMapping`, then climbs back slowly as the metrics recover, the high tier flowing the whole time at whatever pace the database allows. The details that matter: updates take effect within about ninety seconds, `maximum_concurrency` has a floor of 2, disabling the mapping (`Enabled: false`) is the true scale-to-zero (it stops polling, so receive counts do not inflate toward the redrive policy while paused), and recovery should climb back stepwise rather than jump to full against a warm backlog.

The alternative is to own the poll loop: run consumers as a long-lived ECS task that receives from high, then default, then bulk, observes the same DB metrics directly, and adjusts in-process with no ninety-second lag. That buys strict "drain high first"; it costs you the event source mapping's free scaling glue, so scaling out the consumer fleet becomes its own design challenge (scaling on queue depth, partial-batch semantics, deploys). The framework above it does not change either way: typing, idempotency, DLQ, and fan-in stay put; only delivery moves.

</details>

Priority routing itself stays deferred in this design. The control plane (tracked trees, delays, idempotency, DLQ) is queue-URL-agnostic enough to grow into the fork above later. Growing it anywhere but the single publish path is how you get five ad hoc publishers again.

Noisy-neighbor isolation is never finished. Caps, tiers, and admission control show up at larger scale. The point of the framework is to keep those decisions in one place: publish and consume remain the chokepoints even when "the queue" becomes a small set.

## Act IX: the ways messages disappear

Many of the failure modes above are local to one act. Here they are as a loss checklist, plus a few that only show up once the whole path exists:

**Publish before the business row commits.** A consumer can run against a brief that is not visible yet, or never will be if the txn rolls back. Do not send to SQS inside the open write transaction.

**Commit, then die before publish.** The brief exists; no message ever runs. "Commit, then publish" accepts this narrow window; a transactional outbox (intent row in the same txn, relay to SQS after commit) closes it at the cost of more machinery.

**Publish succeeds, client never sees the `202`.** Client retries; without idempotent create you get duplicate briefs and duplicate trees.

**Handler succeeds, delete from SQS fails.** Redelivery runs the handler again. Idempotency claims (and treating already-done as success) are what make that safe.

**Handler fails after partial external side effects.** Per-side-effect records (`withIdempotency`) plus provider keys; message-level claims alone are not enough.

**Visibility timeout too short.** Second delivery starts; conflict path must not burn retry budget.

**Work longer than the Lambda invocation limit.** Soft deadline, retry, DLQ: the message was never one-shot. Split, continue, delay-poll, or run that step off Lambda (Act V).

**Retention elapses with no successful consume.** SQS drops the message; it will not appear in either DLQ. Age alarms are how you notice before that happens.

**Fan-in releases while a child is in the DLQ.** Prevented by not marking tracked failures complete; replay preserves ids.

**Partial fan-out or missing waiter after a crash.** Idempotent child publishes; ensure the join message is published (or repaired) or the subtree finishes with no synthesizer.

**Timestamp-delayed backlog, cron silent.** Monitor cron invocations and `delayUntilTimestamp` age the way you monitor queue age. Fan-in waiters should not be sitting on that path.

**Oversized payload rejected by SQS.** Offload to blob storage before send (next section).

**Poison message retries forever.** Cap retries; fatal-class errors skip the budget; AWS redrive is a backstop, not the primary ops surface.

**Application DLQ write fails after the handler decided the work is terminal.** The receive may retry or eventually land in the AWS DLQ without a structured `error_thrown` row. Treat DLQ insert + SQS delete as a deliberate sequence with a safe retry if the insert already landed.

**Dual DLQ confusion.** AWS SQS DLQ catches "Lambda never handled this cleanly." The application DLQ table catches "handler said this is done failing" with the payload and error serialized for replay. Document both; operate primarily from Postgres.

**Application DLQ with no class alert.** A deliberate DLQ write followed by an SQS delete leaves CloudWatch quiet (Act IV). Fingerprint Sentry on first insert per type + fixed error text (Act XI), or the table fills without a page.

"Atomic" means nothing until you name the transaction. The processor should delete from SQS only after successful handling (or after a deliberate retry/DLQ write). Tracked completion should flip in the same step as "this message will not run again." A true single transaction across SQS and Postgres is impossible, so make the retry path safe instead of pretending two systems commit as one.

## Act X: large payloads are blobs

SQS caps bodies at 1MB. Source HTML, extracted text, and agent contexts blow through that routinely. The fix is the same primitive as the rest of the product's files: write the bytes to the [blob store](/writing/everything-is-a-blob), put a small pointer on the queue, and garbage-collect the object once it can no longer be redelivered:

```ts
const LARGE_MESSAGE_BODY_THRESHOLD_BYTES = 900 * 1024

const marshallMessageBody = async (body: string) => {
  if (Buffer.byteLength(body, 'utf-8') <= LARGE_MESSAGE_BODY_THRESHOLD_BYTES) {
    return body
  }

  const { blobStorageKey } = await blobStorage.write({
    contentType: 'application/json',
    directory: 'SQS_LARGE_MESSAGE_BODIES',
    keyInDirectory: uuidV7(),
    value: body,
  })

  return JSON.stringify({
    __largeMessageBody: true,
    blobStorageKey,
  })
}
```

Consumers unmarshall transparently. Handlers never learn whether the body arrived via SQS or S3. That is the point of a storage primitive: queue infrastructure uses it the same way an avatar uploader does. Thresholding under the hard limit leaves headroom for envelope growth. The offload path has its own races: blob write succeeds and SQS send fails (orphan object; lifecycle GC should reap it); SQS send succeeds and the object is missing or not yet visible (handler fails transiently and retries); a message sits in either DLQ longer than the lifecycle rule and the pointer dangles. Deletion after success needs the same care: handler success is not the end of a message's life (the SQS delete can fail, and the AWS-side DLQ holds only the pointer, not the bytes), so treat post-consume deletion as best effort and let a prefix-scoped lifecycle rule, sized past queue retention plus DLQ dwell, be the real garbage collector. The blob essay's retention story covers exactly this case.

## Act XI: the application DLQ and the ops CLI

AWS redrive is the backstop. For day-to-day operations you want a table:

```sql
create table dlq_message (
  message_id uuid primary key,
  message_type text not null,
  payload jsonb not null,
  error_thrown jsonb not null,
  metadata_root_message_id uuid not null,
  metadata_parent_message_id uuid,
  metadata_publish_chain text[] not null default '{}',
  metadata_retry_count int not null,
  -- Scope + delay fields elided.
  created_at timestamptz not null default now()
);
```

Beside it: `tracked_queue_message`, `delayed_message`, `idempotency`. Together they are the control plane. A small CLI (`queue-messages dlq list|summarize|get|replay`, `tracked tree`, `delayed list`) covers the 3am cases with plain SQL. Replay uses `republishFromDlq`: same `messageId`, reset `retryCount`, no duplicate tracked row, and the DLQ row is removed only after the resend succeeds, so a replay that fails again simply re-inserts it. Summarize by type before you replay a thousand poison payloads into another outage. Replay is itself a failure mode: replay while a confused operator also "fixes" data under the handler, or replay a whole type whose bug is still in production, and you turn a DLQ into a self-inflicted retry storm. Prefer fixing forward, then replaying a sampled slice, then the rest.

That closes the Act IV gap: CloudWatch on SQS DLQ depth answers "did Lambda fail to handle something cleanly?"; it does not see rows that landed in Postgres after a deliberate DLQ write and SQS delete. On insert into `dlq_message`, report to Sentry (or equivalent) with a fingerprint of `message.type` plus the error's fixed message string. Emit only the first offender for that class; later rows for the same fingerprint stay in Postgres for `summarize` and replay, but do not page again. Attach the payload, scope, publish chain, and structured error fields as context on that one event so the issue is enough to debug without opening a thousand notifications. That is why Act V insists on stable error text: clustering collapses when every brief id or URL invents a new issue title. Depth alarms still matter for volume and for the AWS-side DLQ; Sentry is for *new* failure classes, not for counting them.

Environments should share code and diverge in plumbing:

| Concern | Test | Development | Production |
| --- | --- | --- | --- |
| Broker | LocalStack queue, often ephemeral per test | LocalStack named queue | AWS SQS (one queue at first; tiers later) |
| DB | Test Postgres | Dev Postgres | RDS + Proxy |
| Retry delays | Multiplier ≈ 1 (fast) | Real-ish | Full backoff |
| Priority / isolation | Usually off | Off or mirrored tiers | Concurrency caps; optional tiered queues |
| Secrets | None / dummy | Local URLs | Secrets Manager |

## Act XII: testing like you mean it

Mocking `publishMessage` means testing a path production never runs. The valuable tests create a queue, publish, consume through the real Lambda handler path, and assert on database state and drained messages:

```ts
it('increments retry count on transient errors', async () => {
  const tenantId = uuidV7()

  await runWithNewQueue(async () => {
    const enriched = await publishMessage({
      type: 'test/transientError',
      payload: { shouldFail: true },
      scope: { tenantId },
    })

    await consumeMessage()

    const drained = await drainMessages()
    const body = drained.find(
      m => m.metadata.messageId === enriched.metadata.messageId,
    )

    expect(body?.metadata.retryCount).toBe(1)
  })
})
```

The helpers form a small vocabulary:

- `runWithNewQueue`: ephemeral LocalStack queue + DLQ for isolation
- `runWithQueue`: bind an existing URL into CLS for the task
- `consumeMessage` / `consumeMessageBatch`: pull and process via the real path
- `drainMessages`: pull whatever remains off the queue, without running handlers
- `dispatchMessage`: in-process auto-handle for simple unit-style handler tests (use sparingly)

Assert delayed work through the delayed table, not by hoping SQS still holds it. Prefer `Promise.allSettled` outcomes and database facts over "the consumer promise rejected." Keep a few `test/*` message types registered even in production builds so LocalStack exercises the real registry path. This is the same philosophy as browser-mode frontend tests: exercise the hard boundary for real, mock only what is not the point. LocalStack covers the SQS API, the envelope, the processor, and the database; it will not reproduce Lambda ESM batching quirks, fair-queue delivery, account concurrency limits, or RDS Proxy pinning. Those failure modes stay AWS's to prove in staging, which is what that environment is for.

## Putting the story together

A production brief compile, or any agent-style pipeline, ends up looking like this:

<figure class="work-diagram">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="d5-title d5-desc">
<title id="d5-title">Control plane vs data plane</title>
<desc id="d5-desc">SQS and Lambda deliver work; Postgres holds tracked rows, delays, idempotency, and DLQ; S3 holds large bodies.</desc>
<defs><filter id="rgh-w5" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="15" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-w5)">
<rect class="d-fill" x="40" y="40" width="300" height="220"/>
<rect class="d-fill" x="400" y="40" width="280" height="220"/>
<line x1="40" y1="84" x2="340" y2="84"/>
<line x1="400" y1="84" x2="680" y2="84"/>
</g>
<text x="56" y="68" class="d-t-label">data plane</text>
<text x="56" y="120">SQS main queue</text>
<text x="56" y="150">Lambda consumers</text>
<text x="56" y="180">S3 large bodies</text>
<text x="56" y="210" class="d-t-muted">delivery &amp; bytes</text>
<text x="416" y="68" class="d-t-label">control plane</text>
<text x="416" y="120">tracked trees</text>
<text x="416" y="150">delayed waiters</text>
<text x="416" y="180">idempotency claims</text>
<text x="416" y="210">dlq_message + CLI</text>
<text x="416" y="240" class="d-t-muted">truth for joins &amp; ops</text>
</svg>
<figcaption>SQS moves the work. Postgres holds what the work means.</figcaption>
</figure>

The primitive grew one act at a time, each closing a gap the previous one exposed:

1. Request/response could not hold the loop.
2. Fire and forget lost work invisibly whenever a process died.
3. A raw queue delivered bytes but not meaning.
4. Zod specs made meaning enforceable.
5. Error taxonomy made retries intentional.
6. Idempotency claims made redelivery survivable.
7. Tracked trees and level-bubbling completion made fan-in a framework feature.
8. Concurrency limits and RDS Proxy kept shared resources alive; priority stayed deferred until a single queue hurt.
9. An explicit loss model named the remaining gaps.
10. Blob offload removed the 1MB cliff without a second storage story.
11. A Postgres DLQ and CLI made failure operable.
12. LocalStack helpers made the path real in CI.

## Tradeoffs

**What this buys.** Typed async work that matches how TypeScript teams already think. Fan-in without a workflow engine. Ops surfaces that are SQL. Tests that hit LocalStack and Postgres. A single chokepoint for retries, claims, and lineage. Good enough durability for agent and research trees that last minutes to hours.

**What it costs.** You own orchestration semantics. Fan-in is level bubbling on tracked rows after each handler, not a workflow engine with a Gantt chart. There is no deterministic workflow replay. Dual DLQs confuse newcomers until documented. Codegen for the spec registry is another moving part. Long `delayUntilTimestamp` waits inherit cron reliability; fan-in does not. Exactly-once external effects remain your problem. A single shared queue has no priority until you add tiers, and Lambda event source mappings will not invent priority for you.

**Versus Temporal / Step Functions / Vercel Workflows.** Workflow products win when the product language is "workflow" (or "durable function") and you want history, sleeps, and signals as platform features. This wins when the product language is "message handlers" and the team already operates AWS + Postgres. The sharp differences in practice: Temporal and Step Functions give you first-class knobs to cap how hard workers hit a downstream (task-queue rate limits / Map `MaxConcurrency`); Vercel Workflows today mostly leave DB backpressure to app-level retries and batching, with concurrency locks still evolving. On failure, Temporal retries Activities then returns control to workflow code; Step Functions uses ASL `Retry`/`Catch` or fails the execution; Vercel retries step throws by default, skips retries on `FatalError`, and leaves a failed run terminal until you explicitly rerun (often on a new deployment). On code change, Temporal patches deterministic workflow logic against history; Step Functions pins executions to a published version; Vercel pins runs to a deployment and upgrades by starting a new run (same inputs, or carried state) rather than silently swapping the function under a paused sleep. Migrating later is possible (handlers are just functions), but tree semantics will not map 1:1 onto workflow histories or state machines.

**Versus Postgres-only queues.** Postgres-only wins when transactional enqueue is the dominant correctness requirement, scale is modest, and you want `ORDER BY priority FOR UPDATE SKIP LOCKED` without multi-queue choreography. Hybrid wins when delivery spikes and API OLTP should not share a fate, and when Lambda concurrency (and actuators like ESM `maximum_concurrency`) are features you want from the platform rather than load you put on the same database that holds product rows.

**Versus "just use SQS."** Raw SQS wins for a single worker type with a single payload. The framework wins the week you grow a second worker type, a fan-in, and an on-call rotation.

**Single queue vs tiers.** One queue wins for simplicity and test fidelity until interactive work must outrank bulk and users feel the difference. Tiered queues with per-ESM concurrency budgets are the Lambda-native answer; owning the poll loop buys stricter priority at real cost. And keep the two knobs straight: `MessageGroupId` on a standard queue buys fairness; only tiers (or your own poller) buy priority.

## What I'd defend

The HTTP request is a conversation turn. Agents and pipelines need a place for the loop that used to live in a person's head. That place should be a **tree of typed messages** with framework-owned retries, claims, lineage, and join barriers, not a folder of `sendMessage` helpers and conventions that live in people's heads. Use Temporal, Step Functions, or Vercel Workflows when you need a workflow runtime. Use Postgres as a broker when your scale and atomicity story say so. Use a queue-plus-control-plane framework when you want durable fan-out trees without a second product.

Once thinking runs on the server, **work is a tree**, and trees need a primitive the same way blobs do. Everything else (SQS, Lambda, Zod, tracked trees, LocalStack) is how you grow that primitive without pretending request/response still contains the plan.
