---
title: "Forget Complexity: The Simplest Metric for High-Velocity Teams"
description: "High velocity is a strategic imperative, and as counterintuitive as it may seem, simply counting the number of pull requests (PRs) shipped over time — throughput — gives an excellent indicator of velocity."
slug: forget-complexity-the-simplest-metric
pubDate: 2025-01-20
tags:
  - EFFICIENCY
  - ENGINEERING_EFFECTIVENESS
  - PULL_REQUEST
  - SOFTWARE_ENGINEERING
  - SUBSTACK
  - THROUGHPUT
---
High velocity is a strategic imperative, and as counterintuitive as it may seem, simply counting the number of pull requests (PRs) shipped over time — throughput — gives an excellent indicator of velocity. While there are many arguments against this seemingly simplistic approach, let’s address some of the common concerns.

### 1. Pull requests come in different sizes.

Pull requests vary in size, often correlating with the time required to create them. However, if your team enforces 100% code reviews (as it should) and has a fast, reliable CI/CD setup which rolls out merged code (as it also should), your goal should be to ship PRs in the smallest *reasonable* batches.

The smallest reasonable batch size isn’t necessarily the smallest possible. For example, splitting a change into one PR for a business logic update and another for testing would release untested code into production — clearly not ideal.

Small batch sizes have well-documented advantages. Google has extensively covered this topic in their *[Engineering Practices Documentation](https://google.github.io/eng-practices/review/developer/small-cls.html)* and their book *[Software Engineering at Google](https://www.oreilly.com/library/view/software-engineering-at/9781492082781/)*. Smaller PRs tend to flow through release processes more quickly, improve code compartmentalization, enable detailed code reviews, and make change failure isolation and reversion easier.

When PRs are shipped in consistently small, reasonable batches, the size differences tend to even out, making the total number of shipped PRs the most meaningful measure of progress.

### 2. Pull requests come in different shapes.

PRs also differ in complexity. For instance, a simple documentation typo fix isn’t equivalent to a one-line change that touches core business logic. Similarly, creating a new component is fundamentally different from extending one with multiple call sites. However, these differences can be managed by employing categorization tools and practices like *[Investment Balancing](https://www.swarmia.com/blog/balancing-engineering-investments/)*.

![Screenshot of John Cutler's tweat illustrating investment balance.](/writing/forget-complexity-the-simplest-metric/0-93a2933a-c05e-46aa-8faa-b998132cb01d_1280x1218.png)

*An illustration of the importance of investment balancing.*

By maintaining a balance across PR types — feature development, bug fixes, tooling improvements, etc. — you can ensure sustainable and consistent delivery of business value.

![Bar chart showing my team's investment balance over the past 1 year](/writing/forget-complexity-the-simplest-metric/1-4afae29a-4e3e-485b-9b40-fa0b9b3da3be_2000x754.png)

*My team's investment balance for 2024.*

When PR types are balanced, the effort variance among them evens out over time. This, again, supports the idea that throughput is the metric that truly matters.

### 3. People will game the metric.

How metrics often lose their effectiveness when used as a basis for rewards or penalties is a well studied fact in behavioral economics. This phenomenon, encapsulated by [Goodhart](https://en.wikipedia.org/wiki/Goodhart%27s_law)’s and [Campbell’](https://en.wikipedia.org/wiki/Campbell%27s_law)s laws, highlights how performance indicators can be distorted under pressure.

> *The more any quantitative social indicator is used for social decision-making, the more subject it will be to corruption pressures and the more apt it will be to distort and corrupt the social processes it is intended to monitor.*
> 
> *— Donald Campbell*

In the context of PR throughput, tying promotions or bonuses to PR counts for example could lead to behaviors such as:
- Creating frivolous or low-quality PRs.
- Skipping tests to save time.
- Rushing or avoiding thorough code reviews.
- Evading challenging tasks.
    

While these concerns are valid, they can be mitigated in non-toxic work environments with robust processes:
- Code reviews discourage frivolous or low-quality PRs.
- Automated test suites and test coverage monitoring enforce testing standards.
- Shared ownership of production reliability motivates thoughtful reviews and robust code.
- Engaged engineering managers or tech leads can cultivate a culture of high PR quality and ensure alignment with business goals.
    

Strong leadership and cultural norms help prevent gaming behaviors, ensuring PR throughput remains a reliable metric.

### 4. Outputs don’t necessarily represent outcomes.

Critics argue that velocity (output rate) doesn’t guarantee business value delivery (outcomes). This is true. For instance, a team might spend months rearchitecting a system with no discernible business impact.

The distinction between efficiency (*building things right*) and effectiveness (*building the right things*) is critical. Addy Osmani [discussed this topic](https://learning.oreilly.com/library/view/leading-effective-engineering/9781098148232/ch02.html#output_versus_outcome) in detail in his book *Leading Effective Engineering Teams*. Outcomes depend on well-aligned outputs, because in software engineering, business value is primarily delivered to customers through code. Leadership plays a vital role in aligning outputs with business goals, ensuring that meaningful outcomes continue to be achieved. The most effective teams *build the right things right*.

When outputs are aligned with outcomes, maximizing PR throughput becomes an effective strategy for driving business value delivery.

### 5. Throughput per developer is more important than the absolute throughput.

Throughput per developer, or normalized throughput, is often considered a better metric. However, absolute throughput is closer to representing value delivered to the business. Throughput per developer on the other hand measures utilization rather than impact.

While both metrics are useful, focusing on absolute throughput highlights team capacity and evolution. For instance, a team consistently shipping 100+ PRs per month is likely innovating at a pace sufficient to remain competitive. Significantly higher throughput expectations, for example 350+ PRs per month, signal the need for structural changes, such as splitting the team to streamline their focus.

![](/writing/forget-complexity-the-simplest-metric/2-6635d47e-0a1e-4aa8-8281-2cc32b6736bf_1064x842.png)

*My team's throughput for Q4 2024 with 5 engineers. No crunches, no weekend work.*

# **Caveats**

While pull request throughput can be a valuable metric, there are important limitations to consider:

1.  **Context-Dependent Relevance**
    Absolute PR throughput is meaningful only within the context of a single team. Without understanding the specific dynamics, workflows, and goals of a team, the raw number of PRs shipped cannot provide meaningful insights. Consequently, this metric is unsuitable for direct comparisons between teams, as it lacks the nuanced context required to interpret such differences.
    
2.  **Limited Applicability at Higher Levels**
    PR throughput is not a good metric for larger scopes, such as a “team of teams” or an entire organization. At these levels, normalized throughput (e.g., throughput per developer) is a better fit for capturing trends or evaluating overall efficiency. Even then, normalized metrics should be interpreted cautiously to avoid misrepresentation of the organization’s health or productivity.
    
3.  **Short-Term Fluctuations**
    PR throughput often exhibits significant variation over short timeframes, such as week by week. These fluctuations are natural and should not be cause for alarm or interpreted as signs of systemic issues. True patterns and trends can only be identified over longer periods, such as a quarter or half-year. Reacting anxiously to short-term dips, such as questioning why a team shipped 25 PRs this week versus 40 last week, risks making the team overly sensitive to the metric and incentivizing gaming behavior.
    
4.  **Inappropriate for Individual Judgments**
    While PR throughput can be an excellent tool for coaching and supporting individuals in improving their work processes, it should never be used to judge or rank individuals. Doing so can damage trust, encourage unhealthy competition, and lead to counterproductive behaviors. Metrics should focus on fostering collaboration and collective success, not creating an atmosphere of scrutiny or fear.
    

# **Conclusion**

While there are valid concerns about using pull request throughput as a metric, many of these issues can be mitigated with thoughtful practices and leadership engagement. When implemented correctly, tracking PR throughput provides a clear and actionable measure of a team’s velocity, enabling insights into the pace of product evolution.

By promoting small, reasonable batch sizes, balancing the types of pull requests, and aligning outputs with business outcomes, teams can ensure that their throughput reflects meaningful progress. Furthermore, fostering a culture of accountability, supported by engaged engineering leadership and robust review processes, reduces the likelihood of gaming the system or compromising quality.

Ultimately, while throughput is not a perfect metric, it remains a valuable indicator of team activity and capacity. When paired with other measures of quality, alignment, and outcomes, PR throughput can guide teams in maintaining a high-velocity, sustainable development process. This metric, therefore, is not only practical but also essential for ensuring a competitive edge in fast-paced industries.

However, it is critical to emphasize that this recommendation should not be adopted blindly. Metrics like PR throughput must be adapted to the specific context, culture, and goals of each team. Thoughtful application of this approach, tailored to each organization’s needs, is the key to leveraging it effectively.

In a [follow-up essay](/writing/pull-requests-where-engineering-culture), I’ll explore how to increase PR throughput and why high velocity is a strategic imperative. Meanwhile, please share your thoughts — I’d love to hear them!
