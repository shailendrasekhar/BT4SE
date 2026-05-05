// Pattern -> Behavior Tree specifications.
//
// Node kinds:
//   selector  : try children left-to-right, succeed on first SUCCESS (fallback / OR)
//   sequence  : run children left-to-right, fail on first FAILURE (AND)
//   parallel  : run all children concurrently; policy decides success
//   decorator : wraps a single child (Inverter, Repeater, Guard, etc.)
//   action    : leaf, performs work
//   condition : leaf, returns SUCCESS/FAILURE based on a check
//   root      : the tree root wrapper
//
// Each pattern has both a `tree` (detailed) and a `simple` (3-7 node minimal) BT.

export const PATTERNS = [
  // ===================== CREATIONAL =====================
  {
    id: "singleton",
    name: "Singleton",
    group: "Creational (GoF)",
    summary: "Ensures a class has exactly one instance and provides a global access point to it.",
    intent: [
      "Single shared instance for an entire process",
      "Lazy or eager instantiation behind a guarded accessor",
      "Useful for caches, registries, loggers — abused often"
    ],
    simple: {
      kind: "root", label: "getInstance()",
      children: [{
        kind: "selector", label: "? exists or create",
        children: [
          { kind: "condition", label: "instance != null" },
          { kind: "action",    label: "create + return" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Singleton.getInstance()",
      children: [{
        kind: "selector", label: "? Get-or-Create",
        children: [
          { kind: "sequence", label: "→ Return existing", children: [
            { kind: "condition", label: "instance != null" },
            { kind: "action", label: "return instance" }
          ]},
          { kind: "sequence", label: "→ Create once", children: [
            { kind: "decorator", label: "[CriticalSection: lock]", children: [
              { kind: "selector", label: "? Double-checked",
                children: [
                  { kind: "sequence", label: "→ Another thread created it", children: [
                    { kind: "condition", label: "instance != null (recheck)" },
                    { kind: "action", label: "return instance" }
                  ]},
                  { kind: "sequence", label: "→ First in", children: [
                    { kind: "action", label: "instance = new T()" },
                    { kind: "action", label: "return instance" }
                  ]}
                ]}
            ]}
          ]}
        ]
      }]
    }
  },
  {
    id: "factory-method",
    name: "Factory Method",
    group: "Creational (GoF)",
    summary: "Defines an interface for creating an object but lets subclasses decide which class to instantiate.",
    intent: [
      "Defer instantiation to subclasses",
      "Client code depends on the abstract product, not the concrete class",
      "Variation: parameterized factory method"
    ],
    simple: {
      kind: "root", label: "create(spec)",
      children: [{
        kind: "selector", label: "? which concrete product",
        children: [
          { kind: "action", label: "return ProductA" },
          { kind: "action", label: "return ProductB" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Creator.create(spec)",
      children: [{
        kind: "sequence", label: "→ Make product",
        children: [
          { kind: "action",   label: "preProcess(spec)" },
          { kind: "selector", label: "? Pick concrete creator",
            children: [
              { kind: "sequence", label: "→ ConcreteCreatorA", children: [
                { kind: "condition", label: "spec matches A" },
                { kind: "action",    label: "return new ProductA()" }
              ]},
              { kind: "sequence", label: "→ ConcreteCreatorB", children: [
                { kind: "condition", label: "spec matches B" },
                { kind: "action",    label: "return new ProductB()" }
              ]},
              { kind: "action", label: "throw UnsupportedSpec" }
            ]
          },
          { kind: "action", label: "postInit(product)" }
        ]
      }]
    }
  },
  {
    id: "abstract-factory",
    name: "Abstract Factory",
    group: "Creational (GoF)",
    summary: "Provides an interface for creating families of related objects without specifying their concrete classes.",
    intent: [
      "Create entire product families consistently",
      "Swap whole family by swapping the factory",
      "Adds a level of indirection over Factory Method"
    ],
    simple: {
      kind: "root", label: "buildFamily()",
      children: [{
        kind: "sequence", label: "→ pick factory + build",
        children: [
          { kind: "action", label: "factory = pickFactory()" },
          { kind: "action", label: "createButton + Checkbox + Window" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "AbstractFactory.buildFamily()",
      children: [{
        kind: "sequence", label: "→ Build coherent family",
        children: [
          { kind: "selector", label: "? Resolve concrete factory",
            children: [
              { kind: "sequence", label: "→ FactoryWin", children: [
                { kind: "condition", label: "platform == Windows" },
                { kind: "action",    label: "factory = WinFactory" }
              ]},
              { kind: "sequence", label: "→ FactoryMac", children: [
                { kind: "condition", label: "platform == Mac" },
                { kind: "action",    label: "factory = MacFactory" }
              ]}
            ]
          },
          { kind: "sequence", label: "→ Build products of family", note: "ordered, all must succeed",
            children: [
              { kind: "action", label: "factory.createButton()" },
              { kind: "action", label: "factory.createCheckbox()" },
              { kind: "action", label: "factory.createWindow()" }
            ]
          },
          { kind: "action", label: "return Family{...}" }
        ]
      }]
    }
  },
  {
    id: "builder",
    name: "Builder",
    group: "Creational (GoF)",
    summary: "Separates the construction of a complex object from its representation, allowing the same construction process to create different representations.",
    intent: [
      "Step-wise construction of complex objects",
      "Same steps can yield different representations",
      "Director orchestrates, Builder builds, Product is the result"
    ],
    simple: {
      kind: "root", label: "construct()",
      children: [{
        kind: "sequence", label: "→ build steps",
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
        kind: "sequence", label: "→ Step-by-step",
        children: [
          { kind: "action", label: "builder.reset()" },
          { kind: "action", label: "builder.buildPartA()" },
          { kind: "action", label: "builder.buildPartB()" },
          { kind: "decorator", label: "[Optional]", children: [
            { kind: "sequence", label: "→ Optional part",
              children: [
                { kind: "condition", label: "needsExtras" },
                { kind: "action",    label: "builder.buildExtras()" }
              ]
            }
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
    summary: "Creates new objects by copying an existing instance (prototype) rather than by instantiating a class.",
    intent: [
      "Avoid expensive construction by cloning",
      "Registry of pre-configured prototypes",
      "Deep vs shallow copy is the main pitfall"
    ],
    simple: {
      kind: "root", label: "clone(key)",
      children: [{
        kind: "sequence", label: "→ lookup + copy",
        children: [
          { kind: "action", label: "proto = registry[key]" },
          { kind: "action", label: "return copy(proto)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Client.clone(key)",
      children: [{
        kind: "sequence", label: "→ Clone from registry",
        children: [
          { kind: "condition", label: "registry.has(key)" },
          { kind: "action",    label: "proto = registry.get(key)" },
          { kind: "selector",  label: "? Clone strategy",
            children: [
              { kind: "sequence", label: "→ Deep copy", children: [
                { kind: "condition", label: "proto.requiresDeepCopy" },
                { kind: "action",    label: "return deepCopy(proto)" }
              ]},
              { kind: "action", label: "return shallowCopy(proto)" }
            ]
          }
        ]
      }]
    }
  },

  // ===================== STRUCTURAL =====================
  {
    id: "adapter",
    name: "Adapter",
    group: "Structural (GoF)",
    summary: "Converts the interface of a class into another interface clients expect.",
    intent: [
      "Bridge incompatible interfaces",
      "Wrap legacy / 3rd-party API in target interface",
      "Object adapter (composition) vs class adapter (inheritance)"
    ],
    simple: {
      kind: "root", label: "Adapter.request()",
      children: [{
        kind: "sequence", label: "→ translate + delegate",
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
        kind: "sequence", label: "→ Translate & delegate",
        children: [
          { kind: "action",  label: "translate(input → adapteeFmt)" },
          { kind: "action",  label: "result = adaptee.specificRequest()" },
          { kind: "action",  label: "translate(result → clientFmt)" },
          { kind: "action",  label: "return result" }
        ]
      }]
    }
  },
  {
    id: "bridge",
    name: "Bridge",
    group: "Structural (GoF)",
    summary: "Decouples an abstraction from its implementation so the two can vary independently.",
    intent: [
      "Avoid Cartesian explosion of subclasses",
      "Abstraction holds reference to Implementor",
      "Both hierarchies evolve independently"
    ],
    simple: {
      kind: "root", label: "Abstraction.op()",
      children: [{
        kind: "sequence", label: "→ delegate to impl",
        children: [
          { kind: "action", label: "abstraction logic" },
          { kind: "action", label: "impl.operationImpl()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Abstraction.operation()",
      children: [{
        kind: "sequence", label: "→ Delegate across bridge",
        children: [
          { kind: "action", label: "preprocess (abstraction side)" },
          { kind: "selector", label: "? Pick implementor",
            children: [
              { kind: "sequence", label: "→ ImplA", children: [
                { kind: "condition", label: "ctx wants A" },
                { kind: "action",    label: "impl = ConcreteImplA" }
              ]},
              { kind: "sequence", label: "→ ImplB", children: [
                { kind: "condition", label: "ctx wants B" },
                { kind: "action",    label: "impl = ConcreteImplB" }
              ]}
            ]
          },
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
    summary: "Composes objects into tree structures and lets clients treat individual objects and compositions uniformly.",
    intent: [
      "Part-whole hierarchies",
      "Same op over leaf and composite",
      "Recursion is the natural traversal"
    ],
    simple: {
      kind: "root", label: "Component.op()",
      children: [{
        kind: "selector", label: "? leaf or composite",
        children: [
          { kind: "action", label: "leaf: doWork" },
          { kind: "action", label: "composite: forEach child.op()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Component.operation()",
      children: [{
        kind: "selector", label: "? Leaf or composite",
        children: [
          { kind: "sequence", label: "→ Leaf", children: [
            { kind: "condition", label: "isLeaf" },
            { kind: "action",    label: "doWork()" }
          ]},
          { kind: "sequence", label: "→ Composite", children: [
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
    summary: "Attaches additional responsibilities to an object dynamically by wrapping it.",
    intent: [
      "Add behavior without subclassing",
      "Decorators stack — order matters",
      "Same interface as wrapped component"
    ],
    simple: {
      kind: "root", label: "Decorator.op()",
      children: [{
        kind: "sequence", label: "→ wrap call",
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
        kind: "sequence", label: "→ Wrap call",
        children: [
          { kind: "action", label: "before()  // pre-hook" },
          { kind: "decorator", label: "[Wrap: addedBehavior]", children: [
            { kind: "action", label: "wrappee.operation()" }
          ]},
          { kind: "action", label: "after()   // post-hook" }
        ]
      }]
    }
  },
  {
    id: "facade",
    name: "Facade",
    group: "Structural (GoF)",
    summary: "Provides a unified interface to a set of interfaces in a subsystem.",
    intent: [
      "Hide subsystem complexity behind one entry point",
      "Reduce coupling between client and subsystem",
      "Doesn't forbid direct subsystem access"
    ],
    simple: {
      kind: "root", label: "Facade.doX()",
      children: [{
        kind: "sequence", label: "→ orchestrate",
        children: [
          { kind: "action", label: "subA.step()" },
          { kind: "action", label: "subB.step()" },
          { kind: "action", label: "subC.step()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Facade.doX()",
      children: [{
        kind: "sequence", label: "→ Orchestrate subsystem",
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
    summary: "Shares fine-grained objects efficiently by separating intrinsic (shared) and extrinsic (contextual) state.",
    intent: [
      "Massive object counts → share intrinsic state",
      "Extrinsic state passed in per call",
      "Pool keyed by intrinsic identity"
    ],
    simple: {
      kind: "root", label: "Factory.get(key)",
      children: [{
        kind: "selector", label: "? cached or new",
        children: [
          { kind: "action", label: "return pool[key]" },
          { kind: "action", label: "create + cache + return" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "FlyweightFactory.get(key)",
      children: [{
        kind: "selector", label: "? Pool lookup",
        children: [
          { kind: "sequence", label: "→ Cached", children: [
            { kind: "condition", label: "pool.has(key)" },
            { kind: "action",    label: "return pool[key]" }
          ]},
          { kind: "sequence", label: "→ Create + cache", children: [
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
    summary: "Provides a surrogate or placeholder for another object to control access to it.",
    intent: [
      "Variants: virtual (lazy), protection, remote, smart-ref, cache",
      "Same interface as real subject",
      "Inserts checks/lifecycle around the real call"
    ],
    simple: {
      kind: "root", label: "Proxy.request()",
      children: [{
        kind: "sequence", label: "→ check + delegate",
        children: [
          { kind: "condition", label: "authorized" },
          { kind: "action",    label: "real.request()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Proxy.request()",
      children: [{
        kind: "sequence", label: "→ Guard + delegate",
        children: [
          { kind: "condition", label: "client.authorized" },
          { kind: "selector",  label: "? Cache check",
            children: [
              { kind: "sequence", label: "→ Hit",  children: [
                { kind: "condition", label: "cache.has(req)" },
                { kind: "action",    label: "return cache[req]" }
              ]},
              { kind: "sequence", label: "→ Miss", children: [
                { kind: "decorator", label: "[LazyInit]", children: [
                  { kind: "action", label: "ensure realSubject" }
                ]},
                { kind: "action", label: "result = real.request()" },
                { kind: "action", label: "cache[req] = result" },
                { kind: "action", label: "log + return result" }
              ]}
            ]
          }
        ]
      }]
    }
  },

  // ===================== BEHAVIORAL =====================
  {
    id: "chain-of-responsibility",
    name: "Chain of Responsibility",
    group: "Behavioral (GoF)",
    summary: "Passes a request along a chain of handlers; each decides to handle it or pass it on.",
    intent: [
      "Decouple sender from receiver",
      "Dynamic, runtime-configurable chain",
      "Maps directly to a Selector of handlers"
    ],
    simple: {
      kind: "root", label: "Chain.handle(req)",
      children: [{
        kind: "selector", label: "? first handler that fits",
        children: [
          { kind: "action", label: "A.handle if canHandle" },
          { kind: "action", label: "B.handle if canHandle" },
          { kind: "action", label: "default" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Chain.handle(req)",
      children: [{
        kind: "selector", label: "? First handler that succeeds",
        children: [
          { kind: "sequence", label: "→ HandlerA", children: [
            { kind: "condition", label: "A.canHandle(req)" },
            { kind: "action",    label: "A.process(req)" }
          ]},
          { kind: "sequence", label: "→ HandlerB", children: [
            { kind: "condition", label: "B.canHandle(req)" },
            { kind: "action",    label: "B.process(req)" }
          ]},
          { kind: "sequence", label: "→ HandlerC", children: [
            { kind: "condition", label: "C.canHandle(req)" },
            { kind: "action",    label: "C.process(req)" }
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
    summary: "Encapsulates a request as an object, letting you parameterize, queue, log, and undo it.",
    intent: [
      "Action as first-class object",
      "Enables undo/redo, queueing, transactions",
      "Invoker doesn't know what the command does"
    ],
    simple: {
      kind: "root", label: "Invoker.dispatch(call)",
      children: [{
        kind: "selector", label: "? execute or undo",
        children: [
          { kind: "action", label: "cmd.execute() + history.push" },
          { kind: "action", label: "history.pop().undo()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Invoker.dispatch(call)",
      children: [{
        kind: "selector", label: "? execute vs undo",
        children: [
          { kind: "sequence", label: "→ Execute", children: [
            { kind: "condition", label: "call == execute" },
            { kind: "action",    label: "cmd.snapshot()  // for undo" },
            { kind: "action",    label: "cmd.execute()" },
            { kind: "action",    label: "history.push(cmd)" }
          ]},
          { kind: "sequence", label: "→ Undo", children: [
            { kind: "condition", label: "call == undo" },
            { kind: "condition", label: "history non-empty" },
            { kind: "action",    label: "history.pop().undo()" }
          ]}
        ]
      }]
    }
  },
  {
    id: "interpreter",
    name: "Interpreter",
    group: "Behavioral (GoF)",
    summary: "Defines a representation for a grammar and an interpreter that uses it.",
    intent: [
      "Map grammar rules to classes",
      "Walk AST recursively",
      "Best for small, stable DSLs"
    ],
    simple: {
      kind: "root", label: "interpret(node)",
      children: [{
        kind: "selector", label: "? terminal or non-terminal",
        children: [
          { kind: "action", label: "ctx.lookup(name)" },
          { kind: "action", label: "interpret children + combine" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Expression.interpret(ctx)",
      children: [{
        kind: "selector", label: "? AST node kind",
        children: [
          { kind: "sequence", label: "→ Terminal", children: [
            { kind: "condition", label: "isTerminal" },
            { kind: "action",    label: "return ctx.lookup(name)" }
          ]},
          { kind: "sequence", label: "→ NonTerminal", children: [
            { kind: "condition", label: "hasChildren" },
            { kind: "sequence",  label: "→ interpret in order",
              children: [
                { kind: "action", label: "left.interpret(ctx)" },
                { kind: "action", label: "right.interpret(ctx)" }
              ]
            },
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
    summary: "Provides a way to access elements of an aggregate sequentially without exposing its representation.",
    intent: [
      "Decouple traversal from collection",
      "Multiple simultaneous traversals",
      "Maps to a Repeater decorator + step"
    ],
    simple: {
      kind: "root", label: "Iterator.traverse()",
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
          { kind: "sequence", label: "→ Step",
            children: [
              { kind: "condition", label: "iter.hasNext()" },
              { kind: "action",    label: "item = iter.next()" },
              { kind: "action",    label: "client.consume(item)" }
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
    summary: "Defines an object that encapsulates how a set of objects interact, replacing many-to-many with one-to-many.",
    intent: [
      "Centralize complex inter-component communication",
      "Components know mediator only",
      "Prevents object spaghetti"
    ],
    simple: {
      kind: "root", label: "Mediator.notify(evt)",
      children: [{
        kind: "selector", label: "? route by event",
        children: [
          { kind: "action", label: "evt=A → updateX,Y" },
          { kind: "action", label: "evt=B → updateZ" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Mediator.notify(sender, evt)",
      children: [{
        kind: "selector", label: "? Route by event",
        children: [
          { kind: "sequence", label: "→ evt = A", children: [
            { kind: "condition", label: "evt == A" },
            { kind: "sequence",  label: "→ Notify subset (in order)",
              children: [
                { kind: "action", label: "compX.update()" },
                { kind: "action", label: "compY.update()" }
              ]
            }
          ]},
          { kind: "sequence", label: "→ evt = B", children: [
            { kind: "condition", label: "evt == B" },
            { kind: "action",    label: "compZ.update()" }
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
    summary: "Captures and externalizes an object's internal state so it can be restored later, without violating encapsulation.",
    intent: [
      "Snapshot for undo / checkpoint",
      "Caretaker stores, doesn't inspect",
      "Originator owns the state"
    ],
    simple: {
      kind: "root", label: "Editor.checkpoint()",
      children: [{
        kind: "selector", label: "? save or restore",
        children: [
          { kind: "action", label: "save → caretaker.push" },
          { kind: "action", label: "restore → caretaker.pop" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Editor.checkpoint()",
      children: [{
        kind: "selector", label: "? Save or restore",
        children: [
          { kind: "sequence", label: "→ Save", children: [
            { kind: "condition", label: "user.requestsSave" },
            { kind: "action",    label: "m = originator.save()" },
            { kind: "action",    label: "caretaker.push(m)" }
          ]},
          { kind: "sequence", label: "→ Restore", children: [
            { kind: "condition", label: "user.requestsUndo" },
            { kind: "action",    label: "m = caretaker.pop()" },
            { kind: "action",    label: "originator.restore(m)" }
          ]}
        ]
      }]
    }
  },
  {
    id: "observer",
    name: "Observer",
    group: "Behavioral (GoF)",
    summary: "Defines a one-to-many dependency so that when one object changes state, all its dependents are notified.",
    intent: [
      "Pub/sub at object level",
      "Subject knows nothing about observers' types",
      "Push vs pull notification (canonical: synchronous)"
    ],
    simple: {
      kind: "root", label: "Subject.setState(s)",
      children: [{
        kind: "sequence", label: "→ update + notify",
        children: [
          { kind: "action", label: "state = s" },
          { kind: "action", label: "for each obs: obs.update()" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Subject.setState(s)",
      children: [{
        kind: "sequence", label: "→ Update + notify",
        children: [
          { kind: "action", label: "state = s" },
          { kind: "decorator", label: "[Guard: observers.size > 0]", children: [
            { kind: "decorator", label: "[ForEach observer]",
              children: [
                { kind: "action", label: "obs.update(state)" }
              ]
            }
          ]}
        ]
      }]
    }
  },
  {
    id: "state",
    name: "State",
    group: "Behavioral (GoF)",
    summary: "Allows an object to alter its behavior when its internal state changes; the object appears to change its class.",
    intent: [
      "FSM modeled with state objects",
      "Replaces large conditional dispatch",
      "Each state encapsulates its transitions"
    ],
    simple: {
      kind: "root", label: "Context.handle(evt)",
      children: [{
        kind: "selector", label: "? dispatch by current state",
        children: [
          { kind: "action", label: "A.handle + maybe → B" },
          { kind: "action", label: "B.handle + maybe → C" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Context.handle(evt)",
      children: [{
        kind: "selector", label: "? Current state handles?",
        children: [
          { kind: "sequence", label: "→ StateA", children: [
            { kind: "condition", label: "current == A" },
            { kind: "action",    label: "A.handle(evt)" },
            { kind: "action",    label: "maybe transition → B" }
          ]},
          { kind: "sequence", label: "→ StateB", children: [
            { kind: "condition", label: "current == B" },
            { kind: "action",    label: "B.handle(evt)" },
            { kind: "action",    label: "maybe transition → C" }
          ]},
          { kind: "sequence", label: "→ StateC", children: [
            { kind: "condition", label: "current == C" },
            { kind: "action",    label: "C.handle(evt)" }
          ]}
        ]
      }]
    }
  },
  {
    id: "strategy",
    name: "Strategy",
    group: "Behavioral (GoF)",
    summary: "Defines a family of algorithms, encapsulates each one, and makes them interchangeable.",
    intent: [
      "Algorithm as a plug-in object",
      "Strategy is injected by the client",
      "Open/closed for new strategies"
    ],
    simple: {
      kind: "root", label: "Context.execute(input)",
      children: [{
        kind: "action", label: "strategy.run(input)"
      }]
    },
    tree: {
      kind: "root", label: "Context.execute(input)",
      children: [{
        kind: "sequence", label: "→ delegate to injected strategy",
        children: [
          { kind: "condition", label: "strategy != null" },
          { kind: "action",    label: "preprocess(input)" },
          { kind: "action",    label: "result = strategy.run(input)" },
          { kind: "action",    label: "return result" }
        ]
      }]
    }
  },
  {
    id: "template-method",
    name: "Template Method",
    group: "Behavioral (GoF)",
    summary: "Defines the skeleton of an algorithm in a base class, deferring some steps to subclasses.",
    intent: [
      "Invariant skeleton, variant steps",
      "Hooks let subclasses opt in",
      "Hollywood Principle: don't call us"
    ],
    simple: {
      kind: "root", label: "templateMethod()",
      children: [{
        kind: "sequence", label: "→ skeleton",
        children: [
          { kind: "action", label: "step1 (fixed)" },
          { kind: "action", label: "step2 (override)" },
          { kind: "action", label: "step3 (override)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Base.templateMethod()",
      children: [{
        kind: "sequence", label: "→ Skeleton",
        children: [
          { kind: "action", label: "step1()  // fixed" },
          { kind: "action", label: "step2()  // override" },
          { kind: "decorator", label: "[Hook]", children: [
            { kind: "sequence", label: "→ Optional hook",
              children: [
                { kind: "condition", label: "hookEnabled" },
                { kind: "action",    label: "afterStep2()" }
              ]
            }
          ]},
          { kind: "action", label: "step3()  // override" },
          { kind: "action", label: "finalize()  // fixed" }
        ]
      }]
    }
  },
  {
    id: "visitor",
    name: "Visitor",
    group: "Behavioral (GoF)",
    summary: "Represents an operation to be performed on the elements of an object structure without changing the classes.",
    intent: [
      "Add operations without modifying element classes",
      "Double dispatch: element.accept(visitor) → visitor.visitX(element)",
      "Element classes must be stable"
    ],
    simple: {
      kind: "root", label: "visitAll(elements)",
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
          { kind: "sequence", label: "→ Double dispatch",
            children: [
              { kind: "action", label: "elem.accept(visitor)" },
              { kind: "action", label: "  → visitor.visitConcrete(elem)" },
              { kind: "action", label: "  → operation runs" }
            ]
          }
        ]
      }]
    }
  },

  // ===================== ARCHITECTURAL =====================
  {
    id: "mvc",
    name: "MVC (Model-View-Controller)",
    group: "Architectural",
    summary: "Separates application into Model (data), View (UI), and Controller (input handler).",
    intent: [
      "Controller mutates Model, View observes Model",
      "Classic web request lifecycle",
      "Variants: passive vs active model"
    ],
    simple: {
      kind: "root", label: "RequestCycle",
      children: [{
        kind: "sequence", label: "→ MVC",
        children: [
          { kind: "action", label: "Controller.handle(input)" },
          { kind: "action", label: "Model.mutate" },
          { kind: "action", label: "View.render(model)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "RequestCycle",
      children: [{
        kind: "sequence", label: "→ MVC flow",
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
    summary: "Separates the GUI from the business logic via a ViewModel that exposes data and commands through bindings.",
    intent: [
      "Two-way data binding View ↔ ViewModel",
      "ViewModel has no reference to View",
      "Common in WPF, SwiftUI, Vue"
    ],
    simple: {
      kind: "root", label: "UserInteraction",
      children: [{
        kind: "sequence", label: "→ MVVM",
        children: [
          { kind: "action", label: "View → ViewModel.command" },
          { kind: "action", label: "ViewModel mutates Model" },
          { kind: "action", label: "binding pushes to View" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "UserInteraction",
      children: [{
        kind: "sequence", label: "→ MVVM flow",
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
    summary: "View is passive; Presenter handles UI logic and updates View through an interface.",
    intent: [
      "Highly testable — Presenter is pure logic",
      "View is dumb, references Presenter",
      "Variant: supervising controller"
    ],
    simple: {
      kind: "root", label: "View.event()",
      children: [{
        kind: "sequence", label: "→ MVP",
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
        kind: "sequence", label: "→ MVP flow",
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
    summary: "Organizes code into horizontal layers (e.g. presentation, application, domain, infrastructure), each depending only on layers below.",
    intent: [
      "Strict downward dependency rule",
      "Easy to reason about, can become anemic",
      "Foundational for most enterprise apps"
    ],
    simple: {
      kind: "root", label: "Request",
      children: [{
        kind: "sequence", label: "→ down the stack",
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
        kind: "sequence", label: "→ Top-down call chain",
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
    summary: "Core domain is isolated; outside world plugs in through ports (interfaces) and adapters (implementations).",
    intent: [
      "Domain has no outward dependencies",
      "Drivers (UI, tests) call inbound ports",
      "Driven adapters fulfill outbound ports"
    ],
    simple: {
      kind: "root", label: "Inbound.handle()",
      children: [{
        kind: "sequence", label: "→ inbound → core → outbound",
        children: [
          { kind: "action", label: "InboundAdapter → Port" },
          { kind: "action", label: "Domain logic" },
          { kind: "action", label: "Outbound ports (Repo, Email, …)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "InboundAdapter.handle()",
      children: [{
        kind: "sequence", label: "→ Through the hex",
        children: [
          { kind: "action", label: "InboundAdapter → InboundPort" },
          { kind: "action", label: "ApplicationService.invoke()" },
          { kind: "action", label: "Domain.run()" },
          { kind: "sequence", label: "→ Outbound ports (in order)",
            children: [
              { kind: "action", label: "Repo (DB adapter)" },
              { kind: "action", label: "EmailGateway adapter" },
              { kind: "action", label: "EventBus adapter" }
            ]
          },
          { kind: "action", label: "return DTO" }
        ]
      }]
    }
  },
  {
    id: "clean",
    name: "Clean Architecture",
    group: "Architectural",
    summary: "Concentric layers with the dependency rule: source code dependencies point only inward, toward higher-level policies.",
    intent: [
      "Entities < UseCases < Adapters < Frameworks",
      "Inversion at every boundary",
      "Independent of UI, DB, framework"
    ],
    simple: {
      kind: "root", label: "Frameworks → in",
      children: [{
        kind: "sequence", label: "→ inward call",
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
        kind: "sequence", label: "→ Inward call",
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
    summary: "System composed of small, independently deployable services communicating over a network.",
    intent: [
      "Service per bounded context",
      "Independent deploy, scale, store",
      "Aggregator/BFF often does scatter-gather"
    ],
    simple: {
      kind: "root", label: "Edge.route(req)",
      children: [{
        kind: "sequence", label: "→ flow",
        children: [
          { kind: "action", label: "API Gateway.route" },
          { kind: "action", label: "auth + downstream service(s)" },
          { kind: "action", label: "respond / aggregate" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Request → Edge",
      children: [{
        kind: "sequence", label: "→ Distributed flow",
        children: [
          { kind: "action", label: "API Gateway.route()" },
          { kind: "selector", label: "? AuthN/Z",
            children: [
              { kind: "sequence", label: "→ valid", children: [
                { kind: "condition", label: "token valid" },
                { kind: "action",    label: "forward" }
              ]},
              { kind: "action", label: "401 / 403" }
            ]
          },
          { kind: "selector", label: "? Single call vs scatter-gather",
            children: [
              { kind: "sequence", label: "→ Single downstream", children: [
                { kind: "condition", label: "one service needed" },
                { kind: "action",    label: "call ServiceX" }
              ]},
              { kind: "sequence", label: "→ Aggregator (BFF)", children: [
                { kind: "condition", label: "aggregation needed" },
                { kind: "parallel",  label: "⇉ Fan-out", note: "scatter-gather; policy ALL or quorum",
                  children: [
                    { kind: "action", label: "OrderService" },
                    { kind: "action", label: "InventoryService" },
                    { kind: "action", label: "PaymentService" }
                  ]
                },
                { kind: "action", label: "merge results" }
              ]}
            ]
          },
          { kind: "action", label: "respond" }
        ]
      }]
    }
  },
  {
    id: "event-driven",
    name: "Event-Driven Architecture",
    group: "Architectural",
    summary: "Components communicate by producing and reacting to events, decoupling producers from consumers.",
    intent: [
      "Loose coupling via async events",
      "Pub/sub or event broker (Kafka, NATS)",
      "Eventual consistency is the default"
    ],
    simple: {
      kind: "root", label: "Producer.emit(evt)",
      children: [{
        kind: "sequence", label: "→ append + react",
        children: [
          { kind: "action", label: "Broker.append(evt)" },
          { kind: "action", label: "consumers react independently" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Producer.emit(evt)",
      children: [{
        kind: "sequence", label: "→ Publish + react",
        children: [
          { kind: "action", label: "Broker.append(evt)" },
          { kind: "parallel", label: "⇉ Consumers (independent)", note: "policy: ALL — at-least-once, async",
            children: [
              { kind: "sequence", label: "→ ConsumerA",
                children: [
                  { kind: "condition", label: "interested in evt" },
                  { kind: "action",    label: "A.handle(evt)" }
                ]},
              { kind: "sequence", label: "→ ConsumerB",
                children: [
                  { kind: "condition", label: "interested in evt" },
                  { kind: "action",    label: "B.handle(evt)" }
                ]},
              { kind: "sequence", label: "→ AuditLog",
                children: [
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
    summary: "Splits read and write models so each can be optimized independently.",
    intent: [
      "Commands mutate, Queries read",
      "Often paired with Event Sourcing",
      "Allows different storage per side"
    ],
    simple: {
      kind: "root", label: "Request",
      children: [{
        kind: "selector", label: "? command or query",
        children: [
          { kind: "action", label: "command → write model" },
          { kind: "action", label: "query → read model" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Request → CQRS",
      children: [{
        kind: "selector", label: "? Command or Query",
        children: [
          { kind: "sequence", label: "→ Command", children: [
            { kind: "condition", label: "is mutation" },
            { kind: "action",    label: "CommandHandler.execute()" },
            { kind: "action",    label: "WriteModel.apply()" },
            { kind: "action",    label: "publish DomainEvent" },
            { kind: "decorator", label: "[Eventually]", children: [
              { kind: "action", label: "ReadModel.project(evt)" }
            ]}
          ]},
          { kind: "sequence", label: "→ Query", children: [
            { kind: "condition", label: "is read" },
            { kind: "action",    label: "QueryHandler.run()" },
            { kind: "action",    label: "ReadModel.fetch()" }
          ]}
        ]
      }]
    }
  },
  {
    id: "event-sourcing",
    name: "Event Sourcing",
    group: "Architectural",
    summary: "Persist state as a sequence of events; current state is derived by replaying them.",
    intent: [
      "Events are the source of truth",
      "Snapshots are an optimization",
      "Natural audit log, time travel"
    ],
    simple: {
      kind: "root", label: "Aggregate.handle(cmd)",
      children: [{
        kind: "sequence", label: "→ append-only",
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
        kind: "sequence", label: "→ Append-only flow",
        children: [
          { kind: "action", label: "load events for id" },
          { kind: "action", label: "rehydrate state (fold)" },
          { kind: "action", label: "validate cmd against state" },
          { kind: "action", label: "produce new event(s)" },
          { kind: "action", label: "EventStore.append" },
          { kind: "parallel", label: "⇉ Async fan-out", note: "after persist; eventual",
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
    id: "saga",
    name: "Saga",
    group: "Architectural",
    summary: "Coordinates a long-running distributed transaction as a sequence of local transactions with compensations.",
    intent: [
      "No 2PC — eventual consistency",
      "Each step has a compensating action",
      "Choreography vs orchestration"
    ],
    simple: {
      kind: "root", label: "Saga.run()",
      children: [{
        kind: "sequence", label: "→ steps with compensation",
        children: [
          { kind: "action", label: "step1 (or compensate-none)" },
          { kind: "action", label: "step2 (or compensate-1)" },
          { kind: "action", label: "step3 (or compensate-2,1)" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Saga.run()",
      children: [{
        kind: "sequence", label: "→ Each step: try or unwind",
        children: [
          { kind: "selector", label: "? step1",
            children: [
              { kind: "action", label: "step1.commit()" },
              { kind: "action", label: "fail → done (nothing to undo)" }
            ]
          },
          { kind: "selector", label: "? step2",
            children: [
              { kind: "action", label: "step2.commit()" },
              { kind: "sequence", label: "→ compensate", children: [
                { kind: "action", label: "step1.compensate()" },
                { kind: "action", label: "abort" }
              ]}
            ]
          },
          { kind: "selector", label: "? step3",
            children: [
              { kind: "action", label: "step3.commit()" },
              { kind: "sequence", label: "→ compensate (reverse order)", children: [
                { kind: "action", label: "step2.compensate()" },
                { kind: "action", label: "step1.compensate()" },
                { kind: "action", label: "abort" }
              ]}
            ]
          },
          { kind: "action", label: "saga.complete()" }
        ]
      }]
    }
  },
  {
    id: "pipes-filters",
    name: "Pipes and Filters",
    group: "Architectural",
    summary: "Process data through a series of independent processing components (filters) connected by channels (pipes).",
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
          { kind: "sequence", label: "→ filters in series",
            children: [
              { kind: "action", label: "f1 → f2 → f3" }
            ]
          }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Pipeline.process(stream)",
      children: [{
        kind: "decorator", label: "[ForEach chunk]",
        children: [
          { kind: "sequence", label: "→ Filters in series",
            children: [
              { kind: "action", label: "filter1.transform()" },
              { kind: "action", label: "pipe → filter2" },
              { kind: "action", label: "filter2.transform()" },
              { kind: "action", label: "pipe → filter3" },
              { kind: "action", label: "filter3.transform()" },
              { kind: "action", label: "emit downstream" }
            ]
          }
        ]
      }]
    }
  },
  {
    id: "broker",
    name: "Broker",
    group: "Architectural",
    summary: "A broker mediates communication between distributed components, hiding location and protocol details.",
    intent: [
      "Clients and servers know broker only",
      "Foundation of CORBA, message brokers",
      "Routes, marshals, retries"
    ],
    simple: {
      kind: "root", label: "Client.invoke",
      children: [{
        kind: "sequence", label: "→ via broker",
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
        kind: "sequence", label: "→ Through broker",
        children: [
          { kind: "action", label: "ClientProxy.marshal(req)" },
          { kind: "action", label: "Broker.route(req)" },
          { kind: "selector", label: "? Locate server",
            children: [
              { kind: "sequence", label: "→ Local registry hit", children: [
                { kind: "condition", label: "registry.has(svc)" },
                { kind: "action",    label: "forward to ServerProxy" }
              ]},
              { kind: "action", label: "remote lookup / fail" }
            ]
          },
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
    summary: "Multiple specialized knowledge sources collaborate by reading/writing to a shared data structure (blackboard).",
    intent: [
      "Good for ill-defined problems (AI, speech)",
      "Control component schedules contributions",
      "Opportunistic problem-solving"
    ],
    simple: {
      kind: "root", label: "Control.solve()",
      children: [{
        kind: "decorator", label: "[Repeat until solved]",
        children: [
          { kind: "sequence", label: "→ iter",
            children: [
              { kind: "action", label: "KSs evaluate" },
              { kind: "action", label: "winner contributes" }
            ]
          }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Control.solve()",
      children: [{
        kind: "decorator", label: "[Repeat: while !solved]",
        children: [
          { kind: "sequence", label: "→ Iteration",
            children: [
              { kind: "action", label: "snapshot blackboard" },
              { kind: "parallel", label: "⇉ KSs evaluate", note: "policy: ALL — collect bids",
                children: [
                  { kind: "action", label: "KS_A.evaluate()" },
                  { kind: "action", label: "KS_B.evaluate()" },
                  { kind: "action", label: "KS_C.evaluate()" }
                ]
              },
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
    summary: "Each node acts as both client and server; no central coordinator.",
    intent: [
      "No SPOF, scales with peers",
      "Discovery and consistency are hard",
      "DHTs, BitTorrent, blockchains"
    ],
    simple: {
      kind: "root", label: "Peer.tick()",
      children: [{
        kind: "parallel", label: "⇉ roles", note: "concurrent loops",
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
        kind: "parallel", label: "⇉ Continuous roles", note: "policy: ALL — runs forever",
        children: [
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "→ Serve",
              children: [
                { kind: "condition", label: "incoming request" },
                { kind: "action",    label: "respond" }
              ]
            }
          ]},
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "→ Request",
              children: [
                { kind: "condition", label: "need data" },
                { kind: "action",    label: "ask known peers" }
              ]
            }
          ]},
          { kind: "decorator", label: "[Repeat]", children: [
            { kind: "sequence", label: "→ Gossip",
              children: [
                { kind: "action", label: "exchange peer table" },
                { kind: "action", label: "drop dead peers" }
              ]
            }
          ]}
        ]
      }]
    }
  },
  {
    id: "client-server",
    name: "Client-Server",
    group: "Architectural",
    summary: "Clients request services from a centralized server.",
    intent: [
      "Simple, well-understood model",
      "Server is authority and SPOF",
      "Stateless servers scale horizontally"
    ],
    simple: {
      kind: "root", label: "Interaction",
      children: [{
        kind: "sequence", label: "→ req/resp",
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
        kind: "sequence", label: "→ Req/resp cycle",
        children: [
          { kind: "action", label: "Client.send(req)" },
          { kind: "action", label: "Server.accept()" },
          { kind: "selector", label: "? AuthN",
            children: [
              { kind: "sequence", label: "→ valid", children: [
                { kind: "condition", label: "creds ok" },
                { kind: "action",    label: "Server.handle(req)" }
              ]},
              { kind: "action", label: "401" }
            ]
          },
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
    summary: "Application is composed of loosely coupled services exposing well-defined contracts via an enterprise service bus.",
    intent: [
      "Coarse-grained services, ESB mediation",
      "Reusable across business domains",
      "Predecessor of microservices"
    ],
    simple: {
      kind: "root", label: "Consumer.invoke",
      children: [{
        kind: "sequence", label: "→ via ESB",
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
        kind: "sequence", label: "→ Via ESB",
        children: [
          { kind: "action", label: "Contract.validate(req)" },
          { kind: "action", label: "ESB.route + transform" },
          { kind: "selector", label: "? Resolve provider",
            children: [
              { kind: "sequence", label: "→ Registry hit", children: [
                { kind: "condition", label: "registry.has(svc)" },
                { kind: "action",    label: "invoke provider" }
              ]},
              { kind: "action", label: "fault" }
            ]
          },
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
    summary: "Code runs in stateless functions managed by a platform that auto-scales and bills per invocation.",
    intent: [
      "No server lifecycle to manage",
      "Cold start vs warm tradeoff",
      "Glue code via managed events"
    ],
    simple: {
      kind: "root", label: "Event → Platform",
      children: [{
        kind: "sequence", label: "→ invoke",
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
        kind: "sequence", label: "→ Invocation",
        children: [
          { kind: "selector", label: "? Container ready",
            children: [
              { kind: "sequence", label: "→ Warm", children: [
                { kind: "condition", label: "container exists" },
                { kind: "action",    label: "reuse" }
              ]},
              { kind: "sequence", label: "→ Cold start", children: [
                { kind: "action", label: "provision container" },
                { kind: "action", label: "load runtime + code" }
              ]}
            ]
          },
          { kind: "action", label: "function(event, ctx)" },
          { kind: "sequence", label: "→ Side effects (in order)",
            children: [
              { kind: "action", label: "write to managed DB" },
              { kind: "action", label: "emit to queue/topic" },
              { kind: "action", label: "metrics + logs" }
            ]
          },
          { kind: "action", label: "return response" }
        ]
      }]
    }
  },
  {
    id: "publish-subscribe",
    name: "Publish-Subscribe",
    group: "Architectural",
    summary: "Publishers emit messages to topics; subscribers receive messages for topics they're interested in.",
    intent: [
      "Topic-based or content-based routing",
      "Many-to-many decoupling",
      "Underlies eventing, queues, push"
    ],
    simple: {
      kind: "root", label: "Publisher.publish(topic)",
      children: [{
        kind: "sequence", label: "→ broker dispatches",
        children: [
          { kind: "action", label: "lookup subscribers" },
          { kind: "action", label: "deliver to all" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Publisher.publish(topic, msg)",
      children: [{
        kind: "sequence", label: "→ Dispatch",
        children: [
          { kind: "action", label: "Broker.lookupSubscribers(topic)" },
          { kind: "decorator", label: "[Guard: subs.size > 0]", children: [
            { kind: "parallel", label: "⇉ Deliver to all", note: "policy: ALL — at-least-once, async",
              children: [
                { kind: "action", label: "sub[0].onMessage(msg)" },
                { kind: "action", label: "sub[1].onMessage(msg)" },
                { kind: "action", label: "sub[N].onMessage(msg)" }
              ]
            }
          ]}
        ]
      }]
    }
  },
  {
    id: "mapreduce",
    name: "MapReduce",
    group: "Architectural",
    summary: "Process large datasets via a parallel map step and a reduce step.",
    intent: [
      "Embarrassingly parallel computation",
      "Move computation to data",
      "Foundation of Hadoop, Spark"
    ],
    simple: {
      kind: "root", label: "Job.run()",
      children: [{
        kind: "sequence", label: "→ map then reduce",
        children: [
          { kind: "parallel", label: "⇉ map workers", children: [
            { kind: "action", label: "mapper(shard)" }
          ]},
          { kind: "action", label: "shuffle + sort" },
          { kind: "parallel", label: "⇉ reduce workers", children: [
            { kind: "action", label: "reducer(key, vs)" }
          ]}
        ]
      }]
    },
    tree: {
      kind: "root", label: "Job.run(dataset)",
      children: [{
        kind: "sequence", label: "→ Map then reduce",
        children: [
          { kind: "action", label: "split input" },
          { kind: "parallel", label: "⇉ Map workers", note: "policy: ALL — N workers",
            children: [
              { kind: "action", label: "mapper(shard0) → kv*" },
              { kind: "action", label: "mapper(shard1) → kv*" },
              { kind: "action", label: "mapper(shardN) → kv*" }
            ]
          },
          { kind: "action", label: "shuffle + sort by key" },
          { kind: "parallel", label: "⇉ Reduce workers", note: "policy: ALL — per-key",
            children: [
              { kind: "action", label: "reducer(k0, [v..])" },
              { kind: "action", label: "reducer(k1, [v..])" },
              { kind: "action", label: "reducer(kN, [v..])" }
            ]
          },
          { kind: "action", label: "write output" }
        ]
      }]
    }
  },
  {
    id: "repository",
    name: "Repository",
    group: "Architectural",
    summary: "Mediates between domain and data mapping layers, acting as an in-memory collection of domain objects.",
    intent: [
      "Domain code talks to a collection-like API",
      "Persistence ignorance",
      "Often paired with Unit of Work"
    ],
    simple: {
      kind: "root", label: "Repo.get(id)",
      children: [{
        kind: "selector", label: "? cache or load",
        children: [
          { kind: "action", label: "return identityMap[id]" },
          { kind: "action", label: "load from DAO + cache" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Repository.get(id)",
      children: [{
        kind: "selector", label: "? Identity map / cache",
        children: [
          { kind: "sequence", label: "→ Hit", children: [
            { kind: "condition", label: "identityMap.has(id)" },
            { kind: "action",    label: "return tracked entity" }
          ]},
          { kind: "sequence", label: "→ Miss", children: [
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
    summary: "Abstracts and encapsulates all access to the data source.",
    intent: [
      "Hide DB-specific code from callers",
      "CRUD-shaped API",
      "Lower-level than Repository"
    ],
    simple: {
      kind: "root", label: "DAO.execute(op)",
      children: [{
        kind: "selector", label: "? CRUD",
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
        kind: "selector", label: "? CRUD op",
        children: [
          { kind: "sequence", label: "→ Create", children: [
            { kind: "condition", label: "op == create" },
            { kind: "action",    label: "INSERT row" }
          ]},
          { kind: "sequence", label: "→ Read", children: [
            { kind: "condition", label: "op == read" },
            { kind: "action",    label: "SELECT row" },
            { kind: "action",    label: "map → object" }
          ]},
          { kind: "sequence", label: "→ Update", children: [
            { kind: "condition", label: "op == update" },
            { kind: "action",    label: "UPDATE row" }
          ]},
          { kind: "sequence", label: "→ Delete", children: [
            { kind: "condition", label: "op == delete" },
            { kind: "action",    label: "DELETE row" }
          ]}
        ]
      }]
    }
  },
  {
    id: "circuit-breaker",
    name: "Circuit Breaker",
    group: "Architectural",
    summary: "Wraps a remote call to fail fast when a downstream is unhealthy, with automatic recovery probing.",
    intent: [
      "States: CLOSED → OPEN → HALF_OPEN",
      "Trip on failure threshold",
      "Probe with one request to recover"
    ],
    simple: {
      kind: "root", label: "Breaker.call",
      children: [{
        kind: "selector", label: "? state",
        children: [
          { kind: "action", label: "CLOSED → call (trip on fail)" },
          { kind: "action", label: "OPEN → fail fast (or probe)" },
          { kind: "action", label: "HALF_OPEN → probe" }
        ]
      }]
    },
    tree: {
      kind: "root", label: "Breaker.call(req)",
      children: [{
        kind: "selector", label: "? State",
        children: [
          { kind: "sequence", label: "→ CLOSED (call)", children: [
            { kind: "condition", label: "state == CLOSED" },
            { kind: "selector", label: "? Try downstream",
              children: [
                { kind: "sequence", label: "→ Success", children: [
                  { kind: "action", label: "downstream.call()" },
                  { kind: "action", label: "resetFailures()" }
                ]},
                { kind: "sequence", label: "→ Failure", children: [
                  { kind: "action",    label: "incFailures()" },
                  { kind: "condition", label: "failures > threshold" },
                  { kind: "action",    label: "trip → OPEN" }
                ]}
              ]
            }
          ]},
          { kind: "sequence", label: "→ OPEN (fail-fast)", children: [
            { kind: "condition", label: "state == OPEN" },
            { kind: "selector", label: "? Cooldown",
              children: [
                { kind: "sequence", label: "→ Try probe", children: [
                  { kind: "condition", label: "cooldown elapsed" },
                  { kind: "action",    label: "state = HALF_OPEN" }
                ]},
                { kind: "action", label: "throw CircuitOpen" }
              ]
            }
          ]},
          { kind: "sequence", label: "→ HALF_OPEN (probe)", children: [
            { kind: "condition", label: "state == HALF_OPEN" },
            { kind: "selector", label: "? Probe result",
              children: [
                { kind: "sequence", label: "→ ok",  children: [
                  { kind: "action", label: "downstream.call()" },
                  { kind: "action", label: "state = CLOSED" }
                ]},
                { kind: "sequence", label: "→ fail", children: [
                  { kind: "action", label: "state = OPEN" },
                  { kind: "action", label: "throw" }
                ]}
              ]
            }
          ]}
        ]
      }]
    }
  }
];
