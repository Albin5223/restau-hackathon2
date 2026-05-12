"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RecipeStep, ResourceTypeDto } from "@/lib/types";
import { validateRecipe } from "@/lib/recipes";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepFields = {
  nom: string;
  kind: string;
  ressource: string[];
  duree: number;
};

type GraphCtxValue = {
  resourceTypes: ResourceTypeDto[];
  updateNode: (id: string, patch: Partial<StepFields>) => void;
  deleteNode: (id: string) => void;
  addChildNode: (parentId: string) => void;
};

const GraphCtx = createContext<GraphCtxValue | null>(null);

// ─── Constants ────────────────────────────────────────────────────────────────

const KINDS = [
  { value: "preparation", label: "Préparation" },
  { value: "cuisson", label: "Cuisson" },
  { value: "dressage", label: "Dressage" },
  { value: "other", label: "Autre" },
];

const KIND_COLORS: Record<string, string> = {
  preparation: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cuisson: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  dressage: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const EDGE_STYLE = {
  type: "smoothstep" as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa", width: 16, height: 16 },
  style: { stroke: "#a1a1aa", strokeWidth: 2 },
};

// ─── UID counter ──────────────────────────────────────────────────────────────

let _uid = 0;
const newId = () => `step_${++_uid}`;

function makeNode(id: string, position: { x: number; y: number }): Node {
  return {
    id,
    type: "stepNode",
    position,
    data: { nom: "", kind: "preparation", ressource: [], duree: 5 } as StepFields,
  };
}

// ─── StepNode (custom React Flow node) ───────────────────────────────────────

function StepNode({ id, data }: NodeProps) {
  const ctx = useContext(GraphCtx)!;
  const { nom, kind, ressource, duree } = data as unknown as StepFields;
  const kindLabel = KINDS.find((k) => k.value === kind)?.label ?? kind;

  return (
    <div className="w-64 rounded-xl border-2 border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {/* Target (input) handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!-top-2 !h-4 !w-4 !rounded-full !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${KIND_COLORS[kind] ?? KIND_COLORS.other}`}
        >
          {kindLabel}
        </span>
        <button
          type="button"
          onClick={() => ctx.deleteNode(id)}
          title="Supprimer cette étape"
          className="flex h-5 w-5 items-center justify-center rounded-full text-sm text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="space-y-3 p-3">
        {/* Nom */}
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Nom de l&apos;étape
          </p>
          <input
            value={nom}
            onChange={(e) => ctx.updateNode(id, { nom: e.target.value })}
            placeholder="ex. : cuire à la poêle"
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
          />
        </div>

        {/* Kind + Durée inline */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Type
            </p>
            <select
              value={kind}
              onChange={(e) => ctx.updateNode(id, { kind: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Durée (min)
            </p>
            <input
              type="number"
              min={1}
              value={duree}
              onChange={(e) =>
                ctx.updateNode(id, { duree: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs tabular-nums outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Ressources */}
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Ressources
          </p>
          {ctx.resourceTypes.length === 0 ? (
            <span className="text-[10px] text-zinc-400">Chargement…</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {ctx.resourceTypes.map((r) => {
                const checked = ressource.includes(r.name);
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() =>
                      ctx.updateNode(id, {
                        ressource: checked
                          ? ressource.filter((x) => x !== r.name)
                          : [...ressource, r.name],
                      })
                    }
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
                      checked
                        ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {r.name}
                    {r.capacity > 1 ? (
                      <span className="ml-0.5 opacity-50">×{r.capacity}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer: add branch button */}
      <div className="flex items-center justify-center gap-2 border-t border-zinc-100 px-3 pb-3 pt-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => ctx.addChildNode(id)}
          title="Ajouter une étape suivante"
          className="flex items-center gap-1 rounded-full border border-dashed border-zinc-400 px-3 py-1 text-[11px] font-medium text-zinc-500 transition-all hover:border-zinc-600 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-600 dark:hover:border-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <span className="text-base leading-none">+</span> branche
        </button>
      </div>

      {/* Source (output) handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!-bottom-2 !h-4 !w-4 !rounded-full !border-2 !border-zinc-300 !bg-white dark:!border-zinc-600 dark:!bg-zinc-900"
      />
    </div>
  );
}

// nodeTypes must be defined outside the component to avoid React Flow re-registering on every render
const nodeTypes = { stepNode: StepNode };

// ─── Inner editor ─────────────────────────────────────────────────────────────

function RecipeGraphEditorInner({
  existingNames,
  resourceTypes,
  onSubmit,
  onCancel,
}: {
  existingNames: string[];
  resourceTypes: ResourceTypeDto[];
  onSubmit: (name: string, etapes: RecipeStep[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Refs allow callbacks to read current state without stale closures
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // ── Node operations ──────────────────────────────────────────────────────

  const updateNode = useCallback(
    (id: string, patch: Partial<StepFields>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );

  const addChildNode = useCallback(
    (parentId: string) => {
      const parent = nodesRef.current.find((n) => n.id === parentId);
      if (!parent) return;
      // Offset new children horizontally so they don't stack
      const siblingCount = edgesRef.current.filter((e) => e.source === parentId).length;
      const offsetX = (siblingCount - Math.floor(siblingCount / 2)) * 300 * (siblingCount % 2 === 0 ? 1 : -1);
      const id = newId();
      setNodes((nds) => [
        ...nds,
        makeNode(id, { x: parent.position.x + offsetX, y: parent.position.y + 260 }),
      ]);
      setEdges((eds) => [
        ...eds,
        { id: `e-${parentId}-${id}`, source: parentId, target: id, ...EDGE_STYLE },
      ]);
    },
    [setNodes, setEdges],
  );

  const addRootNode = useCallback(() => {
    const rootCount = nodesRef.current.filter(
      (n) => !edgesRef.current.some((e) => e.target === n.id),
    ).length;
    const id = newId();
    setNodes((nds) => [...nds, makeNode(id, { x: rootCount * 320, y: 0 })]);
  }, [setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, ...EDGE_STYLE }, eds));
    },
    [setEdges],
  );

  // ── Context value (memoised so StepNode doesn't re-render unnecessarily) ──

  const ctxValue = useMemo<GraphCtxValue>(
    () => ({ resourceTypes, updateNode, deleteNode, addChildNode }),
    [resourceTypes, updateNode, deleteNode, addChildNode],
  );

  // ── Submit: convert graph → etapes[] ─────────────────────────────────────

  function handleSubmit() {
    setErrors([]);

    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (currentNodes.length === 0) {
      setErrors(["Ajoutez au moins une étape."]);
      return;
    }

    // Build: nodeId → [dep nodeIds] (incoming edges)
    const depsMap = new Map<string, string[]>();
    for (const n of currentNodes) depsMap.set(n.id, []);
    for (const e of currentEdges) depsMap.get(e.target)?.push(e.source);

    // Topological sort (Kahn's algorithm) to detect cycles & assign order
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    for (const n of currentNodes) { inDegree.set(n.id, 0); adjList.set(n.id, []); }
    for (const e of currentEdges) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
      adjList.get(e.source)?.push(e.target);
    }

    const queue = currentNodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
    const topoOrder: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      topoOrder.push(id);
      for (const child of adjList.get(id) ?? []) {
        const deg = (inDegree.get(child) ?? 0) - 1;
        inDegree.set(child, deg);
        if (deg === 0) queue.push(child);
      }
    }

    if (topoOrder.length !== currentNodes.length) {
      setErrors(["Le graphe contient un cycle. Supprimez une connexion pour corriger."]);
      return;
    }

    // Assign 1-based indices in topological order, then build etapes
    const indexMap = new Map<string, number>();
    topoOrder.forEach((id, i) => indexMap.set(id, i + 1));

    const etapes: RecipeStep[] = topoOrder.map((id) => {
      const node = currentNodes.find((n) => n.id === id)!;
      const d = node.data as unknown as StepFields;
      const deps = (depsMap.get(id) ?? [])
        .map((depId) => indexMap.get(depId) ?? 0)
        .filter((x) => x > 0)
        .sort((a, b) => a - b);
      return { nom: d.nom.trim(), kind: d.kind, ressource: d.ressource, duree: d.duree, deps };
    });

    const errs = validateRecipe(name, etapes, existingNames);
    if (errs.length > 0) { setErrors(errs); return; }

    setSaving(true);
    onSubmit(name, etapes)
      .catch(() => setErrors(["Erreur lors de l'enregistrement. Réessayez."]))
      .finally(() => setSaving(false));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <GraphCtx.Provider value={ctxValue}>
      <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {/* Top bar: dish name + add root */}
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="min-w-0 flex-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Nom du plat
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. : magret de canard"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
          </div>
          <button
            type="button"
            onClick={addRootNode}
            className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            + Étape racine
          </button>
        </div>

        {/* Canvas */}
        <div className="relative h-[540px] w-full">
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white/80 px-8 py-6 backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/80">
                <p className="text-sm font-medium text-zinc-500">
                  Cliquez sur <strong className="text-zinc-700 dark:text-zinc-300">+ Étape racine</strong> pour commencer
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Puis utilisez <strong>+ branche</strong> pour enchaîner les étapes,
                  ou glissez un connecteur vers une autre étape
                </p>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 1.2 }}
            deleteKeyCode="Backspace"
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="#d4d4d8"
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 bg-zinc-50 px-5 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Légende
          </span>
          {KINDS.map((k) => (
            <span key={k.value} className="flex items-center gap-1 text-[11px] text-zinc-500">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${KIND_COLORS[k.value]?.split(" ")[0]}`} />
              {k.label}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-zinc-400">
            Glisser un connecteur · Suppr pour effacer une connexion sélectionnée
          </span>
        </div>

        {/* Footer: errors + actions */}
        <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {errors.length > 0 && (
            <ul className="mb-3 space-y-0.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
              {errors.map((err, i) => (
                <li key={i}>· {err}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Enregistrement…" : "Enregistrer le plat"}
            </button>
          </div>
        </div>
      </div>
    </GraphCtx.Provider>
  );
}

// ─── Public export (wraps with ReactFlowProvider) ─────────────────────────────

export function RecipeGraphEditor(
  props: Parameters<typeof RecipeGraphEditorInner>[0],
) {
  return (
    <ReactFlowProvider>
      <RecipeGraphEditorInner {...props} />
    </ReactFlowProvider>
  );
}
