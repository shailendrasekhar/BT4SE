// Pattern -> Behavior Tree specifications.
//
// Vocabulary (paper-aligned, Colledanchise/Ögren formalism):
//   sequence  : SEQ — run children in order; fail on first FAILURE
//   selector  : FALL — try children; succeed on first SUCCESS (Fallback)
//   parallel  : PAR — run all children concurrently; policy decides success
//   condition : leaf, returns SUCCESS/FAILURE based on a check
//   action    : leaf, performs work
//   decorator : kept only as readable sugar for [Repeat] and [ForEach];
//               formally reducible to the 4 primitives + tick semantics.
//   root      : tree root wrapper.
//
// Each pattern has:
//   simple : the equivalence-class topology (paper Appendix B)
//   tree   : the per-pattern instantiation
//   class  : equivalence class id ("A" .. "E", or null if unique)

export const PATTERNS = [
  // ============ MIGRATION (BT-Migrate, paper §IV) ============
  {
    id: "strangler-fig",
    name: "Strangler Fig",
    group: "Migration (BT-Migrate)",
    class: "B",
    summary: "Service is preferred when healthy; monolith is the structural fallback. Tick-based health re-evaluation produces auto-reversion.",
    intent: [
      "Health condition checked on every tick",
      "On failure, fallback child routes to monolith",
      "Same Fallback handles extraction-time and run-time degradation"
    ],
    simple: {
      kind: "root", label: "Strangler",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Svc healthy?" },
            { kind: "action", label: "Route: Svc" }
          ]},
          { kind: "action", label: "Route: Mono" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Strangler.tick()",
      children: [{
        kind: "selector", label: "FALL  (prefer service, else monolith)",
        children: [
          { kind: "sequence", label: "SEQ  service path", children: [
            { kind: "condition", label: "service health probe ok" },
            { kind: "condition", label: "feature flag enables routing" },
            { kind: "action",    label: "route request → Service" }
          ]},
          { kind: "action", label: "route request → Monolith (auto-revert)" }
        ]
      }]
    }
  },
  {
    id: "parallel-run",
    name: "Parallel Run",
    group: "Migration (BT-Migrate)",
    class: null,
    summary: "Service and monolith execute simultaneously into namespaced blackboards; downstream condition compares outputs over N ticks.",
    intent: [
      "Both paths run on every tick",
      "Outputs written to isolated namespaces",
      "Equivalence over N ticks gates promotion (C4)"
    ],
    simple: {
      kind: "root", label: "Parallel Run",
      children: [{
        kind: "parallel", label: "PAR",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "action", label: "Route: Mono" },
            { kind: "action", label: "bb: mono ns" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "action", label: "Route: Svc" },
            { kind: "action", label: "bb: svc ns" }
          ]},
          { kind: "sequence", label: "SEQ verify", children: [
            { kind: "condition", label: "Outputs equal?" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "ParallelRun.tick(req)",
      children: [{
        kind: "parallel", label: "PAR  simultaneous paths",
          note: "all branches tick together; failure isolation",
        children: [
          { kind: "sequence", label: "SEQ  monolith path", children: [
            { kind: "action", label: "monolith.handle(req)" },
            { kind: "action", label: "write bb[mono_ns]" }
          ]},
          { kind: "sequence", label: "SEQ  service path", children: [
            { kind: "action", label: "service.handle(req)" },
            { kind: "action", label: "write bb[svc_ns]" }
          ]},
          { kind: "sequence", label: "SEQ  verify (downstream)", children: [
            { kind: "condition", label: "bb[mono_ns] ≡ bb[svc_ns]" },
            { kind: "condition", label: "stable over N ticks" }
          ]}
        ]
      }]
    }
  },
  {
    id: "saga-bt",
    name: "Saga (BT form)",
    group: "Migration (BT-Migrate)",
    class: "B",
    summary: "Sequence of Fallbacks: each transaction has its compensating action as the fallback child. Sequence-failure propagation triggers compensation in reverse order.",
    intent: [
      "Each step Tᵢ paired with Compᵢ via Fallback",
      "No 2PC; compensation is automatic by failure propagation",
      "Per equivalence class B (Compensable-Action) per step"
    ],
    simple: {
      kind: "root", label: "Saga SEQ",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "selector", label: "FALL", children: [
            { kind: "action", label: "T1" },
            { kind: "action", label: "Comp1" }
          ]},
          { kind: "selector", label: "FALL", children: [
            { kind: "action", label: "T2" },
            { kind: "action", label: "Comp2" }
          ]},
          { kind: "selector", label: "FALL", children: [
            { kind: "action", label: "T3" },
            { kind: "action", label: "Comp3" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Saga.run()",
      children: [{
        kind: "sequence", label: "SEQ  forward; reverse-order compensation on failure",
        children: [
          { kind: "selector", label: "FALL  step 1", children: [
            { kind: "action", label: "T1.commit()" },
            { kind: "action", label: "Comp1()  (no prior to undo)" }
          ]},
          { kind: "selector", label: "FALL  step 2", children: [
            { kind: "action", label: "T2.commit()" },
            { kind: "sequence", label: "SEQ  compensate", children: [
              { kind: "action", label: "Comp2()" },
              { kind: "action", label: "Comp1()" }
            ]}
          ]},
          { kind: "selector", label: "FALL  step 3", children: [
            { kind: "action", label: "T3.commit()" },
            { kind: "sequence", label: "SEQ  compensate (reverse)", children: [
              { kind: "action", label: "Comp3()" },
              { kind: "action", label: "Comp2()" },
              { kind: "action", label: "Comp1()" }
            ]}
          ]}
        ]
      }]
    }
  },
  {
    id: "cdc-gate",
    name: "CDC / Event-Sourcing Gate",
    group: "Migration (BT-Migrate)",
    class: null,
    summary: "Sequence of CDC-polling Conditions: outbox written, CDC picked up, downstream consumed, states consistent — all on the same tick for the gate to pass.",
    intent: [
      "All four sub-conditions must hold simultaneously on a single tick",
      "Automated promotion gate; no separate monitoring tool",
      "Re-evaluated continuously after promotion (Phase 3)"
    ],
    simple: {
      kind: "root", label: "CDC Gate",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "condition", label: "Outbox?" },
          { kind: "condition", label: "CDC up?" },
          { kind: "condition", label: "Consumed?" },
          { kind: "condition", label: "States eq?" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "CDCGate.tick()",
      children: [{
        kind: "sequence", label: "SEQ  all four must hold this tick",
        children: [
          { kind: "condition", label: "outbox row written for evt" },
          { kind: "condition", label: "CDC consumer up & lag < ε" },
          { kind: "condition", label: "downstream svc consumed evt" },
          { kind: "condition", label: "src.state ≡ dst.state (oracle)" }
        ]
      }]
    }
  },
  {
    id: "bt-migrate-phase2",
    name: "BT-Migrate Phase 2",
    group: "Migration (BT-Migrate)",
    class: null,
    summary: "Per-candidate extraction tree: precondition Sequence, deploy, Parallel Run, verification Sequence, then promote-or-revert via the trailing Fallback.",
    intent: [
      "Root SEQ gates promotion through preconditions and verification",
      "Trailing FALL auto-reverts on any failure at any tick",
      "Phase 3 governance is the same tick, indefinitely"
    ],
    simple: {
      kind: "root", label: "Phase-2 Extraction",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "sequence", label: "SEQ pre", children: [
            { kind: "condition", label: "C1" },
            { kind: "condition", label: "C2" },
            { kind: "condition", label: "C3" }
          ]},
          { kind: "action", label: "Deploy" },
          { kind: "parallel", label: "PAR (Mono ‖ Svc)", children: [
            { kind: "action", label: "Mono" },
            { kind: "action", label: "Svc" }
          ]},
          { kind: "sequence", label: "SEQ verify", children: [
            { kind: "condition", label: "C4" },
            { kind: "condition", label: "C5" },
            { kind: "condition", label: "C6" }
          ]},
          { kind: "selector", label: "FALL", children: [
            { kind: "action", label: "Promote" },
            { kind: "action", label: "Revert" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Phase2.tick(candidate)",
      children: [{
        kind: "sequence", label: "SEQ  precond → deploy → run → verify → promote/revert",
        children: [
          { kind: "sequence", label: "SEQ  preconditions", children: [
            { kind: "condition", label: "C1: deps stable" },
            { kind: "condition", label: "C2: annotation-ready" },
            { kind: "condition", label: "C3: no circular deps" }
          ]},
          { kind: "action", label: "CI/CD deploy candidate" },
          { kind: "parallel", label: "PAR  parallel run", children: [
            { kind: "action", label: "monolith path → bb[mono]" },
            { kind: "action", label: "service path → bb[svc]" }
          ]},
          { kind: "sequence", label: "SEQ  verification gates", children: [
            { kind: "condition", label: "C4: output equiv over N ticks" },
            { kind: "condition", label: "C5: CDC consistency" },
            { kind: "condition", label: "C6: Saga integrity" }
          ]},
          { kind: "selector", label: "FALL  promote-or-revert", children: [
            { kind: "action", label: "Promote (cutover)" },
            { kind: "action", label: "Auto-revert to monolith" }
          ]}
        ]
      }]
    }
  },

  // ============ CREATIONAL (GoF) ============
  {
    id: "singleton",
    name: "Singleton",
    group: "Creational (GoF)",
    class: null,
    summary: "Ensures a class has exactly one instance and provides a global access point to it.",
    intent: [
      "Single shared instance for an entire process",
      "Lazy or eager instantiation behind a guarded accessor",
      "Useful for caches, registries, loggers — abused often"
    ],
    simple: {
      kind: "root", label: "getInstance()",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "instance != null" },
            { kind: "action",    label: "return instance" }
          ]},
          { kind: "action", label: "create + return" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Singleton.getInstance()",
      children: [{
        kind: "selector", label: "FALL  return-or-create",
        children: [
          { kind: "sequence", label: "SEQ  fast path", children: [
            { kind: "condition", label: "instance != null" },
            { kind: "action", label: "return instance" }
          ]},
          { kind: "sequence", label: "SEQ  slow path (locked)", children: [
            { kind: "action", label: "lock()" },
            { kind: "selector", label: "FALL  DCLP recheck", children: [
              { kind: "sequence", label: "SEQ", children: [
                { kind: "condition", label: "instance != null (recheck)" },
                { kind: "action",    label: "return instance" }
              ]},
              { kind: "sequence", label: "SEQ", children: [
                { kind: "action", label: "instance = new T()" },
                { kind: "action", label: "return instance" }
              ]}
            ]},
            { kind: "action", label: "unlock()" }
          ]}
        ]
      }]
    }
  },
  {
    id: "factory-method",
    name: "Factory Method",
    group: "Creational (GoF)",
    class: null,
    summary: "Defines an interface for creating an object but lets subclasses decide which class to instantiate.",
    intent: [
      "Defer instantiation to subclasses",
      "Client depends on the abstract product, not the concrete class",
      "Variant: parameterized factory method"
    ],
    simple: {
      kind: "root", label: "create(spec)",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "spec ≡ A" },
            { kind: "action", label: "return ProductA" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "spec ≡ B" },
            { kind: "action", label: "return ProductB" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Creator.create(spec)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "preProcess(spec)" },
          { kind: "selector", label: "FALL  pick concrete creator", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "spec matches A" },
              { kind: "action",    label: "p = new ProductA()" }
            ]},
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "spec matches B" },
              { kind: "action",    label: "p = new ProductB()" }
            ]},
            { kind: "action", label: "throw UnsupportedSpec" }
          ]},
          { kind: "action", label: "postInit(p)" },
          { kind: "action", label: "return p" }
        ]
      }]
    }
  },
  {
    id: "abstract-factory",
    name: "Abstract Factory",
    group: "Creational (GoF)",
    class: null,
    summary: "Provides an interface for creating families of related objects without specifying their concrete classes.",
    intent: [
      "Create entire product families consistently",
      "Swap whole family by swapping the factory",
      "Adds a level of indirection over Factory Method"
    ],
    simple: {
      kind: "root", label: "buildFamily()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "factory = pick()" },
          { kind: "action", label: "build all products" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "AbstractFactory.buildFamily()",
      children: [{
        kind: "sequence", label: "SEQ  resolve + build",
        children: [
          { kind: "selector", label: "FALL  resolve concrete factory", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "platform == Win" },
              { kind: "action", label: "factory = WinFactory" }
            ]},
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "platform == Mac" },
              { kind: "action", label: "factory = MacFactory" }
            ]}
          ]},
          { kind: "sequence", label: "SEQ  build family (ordered)", children: [
            { kind: "action", label: "factory.createButton()" },
            { kind: "action", label: "factory.createCheckbox()" },
            { kind: "action", label: "factory.createWindow()" }
          ]},
          { kind: "action", label: "return Family{...}" }
        ]
      }]
    }
  },
  {
    id: "builder",
    name: "Builder",
    group: "Creational (GoF)",
    class: null,
    summary: "Separates the construction of a complex object from its representation.",
    intent: [
      "Step-wise construction of complex objects",
      "Same steps can yield different representations",
      "Director orchestrates, Builder builds, Product is the result"
    ],
    simple: {
      kind: "root", label: "construct()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "buildPartA" },
          { kind: "action", label: "buildPartB" },
          { kind: "action", label: "return result" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Director.construct(builder)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "builder.reset()" },
          { kind: "action", label: "builder.buildPartA()" },
          { kind: "action", label: "builder.buildPartB()" },
          { kind: "selector", label: "FALL  optional", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "needsExtras" },
              { kind: "action", label: "builder.buildExtras()" }
            ]},
            { kind: "action", label: "skip" }
          ]},
          { kind: "action", label: "return builder.getResult()" }
        ]
      }]
    }
  },
  {
    id: "prototype",
    name: "Prototype",
    group: "Creational (GoF)",
    class: null,
    summary: "Creates new objects by copying an existing instance (prototype) rather than instantiating a class.",
    intent: [
      "Avoid expensive construction by cloning",
      "Registry of pre-configured prototypes",
      "Deep vs shallow copy is the main pitfall"
    ],
    simple: {
      kind: "root", label: "clone(key)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "condition", label: "registry.has(key)" },
          { kind: "action", label: "return copy(registry[key])" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Client.clone(key)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "condition", label: "registry.has(key)" },
          { kind: "action", label: "proto = registry.get(key)" },
          { kind: "selector", label: "FALL  copy strategy", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "proto.requiresDeepCopy" },
              { kind: "action", label: "return deepCopy(proto)" }
            ]},
            { kind: "action", label: "return shallowCopy(proto)" }
          ]}
        ]
      }]
    }
  },

  // ============ STRUCTURAL (GoF) ============
  {
    id: "adapter",
    name: "Adapter",
    group: "Structural (GoF)",
    class: null,
    summary: "Converts the interface of a class into another interface clients expect.",
    intent: [
      "Bridge incompatible interfaces",
      "Wrap legacy / 3rd-party API in target interface",
      "Object adapter (composition) vs class adapter (inheritance)"
    ],
    simple: {
      kind: "root", label: "Adapter.request()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "translate input" },
          { kind: "action", label: "adaptee.specificRequest()" },
          { kind: "action", label: "translate result" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Adapter.request()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "translate(input → adapteeFmt)" },
          { kind: "action", label: "result = adaptee.specificRequest()" },
          { kind: "action", label: "translate(result → clientFmt)" },
          { kind: "action", label: "return result" }
        ]
      }]
    }
  },
  {
    id: "bridge",
    name: "Bridge",
    group: "Structural (GoF)",
    class: null,
    summary: "Decouples an abstraction from its implementation so the two can vary independently.",
    intent: [
      "Avoid Cartesian explosion of subclasses",
      "Abstraction holds reference to Implementor",
      "Both hierarchies evolve independently"
    ],
    simple: {
      kind: "root", label: "Abstraction.op()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "abstraction logic" },
          { kind: "action", label: "impl.operationImpl()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Abstraction.operation()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "preprocess (abstraction side)" },
          { kind: "selector", label: "FALL  pick implementor", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "ctx wants A" },
              { kind: "action", label: "impl = ConcreteImplA" }
            ]},
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "ctx wants B" },
              { kind: "action", label: "impl = ConcreteImplB" }
            ]}
          ]},
          { kind: "action", label: "impl.operationImpl()" },
          { kind: "action", label: "postprocess" }
        ]
      }]
    }
  },
  {
    id: "composite",
    name: "Composite",
    group: "Structural (GoF)",
    class: null,
    summary: "Composes objects into tree structures and lets clients treat individual objects and compositions uniformly.",
    intent: [
      "Part-whole hierarchies",
      "Same op over leaf and composite",
      "Recursion is the natural traversal"
    ],
    simple: {
      kind: "root", label: "Component.op()",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ leaf", children: [
            { kind: "condition", label: "isLeaf" },
            { kind: "action", label: "doWork" }
          ]},
          { kind: "decorator", label: "[ForEach child]", children: [
            { kind: "action", label: "child.op()" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Component.operation()",
      children: [{
        kind: "selector", label: "FALL  leaf vs composite",
        children: [
          { kind: "sequence", label: "SEQ  leaf", children: [
            { kind: "condition", label: "isLeaf" },
            { kind: "action", label: "doWork()" }
          ]},
          { kind: "sequence", label: "SEQ  composite", children: [
            { kind: "condition", label: "hasChildren" },
            { kind: "decorator", label: "[ForEach child]", children: [
              { kind: "action", label: "child.operation()" }
            ]},
            { kind: "action", label: "aggregate()" }
          ]}
        ]
      }]
    }
  },
  {
    id: "decorator-pattern",
    name: "Decorator",
    group: "Structural (GoF)",
    class: null,
    summary: "Attaches additional responsibilities to an object dynamically by wrapping it.",
    intent: [
      "Add behavior without subclassing",
      "Decorators stack — order matters",
      "Same interface as wrapped component"
    ],
    simple: {
      kind: "root", label: "Decorator.op()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "before()" },
          { kind: "action", label: "wrappee.op()" },
          { kind: "action", label: "after()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Decorator.operation()",
      children: [{
        kind: "sequence", label: "SEQ  wrap call",
        children: [
          { kind: "action", label: "before()  // pre-hook" },
          { kind: "action", label: "wrappee.operation()" },
          { kind: "action", label: "after()   // post-hook" }
        ]
      }]
    }
  },
  {
    id: "facade",
    name: "Facade",
    group: "Structural (GoF)",
    class: null,
    summary: "Provides a unified interface to a set of interfaces in a subsystem.",
    intent: [
      "Hide subsystem complexity behind one entry point",
      "Reduce coupling between client and subsystem",
      "Doesn't forbid direct subsystem access"
    ],
    simple: {
      kind: "root", label: "Facade.doX()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "subA.step" },
          { kind: "action", label: "subB.step" },
          { kind: "action", label: "subC.step" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Facade.doX()",
      children: [{
        kind: "sequence", label: "SEQ  orchestrate subsystem",
        children: [
          { kind: "action", label: "subsystemA.init()" },
          { kind: "action", label: "subsystemB.configure(...)" },
          { kind: "action", label: "subsystemC.execute()" },
          { kind: "action", label: "return aggregatedResult" }
        ]
      }]
    }
  },
  {
    id: "flyweight",
    name: "Flyweight",
    group: "Structural (GoF)",
    class: null,
    summary: "Shares fine-grained objects efficiently by separating intrinsic and extrinsic state.",
    intent: [
      "Massive object counts → share intrinsic state",
      "Extrinsic state passed in per call",
      "Pool keyed by intrinsic identity"
    ],
    simple: {
      kind: "root", label: "Factory.get(key)",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "pool.has(key)" },
            { kind: "action", label: "return pool[key]" }
          ]},
          { kind: "action", label: "create + cache + return" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "FlyweightFactory.get(key)",
      children: [{
        kind: "selector", label: "FALL  cached or create",
        children: [
          { kind: "sequence", label: "SEQ  cached", children: [
            { kind: "condition", label: "pool.has(key)" },
            { kind: "action", label: "return pool[key]" }
          ]},
          { kind: "sequence", label: "SEQ  create + cache", children: [
            { kind: "action", label: "fw = new Flyweight(intrinsic)" },
            { kind: "action", label: "pool[key] = fw" },
            { kind: "action", label: "return fw" }
          ]}
        ]
      }]
    }
  },
  {
    id: "proxy",
    name: "Proxy",
    group: "Structural (GoF)",
    class: null,
    summary: "Provides a surrogate or placeholder for another object to control access to it.",
    intent: [
      "Variants: virtual (lazy), protection, remote, smart-ref, cache",
      "Same interface as real subject",
      "Inserts checks/lifecycle around the real call"
    ],
    simple: {
      kind: "root", label: "Proxy.request()",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "condition", label: "authorized" },
          { kind: "action", label: "real.request()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Proxy.request()",
      children: [{
        kind: "sequence", label: "SEQ  guard + delegate",
        children: [
          { kind: "condition", label: "client.authorized" },
          { kind: "selector", label: "FALL  cache check", children: [
            { kind: "sequence", label: "SEQ  hit", children: [
              { kind: "condition", label: "cache.has(req)" },
              { kind: "action", label: "return cache[req]" }
            ]},
            { kind: "sequence", label: "SEQ  miss", children: [
              { kind: "action", label: "ensure realSubject (lazy)" },
              { kind: "action", label: "result = real.request()" },
              { kind: "action", label: "cache[req] = result" },
              { kind: "action", label: "return result" }
            ]}
          ]}
        ]
      }]
    }
  },

  // ============ BEHAVIORAL (GoF) ============
  {
    id: "chain-of-responsibility",
    name: "Chain of Responsibility",
    group: "Behavioral (GoF)",
    class: "A",
    summary: "Passes a request along a chain of handlers; each decides to handle it or pass it on. Class A: Guarded-Selection topology.",
    intent: [
      "Decouple sender from receiver",
      "Dynamic, runtime-configurable chain",
      "Class A: guard tests handler capability"
    ],
    simple: {
      kind: "root", label: "Chain",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₁: A.canHandle?" },
            { kind: "action", label: "Action₁: A.process" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₂: B.canHandle?" },
            { kind: "action", label: "Action₂: B.process" }
          ]},
          { kind: "action", label: "Default" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Chain.handle(req)",
      children: [{
        kind: "selector", label: "FALL  first handler that succeeds",
        children: [
          { kind: "sequence", label: "SEQ  HandlerA", children: [
            { kind: "condition", label: "A.canHandle(req)" },
            { kind: "action", label: "A.process(req)" }
          ]},
          { kind: "sequence", label: "SEQ  HandlerB", children: [
            { kind: "condition", label: "B.canHandle(req)" },
            { kind: "action", label: "B.process(req)" }
          ]},
          { kind: "sequence", label: "SEQ  HandlerC", children: [
            { kind: "condition", label: "C.canHandle(req)" },
            { kind: "action", label: "C.process(req)" }
          ]},
          { kind: "action", label: "default / drop" }
        ]
      }]
    }
  },
  {
    id: "command",
    name: "Command",
    group: "Behavioral (GoF)",
    class: "B",
    summary: "Encapsulates a request as an object; with undo, the action and its compensation form a Class B Compensable-Action pair.",
    intent: [
      "Action as first-class object",
      "Class B: primary action + compensating action under FALL",
      "Failure of execute triggers compensation automatically"
    ],
    simple: {
      kind: "root", label: "Command",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "action", label: "Primary: cmd.execute()" },
          { kind: "action", label: "Compensate: cmd.undo()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Invoker.dispatch(cmd)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "cmd.snapshot()  // for undo" },
          { kind: "selector", label: "FALL  execute or compensate", children: [
            { kind: "sequence", label: "SEQ  execute path", children: [
              { kind: "action", label: "cmd.execute()" },
              { kind: "action", label: "history.push(cmd)" }
            ]},
            { kind: "action", label: "cmd.undo()  // compensate" }
          ]}
        ]
      }]
    }
  },
  {
    id: "interpreter",
    name: "Interpreter",
    group: "Behavioral (GoF)",
    class: null,
    summary: "Defines a representation for a grammar and an interpreter that uses it.",
    intent: [
      "Map grammar rules to classes",
      "Walk AST recursively",
      "Best for small, stable DSLs"
    ],
    simple: {
      kind: "root", label: "interpret(node)",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "isTerminal" },
            { kind: "action", label: "ctx.lookup(name)" }
          ]},
          { kind: "action", label: "interpret children + combine" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Expression.interpret(ctx)",
      children: [{
        kind: "selector", label: "FALL  AST kind",
        children: [
          { kind: "sequence", label: "SEQ  terminal", children: [
            { kind: "condition", label: "isTerminal" },
            { kind: "action", label: "return ctx.lookup(name)" }
          ]},
          { kind: "sequence", label: "SEQ  non-terminal", children: [
            { kind: "condition", label: "hasChildren" },
            { kind: "sequence", label: "SEQ  interpret in order", children: [
              { kind: "action", label: "left.interpret(ctx)" },
              { kind: "action", label: "right.interpret(ctx)" }
            ]},
            { kind: "action", label: "combine(results)" }
          ]}
        ]
      }]
    }
  },
  {
    id: "iterator",
    name: "Iterator",
    group: "Behavioral (GoF)",
    class: null,
    summary: "Provides a way to access elements of an aggregate sequentially without exposing its representation.",
    intent: [
      "Decouple traversal from collection",
      "Multiple simultaneous traversals",
      "Tick-driven step is the natural BT form"
    ],
    simple: {
      kind: "root", label: "Iterator",
      children: [{
        kind: "decorator", label: "[Repeat while hasNext]",
        children: [
          { kind: "action", label: "consume(next())" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Iterator.traverse()",
      children: [{
        kind: "decorator", label: "[Repeat: while hasNext]",
        children: [
          { kind: "sequence", label: "SEQ  step",
            children: [
              { kind: "condition", label: "iter.hasNext()" },
              { kind: "action", label: "item = iter.next()" },
              { kind: "action", label: "client.consume(item)" }
            ]
          }
        ]
      }]
    }
  },
  {
    id: "mediator",
    name: "Mediator",
    group: "Behavioral (GoF)",
    class: null,
    summary: "Defines an object that encapsulates how a set of objects interact, replacing many-to-many with one-to-many.",
    intent: [
      "Centralize complex inter-component communication",
      "Components know mediator only",
      "Prevents object spaghetti"
    ],
    simple: {
      kind: "root", label: "Mediator.notify(evt)",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "action", label: "evt=A → updateX,Y" },
          { kind: "action", label: "evt=B → updateZ" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Mediator.notify(sender, evt)",
      children: [{
        kind: "selector", label: "FALL  route by event",
        children: [
          { kind: "sequence", label: "SEQ  evt=A", children: [
            { kind: "condition", label: "evt == A" },
            { kind: "sequence", label: "SEQ  notify subset (in order)", children: [
              { kind: "action", label: "compX.update()" },
              { kind: "action", label: "compY.update()" }
            ]}
          ]},
          { kind: "sequence", label: "SEQ  evt=B", children: [
            { kind: "condition", label: "evt == B" },
            { kind: "action", label: "compZ.update()" }
          ]},
          { kind: "action", label: "ignore" }
        ]
      }]
    }
  },
  {
    id: "memento",
    name: "Memento",
    group: "Behavioral (GoF)",
    class: null,
    summary: "Captures and externalizes an object's internal state so it can be restored later, without violating encapsulation.",
    intent: [
      "Snapshot for undo / checkpoint",
      "Caretaker stores, doesn't inspect",
      "Originator owns the state"
    ],
    simple: {
      kind: "root", label: "checkpoint",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "action", label: "save → caretaker.push" },
          { kind: "action", label: "restore → caretaker.pop" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Editor.checkpoint()",
      children: [{
        kind: "selector", label: "FALL  save or restore",
        children: [
          { kind: "sequence", label: "SEQ  save", children: [
            { kind: "condition", label: "user.requestsSave" },
            { kind: "action", label: "m = originator.save()" },
            { kind: "action", label: "caretaker.push(m)" }
          ]},
          { kind: "sequence", label: "SEQ  restore", children: [
            { kind: "condition", label: "user.requestsUndo" },
            { kind: "action", label: "m = caretaker.pop()" },
            { kind: "action", label: "originator.restore(m)" }
          ]}
        ]
      }]
    }
  },
  {
    id: "observer",
    name: "Observer",
    group: "Behavioral (GoF)",
    class: "C",
    summary: "Defines a one-to-many dependency. The notification fan-out is Class C: Concurrent-Isolation.",
    intent: [
      "Pub/sub at object level",
      "Class C: parallel of sequences provides failure isolation across observers",
      "Subject knows nothing about observers' types"
    ],
    simple: {
      kind: "root", label: "Subject.setState(s)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "state = s" },
          { kind: "parallel", label: "PAR  notify all", children: [
            { kind: "action", label: "obs[0].update" },
            { kind: "action", label: "obs[1].update" },
            { kind: "action", label: "obs[N].update" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Subject.setState(s)",
      children: [{
        kind: "sequence", label: "SEQ  update + isolated fan-out",
        children: [
          { kind: "action", label: "state = s" },
          { kind: "condition", label: "observers.size > 0" },
          { kind: "parallel", label: "PAR  Class C — failure-isolated",
            note: "child failure ≠ siblings' status",
            children: [
              { kind: "sequence", label: "SEQ  obs[0]", children: [
                { kind: "action", label: "obs[0].update(state)" }
              ]},
              { kind: "sequence", label: "SEQ  obs[1]", children: [
                { kind: "action", label: "obs[1].update(state)" }
              ]},
              { kind: "sequence", label: "SEQ  obs[N]", children: [
                { kind: "action", label: "obs[N].update(state)" }
              ]}
            ]
          }
        ]
      }]
    }
  },
  {
    id: "state",
    name: "State",
    group: "Behavioral (GoF)",
    class: "A",
    summary: "Behavior changes with internal state. Class A: Guarded-Selection where the guard tests the current object state.",
    intent: [
      "FSM modeled with state objects",
      "Class A: guard tests current state",
      "Each state encapsulates its transitions"
    ],
    simple: {
      kind: "root", label: "Context",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₁: in StateA?" },
            { kind: "action", label: "Action₁: A.handle" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₂: in StateB?" },
            { kind: "action", label: "Action₂: B.handle" }
          ]},
          { kind: "action", label: "Default" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Context.handle(evt)",
      children: [{
        kind: "selector", label: "FALL  dispatch by current state",
        children: [
          { kind: "sequence", label: "SEQ  StateA", children: [
            { kind: "condition", label: "current == A" },
            { kind: "action", label: "A.handle(evt)" },
            { kind: "action", label: "maybe transition → B" }
          ]},
          { kind: "sequence", label: "SEQ  StateB", children: [
            { kind: "condition", label: "current == B" },
            { kind: "action", label: "B.handle(evt)" },
            { kind: "action", label: "maybe transition → C" }
          ]},
          { kind: "sequence", label: "SEQ  StateC", children: [
            { kind: "condition", label: "current == C" },
            { kind: "action", label: "C.handle(evt)" }
          ]}
        ]
      }]
    }
  },
  {
    id: "strategy",
    name: "Strategy",
    group: "Behavioral (GoF)",
    class: "A",
    summary: "Family of interchangeable algorithms. Class A: Guarded-Selection where the guard tests the algorithm context.",
    intent: [
      "Algorithm as a plug-in object",
      "Class A: guard tests algorithm context (size, stability, …)",
      "Open/closed for new strategies"
    ],
    simple: {
      kind: "root", label: "Context",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₁: needsFast?" },
            { kind: "action", label: "Action₁: QuickSort" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "Guard₂: needsStable?" },
            { kind: "action", label: "Action₂: MergeSort" }
          ]},
          { kind: "action", label: "Default: HeapSort" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Context.execute(input)",
      children: [{
        kind: "selector", label: "FALL  pick strategy by guard",
        children: [
          { kind: "sequence", label: "SEQ  fast path", children: [
            { kind: "condition", label: "input small" },
            { kind: "action", label: "QuickSort.run(input)" }
          ]},
          { kind: "sequence", label: "SEQ  stable path", children: [
            { kind: "condition", label: "needsStability" },
            { kind: "action", label: "MergeSort.run(input)" }
          ]},
          { kind: "action", label: "HeapSort.run(input)" }
        ]
      }]
    }
  },
  {
    id: "template-method",
    name: "Template Method",
    group: "Behavioral (GoF)",
    class: "E",
    summary: "Algorithm skeleton with overridable steps. Class E: Step-with-Hooks — fixed steps in SEQ, hooks as FALL(override, default).",
    intent: [
      "Invariant skeleton, variant steps",
      "Class E: each hook is FALL(override, default)",
      "Hollywood Principle: don't call us"
    ],
    simple: {
      kind: "root", label: "templateMethod",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "step1 (fixed)" },
          { kind: "selector", label: "FALL  hook2", children: [
            { kind: "action", label: "override.step2" },
            { kind: "action", label: "default.step2" }
          ]},
          { kind: "action", label: "step3 (fixed)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Base.templateMethod()",
      children: [{
        kind: "sequence", label: "SEQ  skeleton with hooks",
        children: [
          { kind: "action", label: "step1()  // fixed" },
          { kind: "selector", label: "FALL  hook A", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "subclass overrides A" },
              { kind: "action", label: "subclass.stepA()" }
            ]},
            { kind: "action", label: "default.stepA()" }
          ]},
          { kind: "selector", label: "FALL  hook B", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "subclass overrides B" },
              { kind: "action", label: "subclass.stepB()" }
            ]},
            { kind: "action", label: "default.stepB()" }
          ]},
          { kind: "action", label: "finalize()  // fixed" }
        ]
      }]
    }
  },
  {
    id: "visitor",
    name: "Visitor",
    group: "Behavioral (GoF)",
    class: null,
    summary: "Operation on elements of a structure without changing the classes; double dispatch.",
    intent: [
      "Add operations without modifying element classes",
      "Double dispatch: element.accept(visitor) → visitor.visitX(element)",
      "Element classes must be stable"
    ],
    simple: {
      kind: "root", label: "visitAll",
      children: [{
        kind: "decorator", label: "[ForEach element]",
        children: [
          { kind: "action", label: "elem.accept(visitor)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Visitor.visitAll(elements)",
      children: [{
        kind: "decorator", label: "[ForEach element]",
        children: [
          { kind: "sequence", label: "SEQ  double dispatch",
            children: [
              { kind: "action", label: "elem.accept(visitor)" },
              { kind: "action", label: "  → visitor.visitConcrete(elem)" }
            ]
          }
        ]
      }]
    }
  },

  // ============ ARCHITECTURAL ============
  {
    id: "mvc",
    name: "MVC (Model-View-Controller)",
    group: "Architectural",
    class: null,
    summary: "Controller mutates Model; View renders in response to Model notifications.",
    intent: [
      "Controller mutates Model, View observes Model",
      "Classic web request lifecycle",
      "Variants: passive vs active model"
    ],
    simple: {
      kind: "root", label: "RequestCycle",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Controller.handle" },
          { kind: "action", label: "Model.mutate" },
          { kind: "action", label: "View.render" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "RequestCycle",
      children: [{
        kind: "sequence", label: "SEQ  MVC flow",
        children: [
          { kind: "action", label: "Controller.receive(input)" },
          { kind: "action", label: "Controller.validate()" },
          { kind: "action", label: "Model.mutate(...)" },
          { kind: "action", label: "Model.notifyObservers()" },
          { kind: "action", label: "View.render(model)  // reacts to notify" },
          { kind: "action", label: "return response" }
        ]
      }]
    }
  },
  {
    id: "mvvm",
    name: "MVVM (Model-View-ViewModel)",
    group: "Architectural",
    class: null,
    summary: "GUI bound to a ViewModel; ViewModel mutates Model; bindings push back to View.",
    intent: [
      "Two-way data binding View ↔ ViewModel",
      "ViewModel has no reference to View",
      "Common in WPF, SwiftUI, Vue"
    ],
    simple: {
      kind: "root", label: "UserInteraction",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "View → VM.cmd" },
          { kind: "action", label: "VM mutates Model" },
          { kind: "action", label: "binding pushes to View" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "UserInteraction",
      children: [{
        kind: "sequence", label: "SEQ  MVVM flow",
        children: [
          { kind: "action", label: "View.fireBoundCommand()" },
          { kind: "action", label: "ViewModel.executeCommand()" },
          { kind: "action", label: "Model.update()" },
          { kind: "action", label: "ViewModel.refreshObservables()" },
          { kind: "action", label: "View.autoUpdate (binding fires)" }
        ]
      }]
    }
  },
  {
    id: "mvp",
    name: "MVP (Model-View-Presenter)",
    group: "Architectural",
    class: null,
    summary: "Presenter holds UI logic; pushes view-state to a passive View.",
    intent: [
      "Highly testable — Presenter is pure logic",
      "View is dumb, references Presenter",
      "Variant: supervising controller"
    ],
    simple: {
      kind: "root", label: "View.event",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Presenter.onEvent" },
          { kind: "action", label: "Model.update" },
          { kind: "action", label: "Presenter → View.show" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "View.event()",
      children: [{
        kind: "sequence", label: "SEQ  MVP flow",
        children: [
          { kind: "action", label: "View → Presenter.onEvent()" },
          { kind: "action", label: "Presenter.processBusinessLogic()" },
          { kind: "action", label: "Model.update()" },
          { kind: "action", label: "Presenter.formatForView()" },
          { kind: "action", label: "Presenter → View.show(viewState)" }
        ]
      }]
    }
  },
  {
    id: "layered",
    name: "Layered Architecture",
    group: "Architectural",
    class: null,
    summary: "Strictly downward dependencies through presentation, application, domain, infrastructure.",
    intent: [
      "Strict downward dependency rule",
      "Easy to reason about, can become anemic",
      "Foundational for most enterprise apps"
    ],
    simple: {
      kind: "root", label: "Request",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Presentation" },
          { kind: "action", label: "Application" },
          { kind: "action", label: "Domain" },
          { kind: "action", label: "Infrastructure" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Request.descend()",
      children: [{
        kind: "sequence", label: "SEQ  top-down",
        children: [
          { kind: "action", label: "Presentation.handle(req)" },
          { kind: "action", label: "Application.orchestrate()" },
          { kind: "action", label: "Domain.executeRules()" },
          { kind: "action", label: "Infrastructure.persist/io" },
          { kind: "action", label: "← bubble up response" }
        ]
      }]
    }
  },
  {
    id: "hexagonal",
    name: "Hexagonal (Ports & Adapters)",
    group: "Architectural",
    class: null,
    summary: "Domain isolated; outside world plugs in via ports and adapters.",
    intent: [
      "Domain has no outward dependencies",
      "Drivers (UI, tests) call inbound ports",
      "Driven adapters fulfill outbound ports"
    ],
    simple: {
      kind: "root", label: "Inbound.handle",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Inbound → Port" },
          { kind: "action", label: "Domain logic" },
          { kind: "action", label: "Outbound ports" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "InboundAdapter.handle()",
      children: [{
        kind: "sequence", label: "SEQ  through the hex",
        children: [
          { kind: "action", label: "InboundAdapter → InboundPort" },
          { kind: "action", label: "ApplicationService.invoke()" },
          { kind: "action", label: "Domain.run()" },
          { kind: "sequence", label: "SEQ  outbound ports (in order)", children: [
            { kind: "action", label: "Repo (DB adapter)" },
            { kind: "action", label: "EmailGateway adapter" },
            { kind: "action", label: "EventBus adapter" }
          ]},
          { kind: "action", label: "return DTO" }
        ]
      }]
    }
  },
  {
    id: "clean",
    name: "Clean Architecture",
    group: "Architectural",
    class: null,
    summary: "Concentric layers; dependencies point inward.",
    intent: [
      "Entities < UseCases < Adapters < Frameworks",
      "Inversion at every boundary",
      "Independent of UI, DB, framework"
    ],
    simple: {
      kind: "root", label: "Frameworks → in",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Adapter (Controller)" },
          { kind: "action", label: "UseCase.execute" },
          { kind: "action", label: "Entity rules" },
          { kind: "action", label: "Presenter → View" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Frameworks.invoke()",
      children: [{
        kind: "sequence", label: "SEQ  inward call",
        children: [
          { kind: "action", label: "Controller (Adapter)" },
          { kind: "action", label: "UseCase.execute(inputBoundary)" },
          { kind: "action", label: "Entity.applyRules()" },
          { kind: "action", label: "Gateway (port → adapter)" },
          { kind: "action", label: "Presenter (outputBoundary)" },
          { kind: "action", label: "View.render(viewModel)" }
        ]
      }]
    }
  },
  {
    id: "microservices",
    name: "Microservices",
    group: "Architectural",
    class: null,
    summary: "Small, independently deployable services; aggregator BFF often does scatter-gather.",
    intent: [
      "Service per bounded context",
      "Independent deploy, scale, store",
      "Scatter-gather is the natural Class-C use"
    ],
    simple: {
      kind: "root", label: "Edge.route",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Gateway.route" },
          { kind: "action", label: "auth + service(s)" },
          { kind: "action", label: "respond / aggregate" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Request → Edge",
      children: [{
        kind: "sequence", label: "SEQ  distributed flow",
        children: [
          { kind: "action", label: "API Gateway.route()" },
          { kind: "selector", label: "FALL  AuthN/Z", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "token valid" },
              { kind: "action", label: "forward" }
            ]},
            { kind: "action", label: "401 / 403" }
          ]},
          { kind: "selector", label: "FALL  single vs scatter-gather", children: [
            { kind: "sequence", label: "SEQ  single", children: [
              { kind: "condition", label: "one service needed" },
              { kind: "action", label: "call ServiceX" }
            ]},
            { kind: "sequence", label: "SEQ  aggregator (Class C)", children: [
              { kind: "condition", label: "aggregation needed" },
              { kind: "parallel", label: "PAR  fan-out", children: [
                { kind: "action", label: "OrderService" },
                { kind: "action", label: "InventoryService" },
                { kind: "action", label: "PaymentService" }
              ]},
              { kind: "action", label: "merge results" }
            ]}
          ]},
          { kind: "action", label: "respond" }
        ]
      }]
    }
  },
  {
    id: "event-driven",
    name: "Event-Driven Architecture",
    group: "Architectural",
    class: "C",
    summary: "Producer emits events; many consumers react in isolation. Class C topology over consumers.",
    intent: [
      "Loose coupling via async events",
      "Class C: PAR-of-SEQs over consumers; failures isolated",
      "Eventual consistency is the default"
    ],
    simple: {
      kind: "root", label: "Producer.emit",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Broker.append(evt)" },
          { kind: "parallel", label: "PAR  isolated consumers", children: [
            { kind: "action", label: "ConsumerA" },
            { kind: "action", label: "ConsumerB" },
            { kind: "action", label: "AuditLog" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Producer.emit(evt)",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Broker.append(evt)" },
          { kind: "parallel", label: "PAR  Class C — at-least-once",
            children: [
              { kind: "sequence", label: "SEQ  ConsumerA", children: [
                { kind: "condition", label: "interested in evt" },
                { kind: "action", label: "A.handle(evt)" }
              ]},
              { kind: "sequence", label: "SEQ  ConsumerB", children: [
                { kind: "condition", label: "interested in evt" },
                { kind: "action", label: "B.handle(evt)" }
              ]},
              { kind: "sequence", label: "SEQ  AuditLog", children: [
                { kind: "action", label: "persist evt" }
              ]}
            ]
          }
        ]
      }]
    }
  },
  {
    id: "cqrs",
    name: "CQRS",
    group: "Architectural",
    class: null,
    summary: "Splits read and write models so each can be optimized independently.",
    intent: [
      "Commands mutate, Queries read",
      "Often paired with Event Sourcing",
      "Allows different storage per side"
    ],
    simple: {
      kind: "root", label: "Request",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "is mutation" },
            { kind: "action", label: "WriteModel.apply" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "is read" },
            { kind: "action", label: "ReadModel.fetch" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Request → CQRS",
      children: [{
        kind: "selector", label: "FALL  command or query",
        children: [
          { kind: "sequence", label: "SEQ  command", children: [
            { kind: "condition", label: "is mutation" },
            { kind: "action", label: "CommandHandler.execute()" },
            { kind: "action", label: "WriteModel.apply()" },
            { kind: "action", label: "publish DomainEvent" },
            { kind: "action", label: "ReadModel.project(evt)  // eventually" }
          ]},
          { kind: "sequence", label: "SEQ  query", children: [
            { kind: "condition", label: "is read" },
            { kind: "action", label: "QueryHandler.run()" },
            { kind: "action", label: "ReadModel.fetch()" }
          ]}
        ]
      }]
    }
  },
  {
    id: "event-sourcing",
    name: "Event Sourcing",
    group: "Architectural",
    class: null,
    summary: "Persist state as a sequence of events; current state is derived by replay.",
    intent: [
      "Events are the source of truth",
      "Snapshots are an optimization",
      "Natural audit log, time travel"
    ],
    simple: {
      kind: "root", label: "Aggregate.handle",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "rehydrate from events" },
          { kind: "action", label: "validate + emit event" },
          { kind: "action", label: "EventStore.append" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Aggregate.handle(cmd)",
      children: [{
        kind: "sequence", label: "SEQ  append-only flow",
        children: [
          { kind: "action", label: "load events for id" },
          { kind: "action", label: "rehydrate state (fold)" },
          { kind: "action", label: "validate cmd against state" },
          { kind: "action", label: "produce new event(s)" },
          { kind: "action", label: "EventStore.append" },
          { kind: "parallel", label: "PAR  async fan-out (Class C)",
            children: [
              { kind: "action", label: "Projector.update(readModel)" },
              { kind: "action", label: "Bus.publish(evt)" }
            ]
          }
        ]
      }]
    }
  },
  {
    id: "pipes-filters",
    name: "Pipes and Filters",
    group: "Architectural",
    class: null,
    summary: "Process data through a series of independent filters connected by pipes.",
    intent: [
      "Each filter is independent, composable",
      "Pipes carry typed data between filters",
      "Streaming, ETL, compilers"
    ],
    simple: {
      kind: "root", label: "Pipeline",
      children: [{
        kind: "decorator", label: "[ForEach chunk]",
        children: [
          { kind: "sequence", label: "SEQ  filters in series", children: [
            { kind: "action", label: "f1 → f2 → f3" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Pipeline.process(stream)",
      children: [{
        kind: "decorator", label: "[ForEach chunk]",
        children: [
          { kind: "sequence", label: "SEQ  filters in series", children: [
            { kind: "action", label: "filter1.transform()" },
            { kind: "action", label: "pipe → filter2" },
            { kind: "action", label: "filter2.transform()" },
            { kind: "action", label: "pipe → filter3" },
            { kind: "action", label: "filter3.transform()" },
            { kind: "action", label: "emit downstream" }
          ]}
        ]
      }]
    }
  },
  {
    id: "broker",
    name: "Broker",
    group: "Architectural",
    class: null,
    summary: "A broker mediates communication between distributed components, hiding location and protocol.",
    intent: [
      "Clients and servers know broker only",
      "Foundation of CORBA, message brokers",
      "Routes, marshals, retries"
    ],
    simple: {
      kind: "root", label: "Client.invoke",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "marshal + route" },
          { kind: "action", label: "Servant.execute" },
          { kind: "action", label: "marshal back" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Client.invoke(remote)",
      children: [{
        kind: "sequence", label: "SEQ  through broker",
        children: [
          { kind: "action", label: "ClientProxy.marshal(req)" },
          { kind: "action", label: "Broker.route(req)" },
          { kind: "selector", label: "FALL  locate server", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "registry.has(svc)" },
              { kind: "action", label: "forward to ServerProxy" }
            ]},
            { kind: "action", label: "remote lookup / fail" }
          ]},
          { kind: "action", label: "ServerProxy.unmarshal()" },
          { kind: "action", label: "Servant.execute()" },
          { kind: "action", label: "← marshal response back" }
        ]
      }]
    }
  },
  {
    id: "blackboard",
    name: "Blackboard",
    group: "Architectural",
    class: null,
    summary: "Knowledge sources collaborate via a shared data structure under a control component.",
    intent: [
      "Good for ill-defined problems (AI, speech)",
      "Control component schedules contributions",
      "Opportunistic problem-solving"
    ],
    simple: {
      kind: "root", label: "Control.solve",
      children: [{
        kind: "decorator", label: "[Repeat until solved]",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "action", label: "KSs evaluate" },
            { kind: "action", label: "winner contributes" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Control.solve()",
      children: [{
        kind: "decorator", label: "[Repeat: while !solved]",
        children: [
          { kind: "sequence", label: "SEQ  iteration",
            children: [
              { kind: "action", label: "snapshot blackboard" },
              { kind: "parallel", label: "PAR  KSs evaluate (collect bids)", children: [
                { kind: "action", label: "KS_A.evaluate()" },
                { kind: "action", label: "KS_B.evaluate()" },
                { kind: "action", label: "KS_C.evaluate()" }
              ]},
              { kind: "action", label: "Control.pickContributor()" },
              { kind: "action", label: "winner.contribute(blackboard)" }
            ]
          }
        ]
      }]
    }
  },
  {
    id: "p2p",
    name: "Peer-to-Peer",
    group: "Architectural",
    class: null,
    summary: "Each node acts as both client and server.",
    intent: [
      "No SPOF, scales with peers",
      "Discovery and consistency are hard",
      "DHTs, BitTorrent, blockchains"
    ],
    simple: {
      kind: "root", label: "Peer.tick",
      children: [{
        kind: "parallel", label: "PAR  roles",
        children: [
          { kind: "action", label: "serve" },
          { kind: "action", label: "request" },
          { kind: "action", label: "gossip" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Peer.tick()",
      children: [{
        kind: "parallel", label: "PAR  continuous roles",
        children: [
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "SEQ  serve", children: [
              { kind: "condition", label: "incoming request" },
              { kind: "action", label: "respond" }
            ]}
          ]},
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "SEQ  request", children: [
              { kind: "condition", label: "need data" },
              { kind: "action", label: "ask known peers" }
            ]}
          ]},
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "SEQ  gossip", children: [
              { kind: "action", label: "exchange peer table" },
              { kind: "action", label: "drop dead peers" }
            ]}
          ]}
        ]
      }]
    }
  },
  {
    id: "client-server",
    name: "Client-Server",
    group: "Architectural",
    class: null,
    summary: "Clients request services from a centralized server.",
    intent: [
      "Simple, well-understood model",
      "Server is authority and SPOF",
      "Stateless servers scale horizontally"
    ],
    simple: {
      kind: "root", label: "Interaction",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "Client.send" },
          { kind: "action", label: "Server.handle" },
          { kind: "action", label: "Server.respond" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Interaction",
      children: [{
        kind: "sequence", label: "SEQ  req/resp",
        children: [
          { kind: "action", label: "Client.send(req)" },
          { kind: "action", label: "Server.accept()" },
          { kind: "selector", label: "FALL  AuthN", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "creds ok" },
              { kind: "action", label: "Server.handle(req)" }
            ]},
            { kind: "action", label: "401" }
          ]},
          { kind: "action", label: "Server.respond()" },
          { kind: "action", label: "Client.receive()" }
        ]
      }]
    }
  },
  {
    id: "soa",
    name: "Service-Oriented Architecture",
    group: "Architectural",
    class: null,
    summary: "Loosely-coupled services exposing contracts via an ESB.",
    intent: [
      "Coarse-grained services, ESB mediation",
      "Reusable across business domains",
      "Predecessor of microservices"
    ],
    simple: {
      kind: "root", label: "Consumer.invoke",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "validate contract" },
          { kind: "action", label: "ESB → provider" },
          { kind: "action", label: "transform back" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Consumer.invoke(svc)",
      children: [{
        kind: "sequence", label: "SEQ  via ESB",
        children: [
          { kind: "action", label: "Contract.validate(req)" },
          { kind: "action", label: "ESB.route + transform" },
          { kind: "selector", label: "FALL  resolve provider", children: [
            { kind: "sequence", label: "SEQ", children: [
              { kind: "condition", label: "registry.has(svc)" },
              { kind: "action", label: "invoke provider" }
            ]},
            { kind: "action", label: "fault" }
          ]},
          { kind: "action", label: "ESB.transformBack" },
          { kind: "action", label: "return response" }
        ]
      }]
    }
  },
  {
    id: "serverless",
    name: "Serverless / FaaS",
    group: "Architectural",
    class: null,
    summary: "Stateless functions managed by a platform that auto-scales per invocation.",
    intent: [
      "No server lifecycle to manage",
      "Cold start vs warm tradeoff",
      "Glue code via managed events"
    ],
    simple: {
      kind: "root", label: "Event → Platform",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "warm or cold start" },
          { kind: "action", label: "function(event)" },
          { kind: "action", label: "respond" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Event → Platform",
      children: [{
        kind: "sequence", label: "SEQ  invocation",
        children: [
          { kind: "selector", label: "FALL  container ready", children: [
            { kind: "sequence", label: "SEQ  warm", children: [
              { kind: "condition", label: "container exists" },
              { kind: "action", label: "reuse" }
            ]},
            { kind: "sequence", label: "SEQ  cold start", children: [
              { kind: "action", label: "provision container" },
              { kind: "action", label: "load runtime + code" }
            ]}
          ]},
          { kind: "action", label: "function(event, ctx)" },
          { kind: "sequence", label: "SEQ  side effects", children: [
            { kind: "action", label: "write to managed DB" },
            { kind: "action", label: "emit to queue/topic" },
            { kind: "action", label: "metrics + logs" }
          ]},
          { kind: "action", label: "return response" }
        ]
      }]
    }
  },
  {
    id: "publish-subscribe",
    name: "Publish-Subscribe",
    group: "Architectural",
    class: "C",
    summary: "Broker dispatches a message to many subscribers; failures across subscribers are isolated. Class C topology.",
    intent: [
      "Topic- or content-based routing",
      "Class C: PAR-of-SEQs gives failure isolation per subscriber",
      "Underlies eventing, queues, push"
    ],
    simple: {
      kind: "root", label: "Broker.publish",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "action", label: "lookupSubscribers" },
          { kind: "parallel", label: "PAR  isolated delivery", children: [
            { kind: "action", label: "sub[0]" },
            { kind: "action", label: "sub[1]" },
            { kind: "action", label: "sub[N]" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Publisher.publish(topic, msg)",
      children: [{
        kind: "sequence", label: "SEQ  dispatch",
        children: [
          { kind: "action", label: "Broker.lookupSubscribers(topic)" },
          { kind: "condition", label: "subs.size > 0" },
          { kind: "parallel", label: "PAR  Class C — at-least-once", children: [
            { kind: "sequence", label: "SEQ  sub[0]", children: [
              { kind: "action", label: "sub[0].onMessage(msg)" }
            ]},
            { kind: "sequence", label: "SEQ  sub[1]", children: [
              { kind: "action", label: "sub[1].onMessage(msg)" }
            ]},
            { kind: "sequence", label: "SEQ  sub[N]", children: [
              { kind: "action", label: "sub[N].onMessage(msg)" }
            ]}
          ]}
        ]
      }]
    }
  },
  {
    id: "mapreduce",
    name: "MapReduce",
    group: "Architectural",
    class: null,
    summary: "Parallel map step then reduce step over large datasets.",
    intent: [
      "Embarrassingly parallel computation",
      "Move computation to data",
      "Foundation of Hadoop, Spark"
    ],
    simple: {
      kind: "root", label: "Job.run",
      children: [{
        kind: "sequence", label: "SEQ",
        children: [
          { kind: "parallel", label: "PAR  map", children: [
            { kind: "action", label: "mapper(shard)" }
          ]},
          { kind: "action", label: "shuffle + sort" },
          { kind: "parallel", label: "PAR  reduce", children: [
            { kind: "action", label: "reducer(key, vs)" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Job.run(dataset)",
      children: [{
        kind: "sequence", label: "SEQ  map then reduce",
        children: [
          { kind: "action", label: "split input" },
          { kind: "parallel", label: "PAR  map workers (N)", children: [
            { kind: "action", label: "mapper(shard0) → kv*" },
            { kind: "action", label: "mapper(shard1) → kv*" },
            { kind: "action", label: "mapper(shardN) → kv*" }
          ]},
          { kind: "action", label: "shuffle + sort by key" },
          { kind: "parallel", label: "PAR  reduce workers (per-key)", children: [
            { kind: "action", label: "reducer(k0, [v..])" },
            { kind: "action", label: "reducer(k1, [v..])" },
            { kind: "action", label: "reducer(kN, [v..])" }
          ]},
          { kind: "action", label: "write output" }
        ]
      }]
    }
  },
  {
    id: "repository",
    name: "Repository",
    group: "Architectural",
    class: null,
    summary: "Mediates between domain and data mapping; collection-like API.",
    intent: [
      "Domain code talks to a collection-like API",
      "Persistence ignorance",
      "Often paired with Unit of Work"
    ],
    simple: {
      kind: "root", label: "Repo.get",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "identityMap.has(id)" },
            { kind: "action", label: "return tracked" }
          ]},
          { kind: "action", label: "load from DAO + cache" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Repository.get(id)",
      children: [{
        kind: "selector", label: "FALL  identity map / load",
        children: [
          { kind: "sequence", label: "SEQ  hit", children: [
            { kind: "condition", label: "identityMap.has(id)" },
            { kind: "action", label: "return tracked entity" }
          ]},
          { kind: "sequence", label: "SEQ  miss", children: [
            { kind: "action", label: "row = DAO.findById(id)" },
            { kind: "condition", label: "row != null" },
            { kind: "action", label: "entity = Mapper.toDomain(row)" },
            { kind: "action", label: "identityMap.set(id, entity)" },
            { kind: "action", label: "return entity" }
          ]}
        ]
      }]
    }
  },
  {
    id: "dao",
    name: "DAO (Data Access Object)",
    group: "Architectural",
    class: null,
    summary: "Encapsulates all access to the data source; CRUD-shaped API.",
    intent: [
      "Hide DB-specific code from callers",
      "CRUD-shaped API",
      "Lower-level than Repository"
    ],
    simple: {
      kind: "root", label: "DAO.execute",
      children: [{
        kind: "selector", label: "FALL  CRUD",
        children: [
          { kind: "action", label: "INSERT" },
          { kind: "action", label: "SELECT" },
          { kind: "action", label: "UPDATE" },
          { kind: "action", label: "DELETE" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "DAO.execute(op)",
      children: [{
        kind: "selector", label: "FALL  CRUD op",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "op == create" },
            { kind: "action", label: "INSERT row" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "op == read" },
            { kind: "action", label: "SELECT row" },
            { kind: "action", label: "map → object" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "op == update" },
            { kind: "action", label: "UPDATE row" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "condition", label: "op == delete" },
            { kind: "action", label: "DELETE row" }
          ]}
        ]
      }]
    }
  },
  {
    id: "circuit-breaker",
    name: "Circuit Breaker",
    group: "Architectural",
    class: "B",
    summary: "Recovery on protected service failure is Class B (Compensable-Action); the OPEN-state probe loop is Class D (Bounded-Retry).",
    intent: [
      "States: CLOSED → OPEN → HALF_OPEN",
      "Recovery: FALL(primary, fallback) — Class B",
      "Probe loop: FALL of wait-then-retry — Class D"
    ],
    simple: {
      kind: "root", label: "Breaker.call",
      children: [{
        kind: "selector", label: "FALL  Class B recovery",
        children: [
          { kind: "action", label: "Primary: downstream.call" },
          { kind: "action", label: "Compensate: fallback response" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Breaker.call(req)",
      children: [{
        kind: "selector", label: "FALL  state-driven",
        children: [
          { kind: "sequence", label: "SEQ  CLOSED", children: [
            { kind: "condition", label: "state == CLOSED" },
            { kind: "selector", label: "FALL  Class B recovery", children: [
              { kind: "sequence", label: "SEQ  primary", children: [
                { kind: "action", label: "downstream.call()" },
                { kind: "action", label: "resetFailures()" }
              ]},
              { kind: "sequence", label: "SEQ  compensate + maybe trip", children: [
                { kind: "action", label: "incFailures()" },
                { kind: "action", label: "fallback response" },
                { kind: "sequence", label: "SEQ", children: [
                  { kind: "condition", label: "failures > threshold" },
                  { kind: "action", label: "trip → OPEN" }
                ]}
              ]}
            ]}
          ]},
          { kind: "sequence", label: "SEQ  OPEN", children: [
            { kind: "condition", label: "state == OPEN" },
            { kind: "selector", label: "FALL  Class D probe-loop", children: [
              { kind: "sequence", label: "SEQ  cooldown elapsed", children: [
                { kind: "condition", label: "cooldown elapsed" },
                { kind: "action", label: "state = HALF_OPEN" }
              ]},
              { kind: "action", label: "fallback response" }
            ]}
          ]},
          { kind: "sequence", label: "SEQ  HALF_OPEN", children: [
            { kind: "condition", label: "state == HALF_OPEN" },
            { kind: "selector", label: "FALL  probe", children: [
              { kind: "sequence", label: "SEQ  ok", children: [
                { kind: "action", label: "downstream.call()" },
                { kind: "action", label: "state = CLOSED" }
              ]},
              { kind: "sequence", label: "SEQ  fail", children: [
                { kind: "action", label: "state = OPEN" },
                { kind: "action", label: "fallback response" }
              ]}
            ]}
          ]}
        ]
      }]
    }
  },

  // ============ Cloud-Native (paper Appendix B) ============
  {
    id: "bulkhead",
    name: "Bulkhead",
    group: "Cloud-Native",
    class: "C",
    summary: "Isolated resource pools per client/service prevent failures in one from cascading. Class C: Concurrent-Isolation.",
    intent: [
      "Isolate workloads into separate resource pools",
      "Class C: PAR over SEQs gives structural failure isolation",
      "Per-pool saturation does not affect others"
    ],
    simple: {
      kind: "root", label: "Bulkhead",
      children: [{
        kind: "parallel", label: "PAR  isolated pools",
        children: [
          { kind: "action", label: "Pool₁: workers" },
          { kind: "action", label: "Pool₂: workers" },
          { kind: "action", label: "Pool₃: workers" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Bulkhead.tick()",
      children: [{
        kind: "parallel", label: "PAR  per-pool isolation (Class C)",
          note: "saturation in one pool does not affect siblings",
        children: [
          { kind: "sequence", label: "SEQ  Pool A (premium)", children: [
            { kind: "condition", label: "poolA.hasCapacity" },
            { kind: "action", label: "poolA.serve(req)" }
          ]},
          { kind: "sequence", label: "SEQ  Pool B (standard)", children: [
            { kind: "condition", label: "poolB.hasCapacity" },
            { kind: "action", label: "poolB.serve(req)" }
          ]},
          { kind: "sequence", label: "SEQ  Pool C (batch)", children: [
            { kind: "condition", label: "poolC.hasCapacity" },
            { kind: "action", label: "poolC.serve(req)" }
          ]}
        ]
      }]
    }
  },
  {
    id: "sidecar",
    name: "Sidecar",
    group: "Cloud-Native",
    class: "C",
    summary: "Main service plus co-process (proxy, logging, observability) running alongside it. Class C: failure-isolated concurrent paths.",
    intent: [
      "Main + co-process deployed together, isolated runtimes",
      "Class C: PAR-of-SEQs",
      "Service-mesh data plane is the canonical example"
    ],
    simple: {
      kind: "root", label: "Pod",
      children: [{
        kind: "parallel", label: "PAR  isolated co-processes",
        children: [
          { kind: "action", label: "main service" },
          { kind: "action", label: "sidecar (proxy/logs/obs)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Pod.tick()",
      children: [{
        kind: "parallel", label: "PAR  Class C — independent lifecycles",
        children: [
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "SEQ  main service", children: [
              { kind: "condition", label: "request inbound" },
              { kind: "action", label: "service.handle(req)" }
            ]}
          ]},
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "SEQ  proxy sidecar", children: [
              { kind: "action", label: "intercept ingress/egress" },
              { kind: "action", label: "apply mesh policy (mTLS, retry)" }
            ]}
          ]},
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "SEQ  observability sidecar", children: [
              { kind: "action", label: "scrape metrics" },
              { kind: "action", label: "ship logs / traces" }
            ]}
          ]}
        ]
      }]
    }
  },
  {
    id: "retry-backoff",
    name: "Retry with Backoff",
    group: "Cloud-Native",
    class: "D",
    summary: "Fallback over Wait-then-Retry sequences with increasing waits and an exhausted terminal. Class D: Bounded-Retry.",
    intent: [
      "Class D: FALL of (Wait → Retry); back-off via increasing waits",
      "BT does not need an explicit retry counter — siblings are the bound",
      "Tick semantics naturally express the wait"
    ],
    simple: {
      kind: "root", label: "Retry",
      children: [{
        kind: "selector", label: "FALL",
        children: [
          { kind: "sequence", label: "SEQ", children: [
            { kind: "action", label: "Wait 1×" },
            { kind: "action", label: "Retry" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "action", label: "Wait 2×" },
            { kind: "action", label: "Retry" }
          ]},
          { kind: "sequence", label: "SEQ", children: [
            { kind: "action", label: "Wait 4×" },
            { kind: "action", label: "Retry" }
          ]},
          { kind: "action", label: "Exhausted: fail" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Retry.call(op)",
      children: [{
        kind: "selector", label: "FALL  Class D — siblings bound retries",
        children: [
          { kind: "sequence", label: "SEQ  attempt 1 (no wait)", children: [
            { kind: "action", label: "op()" }
          ]},
          { kind: "sequence", label: "SEQ  attempt 2", children: [
            { kind: "action", label: "wait(100ms)" },
            { kind: "action", label: "op()" }
          ]},
          { kind: "sequence", label: "SEQ  attempt 3", children: [
            { kind: "action", label: "wait(400ms + jitter)" },
            { kind: "action", label: "op()" }
          ]},
          { kind: "sequence", label: "SEQ  attempt 4", children: [
            { kind: "action", label: "wait(1600ms + jitter)" },
            { kind: "action", label: "op()" }
          ]},
          { kind: "action", label: "exhausted → propagate failure" }
        ]
      }]
    }
  }
];
