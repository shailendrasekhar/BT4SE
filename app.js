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

const html = htm.bind(React.createElement);

const KIND_GLYPH = {
  root: "ROOT",
  selector: "?  SELECTOR",
  sequence: "→  SEQUENCE",
  parallel: "⇉  PARALLEL",
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

// ---- Dagre layout ---------------------------------------------------------
function layout(nodes, edges, opts = {}) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: opts.nodesep ?? 32,
    ranksep: opts.ranksep ?? 70,
    marginx: 20,
    marginy: 20
  });
  g.setDefaultEdgeLabel(() => ({}));

  const W = opts.W ?? 190;
  const H = opts.H ?? 60;
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

// ---- Custom node component ------------------------------------------------
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

// ---- A single behavior-tree flow pane -------------------------------------
function BTFlow({ tree, idPrefix, accent, withMiniMap }) {
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
        <${Background} color=${accent || "#1f2433"} gap=${24} />
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

// ---- Sidebar (left) -------------------------------------------------------
function Sidebar({ patterns, selectedId, onSelect }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return patterns;
    return patterns.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.group.toLowerCase().includes(needle) ||
        p.summary.toLowerCase().includes(needle)
    );
  }, [q, patterns]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return html`
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Pattern → Behavior Tree</h1>
        <p>Select a pattern to see its generalized behavior-tree form.</p>
      </div>
      <div className="search">
        <input
          placeholder="Search patterns…"
          value=${q}
          onChange=${(e) => setQ(e.target.value)}
        />
      </div>
      <div className="pattern-list">
        ${groups.map(([group, items]) => html`
          <div key=${group}>
            <div className="group-title">${group}</div>
            ${items.map((p) => html`
              <div
                key=${p.id}
                className=${`pattern-item ${p.id === selectedId ? "active" : ""}`}
                onClick=${() => onSelect(p.id)}
              >
                ${p.name}
                <small>${p.summary.slice(0, 60)}${p.summary.length > 60 ? "…" : ""}</small>
              </div>
            `)}
          </div>
        `)}
        ${groups.length === 0 && html`
          <div style=${{ padding: 16, color: "#8a92a8", fontSize: 13 }}>
            No matches.
          </div>
        `}
      </div>
    </aside>
  `;
}

// ---- Right details panel --------------------------------------------------
function Details({ pattern }) {
  if (!pattern) return null;
  return html`
    <aside className="sidebar right">
      <div className="sidebar-header">
        <h1>${pattern.name}</h1>
        <p>${pattern.group}</p>
      </div>
      <div className="right-content">
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
          <h3>BT Node Legend</h3>
          <ul>
            <li><b>Selector (?)</b> — try children until one succeeds (fallback / OR)</li>
            <li><b>Sequence (→)</b> — run children in order until one fails (AND)</li>
            <li><b>Parallel (⇉)</b> — run children concurrently; policy decides success</li>
            <li><b>Decorator [ ]</b> — modifies child (Repeater, Inverter, Guard, …)</li>
            <li><b>Action (■)</b> — leaf, performs work</li>
            <li><b>Condition (◆)</b> — leaf, returns true/false</li>
          </ul>
        </div>
      </div>
    </aside>
  `;
}

// ---- Canvas ---------------------------------------------------------------
function Canvas({ pattern }) {
  const [view, setView] = useState("split"); // 'split' | 'simple' | 'detailed'

  if (!pattern) {
    return html`
      <div className="canvas">
        <div className="empty">Select a pattern from the left to render its behavior tree.</div>
      </div>
    `;
  }

  const showSimple   = view === "split" || view === "simple";
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
          <span>${pattern.group}</span>
          <h2>${pattern.name}</h2>
        </div>
        <div className="header-right">
          <div className="view-toggle">
            <${Btn} id="split"    label="Side-by-side" />
            <${Btn} id="simple"   label="Simplified" />
            <${Btn} id="detailed" label="Detailed" />
          </div>
          <div className="legend">
            <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.selector}}></span>Selector</div>
            <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.sequence}}></span>Sequence</div>
            <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.parallel}}></span>Parallel</div>
            <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.decorator}}></span>Decorator</div>
            <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.action}}></span>Action</div>
            <div className="legend-item"><span className="legend-dot" style=${{background:KIND_COLOR.condition}}></span>Condition</div>
          </div>
        </div>
      </div>
      <div className=${`flow-stack ${view}`}>
        ${showSimple && html`
          <div className="flow-pane simple-pane" key=${`simple-${pattern.id}`}>
            <div className="pane-label">Simplified</div>
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

// ---- Root -----------------------------------------------------------------
function App() {
  const [selectedId, setSelectedId] = useState(PATTERNS[0].id);
  const pattern = PATTERNS.find((p) => p.id === selectedId);

  return html`
    <div className="app">
      <${Sidebar}
        patterns=${PATTERNS}
        selectedId=${selectedId}
        onSelect=${setSelectedId}
      />
      <${Canvas} pattern=${pattern} />
      <${Details} pattern=${pattern} />
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
