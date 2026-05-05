import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  ReactFlowProvider
} from "reactflow";
import dagre from "dagre";
import htm from "https://esm.sh/htm@3.1.1";
import { PATTERNS } from "./patterns.js";
import { CLASSES } from "./classes.js";

const html = htm.bind(React.createElement);

const KIND_GLYPH = {
  root: "ROOT",
  selector: "?  FALL",
  sequence: "→  SEQ",
  parallel: "⇉  PAR",
  decorator: "[ ]  DECORATOR",
  action: "■  ACTION",
  condition: "◆  CONDITION"
};

const KIND_COLOR = {
  root: "#475569",
  selector: "#d97706",
  sequence: "#2563eb",
  parallel: "#9333ea",
  decorator: "#0d9488",
  action: "#16a34a",
  condition: "#dc2626"
};

// id -> pattern lookup
const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// ---- Convert BT spec to flat nodes/edges -----------------------------------
function flatten(tree, idPrefix) {
  const nodes = [];
  const edges = [];
  let counter = 0;
  const walk = (node, parentId) => {
    const myId = `${idPrefix}-n${counter++}`;
    nodes.push({
      id: myId,
      data: { label: node.label, kind: node.kind, note: node.note },
      type: "btNode",
      position: { x: 0, y: 0 }
    });
    if (parentId !== null) {
      edges.push({
        id: `${idPrefix}-e${parentId}-${myId}`,
        source: parentId,
        target: myId,
        type: "smoothstep",
        animated: node.kind === "parallel"
      });
    }
    (node.children || []).forEach((c) => walk(c, myId));
  };
  walk(tree, null);
  return { nodes, edges };
}

function layout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 32,
    ranksep: 70,
    marginx: 20,
    marginy: 20
  });
  g.setDefaultEdgeLabel(() => ({}));

  const W = 190;
  const H = 60;
  nodes.forEach((n) => g.setNode(n.id, { width: W, height: H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    return {
      ...n,
      position: { x: x - W / 2, y: y - H / 2 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top
    };
  });
}

const BTNode = ({ data }) => {
  const { kind, label, note } = data;
  return html`
    <div className=${`bt-node bt-${kind}`} title=${note || ""}>
      <${Handle} type="target" position=${Position.Top} />
      <div className="bt-kind">${KIND_GLYPH[kind] || kind}</div>
      <div className="bt-label">${label}</div>
      <${Handle} type="source" position=${Position.Bottom} />
    </div>
  `;
};

const nodeTypes = { btNode: BTNode };

function BTFlow({ tree, idPrefix, withMiniMap }) {
  const { nodes, edges } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [] };
    const flat = flatten(tree, idPrefix);
    return { nodes: layout(flat.nodes, flat.edges), edges: flat.edges };
  }, [tree, idPrefix]);

  return html`
    <${ReactFlowProvider}>
      <${ReactFlow}
        nodes=${nodes}
        edges=${edges}
        nodeTypes=${nodeTypes}
        fitView
        fitViewOptions=${{ padding: 0.18 }}
        proOptions=${{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable=${false}
        elementsSelectable
        minZoom=${0.15}
        maxZoom=${2}
      >
        <${Background} color="#1f2433" gap=${24} />
        <${Controls} showInteractive=${false} />
        ${withMiniMap && html`
          <${MiniMap}
            nodeColor=${(n) => KIND_COLOR[n.data?.kind] || "#475569"}
            maskColor="rgba(0,0,0,0.6)"
          />
        `}
      <//>
    <//>
  `;
}

