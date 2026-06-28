---
title: "On Compilers, Compression and LLMs"
description: "If prompts produced truly reliable outputs, we wouldn't be writing code at all. We would simply have Virtual Machines executing English instead of JavaScript or Bytecode."
slug: on-compilers-compression-and-llms
pubDate: 2026-04-07
tags:
  - CODE_REVIEW
  - COMPILERS
  - INFORMATION_THEORY
  - LARGE_LANGUAGE_MODELS
  - SOFTWARE_ENGINEERING
  - SUBSTACK
  - VIBE_CODING
---
I keep seeing a specific argument used to justify skipping code reviews for AI-generated PRs:

> *“You don’t audit the bytecode from your Java compiler or the assembly from your C++ compiler. Why spend time reviewing LLM-generated code? It’s just another layer of abstraction.”*

Calling this a 'hot take' understates the reality of a dangerous category error. It ignores the fundamental difference between a **Specification** and a **Statistical Guess**.

### 1. Determinism vs. Stochasticity

Consider `javac`, the primary Java compiler. It serves as a rigorous bridge between two massive documents. It accepts source code conforming to the **[Java Language Specification (JLS)](https://docs.oracle.com/javase/specs/jls/se26/jls26.pdf)**, and produces Java bytecode conforming to the **[Java Virtual Machine Specification (JVMS)](https://docs.oracle.com/javase/specs/jvms/se26/jvms26.pdf)**. Together, these documents span over **1,500 pages** of dense, mathematically sound documentation.

Beyond the written word, these specs are enforced by the **[Technology Compatibility Kit (TCK)](https://www.azul.com/blog/use-tck-testing-to-ensure-that-your-java-distribution-conforms-to-the-java-se-specification/)**. This is an exhaustive suite of tests—over 139,000 individual test cases for Java 11. Any implementation of Java must pass 100% of these tests to be considered valid. This ensures the mapping from your source code to the machine is deterministic, repeatable, and durable.

As developers, we can afford to be ignorant of those 1,500 pages because of this guarantee. We trust the compiler as an infallible translator.

An LLM operates through stochastic inference regulated by a **"temperature" hyperparameter**. This setting scales the probability distribution of potential outputs, where higher values increase the likelihood of selecting less probable, more "creative" architectural patterns. Unlike a compiler that follows a fixed logical path, an LLM provides a variety of solutions based on this internal randomness. You might receive a thread-safe service one moment and a race-condition-prone implementation the next based on how this probability curve is sampled. This lack of a deterministic contract necessitates a manual audit of every generated line.

If the `javac` were even 1% stochastic, if it occasionally decided to ignore a `synchronized` block or swap a `Long` for an `Integer` based on vibes; every Java developer on earth would be forced to audit the bytecode of every single build.

![man reviewing code on an ancient scroll](/writing/on-compilers-compression-and-llms/0-7b74a14b-0caa-4e7e-95fd-13ab0db38565_2814x1536.png)

### 2. Information Theory and Lossy Decompression

If we want to stretch the compiler analogy to its logical limit, we could view an LLM not as a traditional translator, but as a sophisticated **lossy decompression algorithm.** In this framing, a prompt is a highly-compressed representation of intent. The LLM’s job is to "decompress" that intent into an executable program based on its internal knowledge base.

From an Information Theory perspective however, natural language lacks the information density required to describe complex software systems. Human language is an optimal code for communication between brains that share massive amounts of implicit context. It is fundamentally ill-suited for the zero-ambiguity requirements of a machine.

Computer science history is littered with the corpses of “Natural Language Programming” attempts. COBOL was designed so managers could read it. AppleScript was designed so users could write it. In every case, the same result occurred: as soon as the logic became complex, the “English” syntax became so rigid and verbose that it effectively turned into a formal programming language.

**Edsger W. Dijkstra argued in [EWD 667](https://www.cs.utexas.edu/~EWD/transcriptions/EWD06xx/EWD667.html) that the effort to make natural language a programming interface simply reinvents formal symbolism.** If you try to specify a program in English with enough detail to be reproducible and durable, you end up writing a specification as complex as the code itself. At that point, you might as well use a formal language designed for precision.

### 3. The Power Law of Mistakes

Engineering effectiveness requires the art of allocating human attention where it matters most. For example, we don’t aim for 100% test coverage because not all code carries the same risk.

Imagine your application as a tree. The leaf nodes consist of simple UI labels, CSS-in-JS objects, or one-off internal scripts. Nothing else depends on them. If the AI makes a mistake here, the blast radius remains tiny. The root and core consist of your data access layer, security middleware, or state logic. These sit deep in the stack.

As David Fowler famously noted:

> **“The lower on the technology stack you sit, the less mistakes you are allowed to make.”**

A mistake in your core data layer cascades exponentially up the tree, poisoning every business assumption built on top of it. The deeper the code sits, the more you must govern it.

### 4. Understanding is the Real Bottleneck

Software evolution demands deep reasoning that extends far beyond simple bug hunting.

There is no such thing as “done” software. If there were, we’d generate a binary once and never touch it again. But in the real world, requirements evolve. Code serves as the mind palace we build so we can reason about how to change the system.

Treating AI like a compiler turns your codebase into a disposable artifact. You cannot evolve what you do not understand. Even **Boris Cherny**, the creator of **Claude Code**, admitted this nuance when discussing the limits of vibe coding:

> **“For parts of the system where I have strong technical opinions, I still write the code by hand.”**

If the person building the most advanced AI coding agents still insists on being thoughtful about every line for critical paths, why are we pretending we can afford to be lazy?

### 5. Compliance Requirements

Beyond engineering principles, ignoring AI output creates massive regulatory risk. Standard frameworks like SOC 2 and ISO 27001 mandate a “Separation of Duties” or the “Four-Eyes Principle.”

An LLM cannot serve as an independent reviewer for a security audit. If a human prompts an AI and merges that code without a secondary human sign-off, the control fails. Treating stochastic AI output as a deterministic compiler transformation bypasses the professional governance required to build secure, auditable systems.

### The Bottom Line

If you don’t understand the code, you don’t own the system. And if you don’t own the system, you can’t evolve it effectively.

Use AI to explore, to boilerplate, and to handle the leaf nodes. And while using AI to draft the core of your stack is excellent too, you must own the results through review and testing. For the foundation of your system, **reading the code is the job.**
