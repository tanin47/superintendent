import React from "react";
import ReactFlow, {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Edge,
  Handle,
  MarkerType,
  Node,
  Position,
  ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import './Workflow.scss';
import {XYPosition} from "@reactflow/core/dist/esm/types";
import {ExportedWorkflow, ExportWorkflowChannel} from "../../types";
import {ipcRenderer} from "electron";
import {exportWorkflow} from "../api";
import {Sheet} from "./types";

export interface Ref {
  reset: () => void,
  zoomIn: () => void,
  zoomOut: () => void,
  fitView: () => void,
}

type Props = {
  sheets: Array<Sheet>,
  editorSelectedSheetName: string | null,
  onSheetClicked: (sheetId: string) => void,
  onSheetTabOpened: (sheetId: string) => void,
  onSheetRenamed: (name: string) => void,
  onSheetDeleted: (name: string) => void,
  onZoomInEnabled: (enabled: boolean) => void,
  onZoomOutEnabled: (enabled: boolean) => void,
  visible: boolean
};

const NON_LAYOUT_MARKER = 20000000;
const CHAR_WIDTH = 8.4;
const NODE_HEIGHT = 53;
const NODE_GAP = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function isLayouted(node: Node): boolean {
  return node.position.x !== NON_LAYOUT_MARKER;
}

function computeWidth(label: string, isCsv: boolean): number {
  return Math.max(15.5, label.length * CHAR_WIDTH + (isCsv ? 11.31 + 4 : 0 )) + 24;
}

function CustomNode({
  data
}: {
  data: {sheet: Sheet},
}): JSX.Element {
  return (
    <>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <div className="custom-node">
        <div className="label-section">
          {data.sheet.isCsv && (
            <i className="fas fa-file" title="Imported" />
          )}
          <span className={`label ${data.sheet.isCsv ? '' : 'non-csv'}`} data-action="open-editor" title="Open editor">{data.sheet.name}</span>
        </div>
        <div className="toolbar-section">
          <i
            className="fas fa-search"
            data-action="open-tab"
            title="Open tab"
          />
          &nbsp;
          <i
            className="fas fa-font"
            data-action="rename"
            title="Rename"
          />
          &nbsp;
          <i
            className="fas fa-trash-alt"
            data-action="delete"
            title="Delete"
          />
        </div>
      </div>
    </>
  );
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = typeof SIDES[number];

function layoutNewNodes(nodes: Node[]): Promise<void> {
  if (nodes.length === 0) {
    return Promise.resolve();
  }

  if (nodes.every((n) => !isLayouted(n))) {
    nodes[0].position.x = 0;
    nodes[0].position.y = 0;
  }

  const first = nodes.find((n) => isLayouted(n))!;

  let minX = first.position.x;
  let maxX = first.position.x + computeWidth(first.data.sheet.name, first.data.sheet.isCsv);
  let minY = first.position.y;
  let maxY = first.position.y + NODE_HEIGHT;

  nodes.forEach((n) => {
    if (isLayouted(n)) {
      minX = Math.min(n.position.x, minX);
      maxX = Math.max(n.position.x + computeWidth(n.data.sheet.name, n.data.sheet.isCsv), maxX);
      minY = Math.min(n.position.y, minY);
      maxY = Math.max(n.position.y + NODE_HEIGHT, maxY);
    }
  });

  const unlayoutedNodes = nodes.filter((n) => !isLayouted(n));

  unlayoutedNodes.forEach((n) => {
    const side: Side = SIDES[Math.floor(Math.random() * SIDES.length)];

    let x: number;
    let y: number;

    switch (side) {
      case 'top':
        x = minX + Math.random() * (maxX - minX);
        y = minY - NODE_HEIGHT - NODE_GAP;
        break;
      case 'right':
        x = maxX + NODE_GAP;
        y = minY + Math.random() * (maxY - minY);
        break;
      case 'bottom':
        x = minX + Math.random() * (maxX - minX);
        y = maxY + NODE_GAP;
        break;
      case 'left':
        x = maxX - computeWidth(n.data.sheet.name, n.data.sheet.isCsv) - NODE_GAP;
        y = minY + Math.random() * (maxY - minY);
        break;
      default:
        throw new Error();
    }

    n.position.x = x;
    n.position.y = y;
  });

  return Promise.resolve();
}

function getNodes(nodes: Node[], sheets: Sheet[]): Promise<Node[]> {
  const existings = new Map<string, Node>(nodes.map((n) => [n.id, n]));
  const news = new Map<string, Sheet>(sheets.map((s) => [s.name, s]));

  const toBeRemoved = new Set<string>();

  nodes.forEach((n) => {
    if (!news.has(n.id)) {
      toBeRemoved.add(n.id);
    }
  });

  sheets.forEach((sheet) => {
    if (!existings.has(sheet.name)) {
      const previousNode = sheet.previousName ? existings.get(sheet.previousName) : null;

      let position: XYPosition;

      if (previousNode) {
        position = previousNode.position;
      } else {
        position = sheet.position ?? { x: NON_LAYOUT_MARKER, y: NON_LAYOUT_MARKER };
      }

      nodes.push({
        id: sheet.name,
        type: 'customNode',
        data: {sheet: sheet},
        width: computeWidth(sheet.name, sheet.isCsv),
        height: NODE_HEIGHT,
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })
    }
  });

  const finals = nodes.filter((n) => !toBeRemoved.has(n.id));

  return layoutNewNodes(finals)
    .then(() => finals);
}

function setSelectedNode(nodes: Node[], sheets: Sheet[], editorSelectedSheetName: string | null): boolean {
  let changed = false;
  nodes.forEach((node) => {
    const previousClassName= node.className;
    node.className = node.id === editorSelectedSheetName ? 'editor-selected' : '';

    changed ||= previousClassName != node.className;
  });
  return changed;
}

export default React.forwardRef<Ref, Props>(function Workflow({
  sheets,
  editorSelectedSheetName,
  onSheetClicked,
  onSheetTabOpened,
  onSheetRenamed,
  onSheetDeleted,
  onZoomInEnabled,
  onZoomOutEnabled,
  visible
}: Props, ref): JSX.Element {
  const reactFlowInstance = React.useRef<ReactFlowInstance | null>(null);

  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [shouldFitView, setShouldFitView] = React.useState<boolean>(false);

  const onNodesChange = React.useCallback(
    (changes) => setNodes((nodes) => applyNodeChanges(changes, nodes)),
    []
  );
  const onEdgesChange = React.useCallback(
    (changes) => setEdges((edges) => applyEdgeChanges(changes, edges)),
    []
  );

  React.useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        setNodes([]);
        setEdges([]);
      },
      zoomIn: () => reactFlowInstance.current!.zoomIn(),
      zoomOut: () => reactFlowInstance.current!.zoomOut(),
      fitView: () => reactFlowInstance.current!.fitView({duration: 250}),
    }),
    [nodes]
  );

  React.useEffect(
    () => {
      getNodes(nodes, sheets)
        .then((newNodes) => {
          setNodes(newNodes);

          setShouldFitView(true);
        });

      setEdges((edges) => {
        const existings = new Set<string>(edges.map((e) => e.id));
        const sheetIds = new Set<string>(sheets.map((s) => s.name));

        const toBeRemoved = new Set<string>();

        edges.forEach((edge) => {
          if (!sheetIds.has(edge.source) || !sheetIds.has(edge.target)) {
            toBeRemoved.add(edge.id);
          }
        });

        sheets.forEach((sheet) => {
          sheet.dependsOn.forEach((dependsOn) => {
            const edgeId = `${dependsOn}-->${sheet.name}`;
            if (!existings.has(edgeId)) {
              edges.push({
                id: edgeId,
                source: dependsOn,
                target: sheet.name,
                style: {stroke: '#333', strokeWidth: 2},
                markerEnd: {type: MarkerType.ArrowClosed, color: '#333', strokeWidth: 2, width: 10, height: 10}
              });
            }
          });
        });

        return edges.filter((e) => !toBeRemoved.has(e.id));
      });
    },
    [sheets]
  );

  React.useEffect(
    () => {
      setNodes((nodes) => {
        const changed = setSelectedNode(nodes, sheets, editorSelectedSheetName)
        if (changed) {
          return [...nodes];
        } else {
          return nodes;
        }
      });
    },
    [editorSelectedSheetName]
  );

  React.useEffect(
    () => {
      if (shouldFitView) {
        setShouldFitView(false);

        if (reactFlowInstance.current) {
          setTimeout(() => reactFlowInstance.current!.fitView({duration: 250}), 1);
        }
      }
    },
    [shouldFitView]
  );

  React.useEffect(() => {
    const callback = async () => {
      const workflow: ExportedWorkflow = {nodes: []};

      nodes.forEach((node) => {
        workflow.nodes.push({
          name: node.id,
          sql: node.data.sheet.sql,
          dependsOn: node.data.sheet.dependsOn,
          isCsv: node.data.sheet.isCsv,
          position: node.position,
        })
      });

      await exportWorkflow(workflow);
    };
    ipcRenderer.on(ExportWorkflowChannel, callback);

    return () => {
      ipcRenderer.removeListener(ExportWorkflowChannel, callback) ;
    };
  }, [nodes]);

  const nodeTypes = React.useMemo(() => ({ customNode: CustomNode }), []);

  return (
    <>
      <div
        style={{
          height: '100%',
          width: '100%',
          visibility: visible ? 'visible' : 'hidden',
          backgroundColor: '#F2DF74',
          position: 'absolute'
        }}
      >
        <ReactFlow
          onInit={(i) => {reactFlowInstance.current = i;}}
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable
          nodesConnectable={false}
          nodesFocusable={false}
          onNodeClick={(event, node) => {
            const action = (event.target as HTMLElement).dataset.action;
            if (action === "open-editor" && !node.data.sheet.isCsv) {
              onSheetClicked(node.id);
            } else if (action === "rename") {
              onSheetRenamed(node.data.sheet.name);
            } else if (action === "delete") {
              onSheetDeleted(node.data.sheet.name);
            } else if (action === "open-tab") {
              onSheetTabOpened(node.id);
            }
          }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMove={(event, viewport) => {
            onZoomOutEnabled(viewport.zoom > MIN_ZOOM);
            onZoomInEnabled(viewport.zoom < MAX_ZOOM);
          }}
        >
          <Background color="#333"/>
        </ReactFlow>
      </div>
    </>
  );
});