// ---- Sidebar --------------------------------------------------------------
function Sidebar({ selection, onSelect }) {
  const [q, setQ] = useState("");

  const filteredPatterns = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return PATTERNS;
    return PATTERNS.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.group.toLowerCase().includes(needle) ||
        p.summary.toLowerCase().includes(needle)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map();
    filteredPatterns.forEach((p) => {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    });
    return Array.from(map.entries());
  }, [filteredPatterns]);

  const filteredClasses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CLASSES;
    return CLASSES.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.summary.toLowerCase().includes(needle)
    );
  }, [q]);

  return html`
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Pattern → Behavior Tree</h1>
        <p>Paper-faithful: SEQ · FALL · PAR · Cond/Act leaves.</p>
      </div>
      <div className="search">
        <input
          placeholder="Search patterns or classes…"
          value=${q}
          onChange=${(e) => setQ(e.target.value)}
        />
      </div>
      <div className="pattern-list">

        ${filteredClasses.length > 0 && html`
          <div className="group-title group-title-classes">Equivalence Classes</div>
          ${filteredClasses.map((c) => html`
            <div
              key=${`class-${c.id}`}
              className=${`pattern-item class-item ${
                selection.kind === "class" && selection.id === c.id ? "active" : ""
              }`}
              onClick=${() => onSelect({ kind: "class", id: c.id })}
            >
              <span className="class-badge">${c.id}</span>
              ${c.name.replace(/^Class . — /, "")}
              <small>${c.summary.slice(0, 60)}${c.summary.length > 60 ? "…" : ""}</small>
            </div>
          `)}
        `}

        ${groups.map(([group, items]) => html`
          <div key=${group}>
            <div className="group-title">${group}</div>
            ${items.map((p) => html`
              <div
                key=${p.id}
                className=${`pattern-item ${
                  selection.kind === "pattern" && selection.id === p.id ? "active" : ""
                }`}
                onClick=${() => onSelect({ kind: "pattern", id: p.id })}
              >
                ${p.name}
                ${p.class && html`<span className=${`class-pill class-pill-${p.class}`}>${p.class}</span>`}
                <small>${p.summary.slice(0, 60)}${p.summary.length > 60 ? "…" : ""}</small>
              </div>
            `)}
          </div>
        `)}
        ${groups.length === 0 && filteredClasses.length === 0 && html`
          <div style=${{ padding: 16, color: "#8a92a8", fontSize: 13 }}>
            No matches.
          </div>
        `}
      </div>
    </aside>
  `;
}

// ---- Right details: pattern -----------------------------------------------
function PatternDetails({ pattern, onSelect }) {
  const klass = pattern.class ? CLASS_BY_ID[pattern.class] : null;
  return html`
    <aside className="sidebar right">
      <div className="sidebar-header">
        <h1>${pattern.name}</h1>
        <p>${pattern.group}</p>
      </div>
      <div className="right-content">
        ${klass && html`
          <div className="info-section class-membership"
               onClick=${() => onSelect({ kind: "class", id: klass.id })}
               role="button" tabIndex=${0}>
            <h3>Equivalence Class</h3>
            <p>
              <span className=${`class-pill class-pill-${klass.id}`}>${klass.id}</span>
              <strong>${klass.name.replace(/^Class . — /, "")}</strong>
            </p>
            <p style=${{marginTop: 6, color: "var(--muted)", fontSize: 12}}>
              Also: ${klass.members.filter((m) => m !== pattern.id).map((id) => PATTERN_BY_ID[id]?.name).filter(Boolean).join(" · ")}
            </p>
            <p style=${{marginTop: 6, color: "var(--accent)", fontSize: 11}}>
              ↗ View class topology
            </p>
          </div>
        `}
        <div className="info-section">
          <h3>Summary</h3>
          <p>${pattern.summary}</p>
        </div>
        <div className="info-section">
          <h3>Intent / Notes</h3>
          <ul>
            ${pattern.intent.map((line, i) => html`<li key=${i}>${line}</li>`)}
          </ul>
        </div>
        <div className="info-section">
          <h3>BT Vocabulary</h3>
          <ul>
            <li><b>SEQ (→)</b> — run children in order; fail on first FAILURE</li>
            <li><b>FALL (?)</b> — try children; succeed on first SUCCESS</li>
            <li><b>PAR (⇉)</b> — children run concurrently; failure isolation</li>
            <li><b>Condition (◆)</b> — leaf, returns SUCCESS/FAILURE</li>
            <li><b>Action (■)</b> — leaf, performs work</li>
            <li><b>[Decorator]</b> — sugar for Repeat / ForEach (reducible)</li>
          </ul>
        </div>
      </div>
    </aside>
  `;
}

// ---- Right details: class -------------------------------------------------
function ClassDetails({ klass, onSelect }) {
  return html`
    <aside className="sidebar right">
      <div className="sidebar-header">
        <h1>${klass.name}</h1>
        <p>${klass.paperRef}</p>
      </div>
      <div className="right-content">
        <div className="info-section">
          <h3>Summary</h3>
          <p>${klass.summary}</p>
        </div>
        <div className="info-section">
          <h3>Key Property</h3>
          <p>${klass.keyProperty}</p>
        </div>
        <div className="info-section">
          <h3>Members (${klass.members.length})</h3>
          <ul className="member-list">
            ${klass.instantiation.map((row) => {
              const p = PATTERN_BY_ID[row.pattern];
              if (!p) return null;
              return html`
                <li key=${row.pattern}
                    onClick=${() => onSelect({ kind: "pattern", id: row.pattern })}
                    className="member-row">
                  <div className="member-name">
                    <span className=${`class-pill class-pill-${klass.id}`}>${klass.id}</span>
                    <strong>${p.name}</strong>
                  </div>
                  ${row.guard && row.guard !== "—" && html`
                    <div className="member-detail"><b>Guard:</b> ${row.guard}</div>
                  `}
                  <div className="member-detail"><b>Action:</b> ${row.action}</div>
                </li>
              `;
            })}
          </ul>
        </div>
        ${klass.note && html`
          <div className="info-section">
            <h3>Why the equivalence holds</h3>
            <p>${klass.note}</p>
          </div>
        `}
      </div>
    </aside>
  `;
}

