# Ownership Matrix

This matrix defines phase-level accountability for the product lifecycle.

The primary question is not only "who participates?" It is:

> Who is accountable for the quality of this phase, and what failure mode are they responsible for preventing?

## Phase Accountability

| Phase | Team | Accountable Leader | Owns | Owns Preventing |
| --- | --- | --- | --- | --- |
| Business Requirements | PMO | SVP, Biz Ops | Comprehensive business requirements, ROI, business outcomes, constraints, and success measures. | Incomplete, unclear, or misaligned requirements. |
| Product Design | Product | Head of Product | Product design, user experience, workflows, and expected system behavior. | Missed system behavior, usability gaps, and gaps versus existing functionality. |
| Technical Requirements | IT Product Management | Sr. Dir, Product | Bridging the gap between business requirements, product design, and technical implementation. | Incorrect, missing, unclear, or unbuildable technical requirements. |
| Development | Software Development | Sr. Dir, Software Development | Correct implementation, coding standards, peer code review, technical quality, and delivery timelines. | Incorrect implementation, regressions, broken existing behavior, and unmanaged technical delivery risk. |
| QA / Validation | QA | QA Manager | Testing of products, new features, bug fixes, integrations, workflows, and release candidates. | Missed test coverage, regression gaps, validation errors, and insufficient evidence of readiness. |
| Release | Release Owner | Assigned per release | Release contents, release readiness, release schedule viability, go / no-go coordination, and release execution. | Releasing with known critical issues, unclear readiness, missing approvals, or unacceptable release risk. |
| Post-Release | All, led by relevant phase owner | Phase owner based on issue | Post-release monitoring, incident response, feedback review, root-cause analysis, and follow-up ownership. | Treating symptoms without identifying and fixing systemic root cause. |

## Supporting Delivery Roles

Use the following delivery role model inside each phase when detailed responsibility needs to be clarified.

Legend:

- `D`: Driver. Runs the work, coordinates inputs, and moves the activity to closure.
- `O`: Owner. Accountable for the outcome and final call.
- `C`: Contributor. Provides input, expertise, review, or execution support.
- `I`: Informed. Needs visibility but does not actively approve or execute.

Best-practice rule: each row should have one clear `O`. A row may have one or more `D` roles only when the work naturally requires joint execution.

| Stage | Activity | PMO / SME | Scrum Product Owner | TPM | Dev | QA | Release Manager | Notes / Questions Answered |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Discovery | Non-technical requirements | O / D | C | I | I | I | I | What business, customer, user, operational, policy, and stakeholder needs must be satisfied? Who is affected? What outcome does the business need? What constraints, commitments, workflows, edge cases, and success measures matter? |
| Product Design | Product design and user experience | C | O / D | C | C | C | I | What is the intended user experience? What workflows, screen behavior, system behavior, edge cases, and existing functionality must be accounted for? What design gaps would create confusion, missed functionality, or downstream rework? |
| Planning | Backlog translation and acceptance criteria | C | O / D | C | C | C | I | How are the non-technical requirements and product design translated into clear backlog items? What must be built? What is in scope and out of scope? What acceptance criteria will prove the work satisfies the requirement? |
| Planning | Technical requirements | I | O / D | C | C | C | I | How do business requirements and product design translate into technical requirements? What system behavior, data, integration, security, performance, reliability, scalability, and operational constraints apply? What technical requirements are missing, incorrect, unclear, or unbuildable? |
| Planning | Dependencies and sequencing | C | C | O / D | C | C | C | What must happen first? Which teams, systems, decisions, environments, vendors, or approvals are dependencies? What is the critical path? What could block the work? |
| Planning | Definition of Ready review | C | O / D | C | C | C | I | Is the work ready to build? Are requirements clear enough? Are acceptance criteria testable? Are dependencies, risks, owners, and communication paths known? If not ready, what is missing and who resolves it? |
| Communication | Stakeholder updates | O | D | C | I | I | I | Where do things stand? What changed? What risks or blockers exist? What decisions are needed? What happens next, by when, and who owns it? |
| Communication | Escalation and decision management | O | D | C | I | I | I | What decision or blocker needs leadership attention? Why does it matter? What options exist? What is the recommended path? Who must decide, and by when? |
| Execution | Scope management | O | D | C | C | C | I | Is the work still aligned to the approved scope? Are new requests changes, defects, or clarifications? What tradeoff is required if scope changes? Who approves the change? |
| Execution | Build execution | I | C | D | O | C | I | Is implementation progressing against plan? Are technical risks controlled? Are blockers visible? Does the work match the product and technical requirements? |
| Validation | Test strategy and acceptance | I | C | C | C | O / D | I | How will we prove the work is correct? What must be tested? What acceptance criteria must pass? What defects or gaps block release? |
| Validation | Product acceptance | O | D | C | C | C | I | Does the delivered work solve the intended problem? Do acceptance criteria pass? Are business, user, operational, and support impacts acceptable? |
| Safety | Safety, compliance, and risk review | O | C | D | C | C | I | Are there privacy, security, legal, compliance, child-safety, data, financial, operational, or reputational risks? What review is required? Who accepts residual risk? |
| Release | Release readiness | C | D | C | C | C | O | What is included in the release? Is the release viable for the schedule? Are product, engineering, QA, support, communication, training, analytics, and rollback plans ready? What release risks remain? Who approves release? |
| Release | Release execution | I | C | C | C | C | O / D | When does the release happen? Who executes it? What environments, approvals, communications, and rollback steps are required? How will status be monitored during release? |
| Rollout | Rollout and enablement | O / D | C | C | I | I | C | Who needs to know or be trained? Which users, customers, teams, or markets receive the change first? What enablement, documentation, messaging, and adoption support are required? |
| Stability | Production monitoring and stabilization | O | D | C | C | C | C | Is the release healthy? Are defects, incidents, support volume, performance, adoption, or customer issues emerging? What needs immediate action? When can the work exit stabilization? |
| Feedback | Post-release feedback and outcomes | O / D | C | C | C | C | I | Did we achieve the intended outcome? What did customers, users, support, business stakeholders, and data tell us? What should we improve, continue, stop, or revisit? |
| Feedback | Post-mortem / retrospective | C | D | C | C | C | C | What happened? What worked? What did not? Which phase owner should lead the fix? What root causes or process gaps appeared? What follow-up actions are needed? Who owns them and by when? |

## Scrum Product Owner Interpretation

In this matrix, `Scrum Product Owner` means the Scrum role responsible for translating product and business intent into a clear, ordered, build-ready backlog.

The Scrum Product Owner is accountable for:

- Backlog clarity and ordering.
- Story-level requirements and acceptance criteria.
- Translation of approved non-technical requirements into build-ready backlog items.
- Definition of Ready discipline.
- Product acceptance against agreed criteria.
- Sprint-level tradeoff decisions within approved scope.
- Keeping the delivery team connected to business intent.

The Scrum Product Owner is not automatically the accountable owner for business strategy, business requirements sign-off, market rollout, safety risk acceptance, or post-release business outcomes unless that responsibility is explicitly assigned.
