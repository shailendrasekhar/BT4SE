// Equivalence classes — paper Appendix B.
//
// Each class is the canonical BT topology shared by a set of patterns.
// `topology` is the paper's Figure (rendered as our standard BT spec).
// `members` is a list of pattern ids (must match patterns.js ids).
// `instantiation` describes how the class slots map to each member's roles.

export const CLASSES = [
  {
    id: "A",
    name: "Class A — Guarded-Selection",
    paperRef: "Appendix B.A, Fig. 6",
    summary:
      "Fallback over Condition-guarded Sequences with a default last child. Strategy, Chain of Responsibility, and State are the same topology; they differ only in what the guard tests.",
    keyProperty:
      "Runtime selection among alternatives. Tick auto-reactivity: if the active branch's guard later becomes false, the next tick re-selects without external coordination.",
    topology: {
      kind: "root", label: "Class A topology",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₁ ?" },
            { kind: "action", label: "Action₁" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₂ ?" },
            { kind: "action", label: "Action₂" }
          ]},
          { kind: "action", label: "Default" }
        ]
      }]
    },
    members: ["strategy", "chain-of-responsibility", "state"],
    instantiation: [
      { pattern: "strategy",
        guard: "tests algorithm context (input shape, stability requirement, …)",
        action: "the chosen algorithm" },
      { pattern: "chain-of-responsibility",
        guard: "tests handler capability (canHandle?)",
        action: "the handler's process()" },
      { pattern: "state",
        guard: "tests current object state (current == X?)",
        action: "the state's handle(evt) + transition" }
    ],
    note: "GoF distinguishes by intent (algorithm interchange vs. request handling vs. behavior-by-state); BT collapses them."
  },
  {
    id: "B",
    name: "Class B — Compensable-Action",
    paperRef: "Appendix B.B, Fig. 7",
    summary:
      "Fallback with a primary action and a compensating action. Failure of the primary automatically triggers compensation — no explicit rollback orchestration needed.",
    keyProperty:
      "Failure propagation = compensation. The Fallback semantics already encode the recovery contract.",
    topology: {
      kind: "root", label: "Class B topology",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "action", label: "Primary action" },
          { kind: "action", label: "Compensate" }
        ]
      }]
    },
    members: ["command", "saga-bt", "circuit-breaker", "strangler-fig"],
    instantiation: [
      { pattern: "command",
        guard: "—",
        action: "primary = cmd.execute(); compensate = cmd.undo()" },
      { pattern: "saga-bt",
        guard: "—",
        action: "primary = Tᵢ.commit(); compensate = Compᵢ() (+ unwind prior)" },
      { pattern: "circuit-breaker",
        guard: "—",
        action: "primary = downstream.call(); compensate = fallback response" },
      { pattern: "strangler-fig",
        guard: "service health",
        action: "primary = route to Service; compensate = route to Monolith" }
    ],
    note: "All three differ only in what failure means and what the compensating semantics are; the structural primitive is one Fallback."
  },
  {
    id: "C",
    name: "Class C — Concurrent-Isolation",
    paperRef: "Appendix B.C, Fig. 8",
    summary:
      "Sibling Sequences under a Parallel node. The Parallel composite provides structural failure isolation: a child's failure does not propagate to its siblings.",
    keyProperty:
      "Failure isolation between concurrent execution paths is structural — it falls out of PAR's semantics, not from explicit error handling.",
    topology: {
      kind: "root", label: "Class C topology",
      children: [{
        kind: "parallel", label: "PAR",
        children: [
          { kind: "sequence", label: "SEQ₁", children: [
            { kind: "action", label: "Worker₁" }
          ]},
          { kind: "sequence", label: "SEQ₂", children: [
            { kind: "action", label: "Worker₂" }
          ]},
          { kind: "sequence", label: "SEQ₃", children: [
            { kind: "action", label: "Worker₃" }
          ]}
        ]
      }]
    },
    members: ["bulkhead", "sidecar", "observer", "publish-subscribe", "event-driven"],
    instantiation: [
      { pattern: "bulkhead", guard: "—", action: "workers = isolated resource pools" },
      { pattern: "sidecar", guard: "—", action: "workers = main service + co-processes" },
      { pattern: "observer", guard: "—", action: "workers = notify each registered observer" },
      { pattern: "publish-subscribe", guard: "—", action: "workers = each topic subscriber" },
      { pattern: "event-driven", guard: "interest filter", action: "workers = independent consumers reacting to evt" }
    ],
    note: "GoF separates Observer; cloud-native taxonomy separates Bulkhead and Sidecar. They share one structural primitive: PAR over isolated SEQ children."
  },
  {
    id: "D",
    name: "Class D — Bounded-Retry",
    paperRef: "Appendix B.D",
    summary:
      "Fallback over Wait-then-Retry sequences with an exhausted terminal child. Back-off is expressed by increasing wait durations across siblings; no explicit retry counter is required.",
    keyProperty:
      "The number of siblings bounds the retries; tick semantics handle the wait. Counter state is implicit in the BT structure.",
    topology: {
      kind: "root", label: "Class D topology",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ  attempt 1", children: [
            { kind: "action", label: "Wait₁" },
            { kind: "action", label: "Try" }
          ]},
          { kind: "sequence", label: "SEQ  attempt 2", children: [
            { kind: "action", label: "Wait₂ (> Wait₁)" },
            { kind: "action", label: "Try" }
          ]},
          { kind: "sequence", label: "SEQ  attempt 3", children: [
            { kind: "action", label: "Wait₃ (> Wait₂)" },
            { kind: "action", label: "Try" }
          ]},
          { kind: "action", label: "Exhausted" }
        ]
      }]
    },
    members: ["retry-backoff", "circuit-breaker"],
    instantiation: [
      { pattern: "retry-backoff",
        guard: "—",
        action: "the retried operation; waits grow geometrically (with jitter)" },
      { pattern: "circuit-breaker",
        guard: "—",
        action: "OPEN-state probe loop: each sibling = one cooldown + probe; exhausted ⇒ remain OPEN" }
    ],
    note: "Retry-with-Backoff and Circuit-Breaker probe loop are the same structure with different operation semantics."
  },
  {
    id: "E",
    name: "Class E — Step-with-Hooks",
    paperRef: "Appendix B.E (singleton class)",
    summary:
      "Fixed steps as Action nodes in a Sequence; hook steps are Fallback(override, default). Singleton class — does not collapse with A–D.",
    keyProperty:
      "Open-for-extension at marked hook points; closed elsewhere. Override-or-default is one Fallback per hook.",
    topology: {
      kind: "root", label: "Class E topology",
      children: [{
        kind: "sequence", label: "SEQ  skeleton",
        children: [
          { kind: "action", label: "step1 (fixed)" },
          { kind: "selector", label: "FALL  hook", children: [
            { kind: "action", label: "override.stepA" },
            { kind: "action", label: "default.stepA" }
          ]},
          { kind: "action", label: "step3 (fixed)" }
        ]
      }]
    },
    members: ["template-method"],
    instantiation: [
      { pattern: "template-method",
        guard: "subclass-overrides-this-step?",
        action: "fixed step or override; hooks are FALL(override, default)" }
    ],
    note: "Listed as a singleton class in the paper. Faithfully BT-representable but does not share topology with A–D."
  }
];