// ---- Canvas: pattern view (split simple/detailed) -------------------------
function PatternCanvas({ pattern }) {
  const [view, setView] = useState("split");

  const showSimple = view === "split" || view === "simple";
  const showDetailed = view === "split" || view === "detailed";

  const Btn = ({ id, label }) => html`
    <button
      className=${`view-btn ${view === id ? "active" : ""}`}
      onClick=${() => setView(id)}
    >${label}</button>
  `;

  return html`
    <div className="canvas">
      <div className="canvas-header">
        <div className="title-card">
          <span>${pattern.group}${pattern.class ? ` · class ${pattern.class}` : ""}</span>
          <h2>${pattern.name}</h2>
        </div>
        <div className="header-right">
          <div className="view-toggle">
            <${Btn} id="split"    label="Side-by-side" />
            <${Btn} id="simple"   label="Simplified" />
            <${Btn} id="detailed" label="Detailed" />
          </div>
          <${LegendCard} />
        </div>
      </div>
      <div className=${`flow-stack ${view}`}>
        ${showSimple && html`
          <div className="flow-pane simple-pane" key=${`simple-${pattern.id}`}>
            <div className="pane-label">${pattern.class ? `Class ${pattern.class} topology` : "Simplified"}</div>
            <${BTFlow}
              key=${`s-${pattern.id}`}
              tree=${pattern.simple}
              idPrefix=${`s-${pattern.id}`}
              withMiniMap=${false}
            />
          </div>
        `}
        ${showDetailed && html`
          <div className="flow-pane detailed-pane" key=${`detailed-${pattern.id}`}>
            <div className="pane-label">Detailed</div>
            <${BTFlow}
              key=${`d-${pattern.id}`}
              tree=${pattern.tree}
              idPrefix=${`d-${pattern.id}`}
              withMiniMap=${true}
            />
          </div>
        `}
      </div>
    </div>
  `;
}

// ---- Canvas: class view (canonical topology) ------------------------------
function ClassCanvas({ klass }) {
  return html`
    <div className="canvas">
      <div className="canvas-header">
        <div className="title-card">
          <span>Equivalence class · ${klass.paperRef}</span>
          <h2>${klass.name}</h2>
        </div>
        <div className="header-right">
          <${LegendCard} />
        </div>
      </div>
      <div className="flow-stack simple class-canvas">
        <div className="flow-pane">
          <div className="pane-label">Canonical topology</div>
          <${BTFlow}
            key=${`class-${klass.id}`}
            tree=${klass.topology}
            idPrefix=${`class-${klass.id}`}
            withMiniMap=${false}
          />
        </div>
      </div>
    </div>
  `;
}

const LegendCard = () => html`
  <div className="legend">
    <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.selector}}></span>FALL</div>
    <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.sequence}}></span>SEQ</div>
    <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.parallel}}></span>PAR</div>
    <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.decorator}}></span>Decorator</div>
    <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.action}}></span>Action</div>
    <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.condition}}></span>Condition</div>
  </div>
`;

// ---- Root -----------------------------------------------------------------
function App() {
  const [selection, setSelection] = useState({ kind: "class", id: "A" });

  let canvas, details;
  if (selection.kind === "class") {
    const klass = CLASS_BY_ID[selection.id];
    canvas = html`<${ClassCanvas} klass=${klass} />`;
    details = html`<${ClassDetails} klass=${klass} onSelect=${setSelection} />`;
  } else {
    const pattern = PATTERN_BY_ID[selection.id];
    canvas = html`<${PatternCanvas} pattern=${pattern} />`;
    details = html`<${PatternDetails} pattern=${pattern} onSelect=${setSelection} />`;
  }

  return html`
    <div className="app">
      <${Sidebar} selection=${selection} onSelect=${setSelection} />
      ${canvas}
      ${details}
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
