import React from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Position,
  MarkerType,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowInstance, Handle
} from 'reactflow';
import 'reactflow/dist/style.css';
import './Workflow.scss';
import {XYPosition} from "@reactflow/core/dist/esm/types";
import {ExportedWorkflow, ExportWorkflowChannel} from "../../types";
import {ipcRenderer} from "electron";
import {exportWorkflow} from "../api";
import Elk from 'elkjs';
import {Sheet} from "./types";

const elk = new Elk();

export interface Ref {
  reset: () => void,
  zoomIn: () => void,
  zoomOut: () => void,
  fitView: () => void,
  arrange: () => void,
}

type Props = {
  sheets: Array<Sheet>,
  editorSelectedSheetIndex: number | null,
  onSheetClicked: (sheetId: string) => void,
  onSheetTabOpened: (sheetId: string) => void,
  onSheetRenamed: (renamingSheetIndex: number) => void,
  onSheetDeleted: (deletedSheetIndex: number) => void,
  onZoomInEnabled: (enabled: boolean) => void,
  onZoomOutEnabled: (enabled: boolean) => void,
  visible: boolean
};

const NON_LAYOUT_MARKER = 20000000;
const CHAR_WIDTH = 8.4;
const NODE_HEIGHT = 53;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function isLayouted(node: Node): boolean {
  return node.position.x !== NON_LAYOUT_MARKER;
}

function computeWidth(label: string, isCsv: boolean): number {
  return Math.max(15.5, label.length * CHAR_WIDTH + (isCsv ? 11.31 + 4 : 0 )) + 24;
}

function layout(nodes: Node[], forceRearrange: boolean = false): Promise<void> {
  const map = new Map(nodes.map((n) => [n.id, n]));

  const fixedNodes = nodes
    .filter((n) => isLayouted(n) && !forceRearrange)
    .map((node) => {
      const fixedOptions: {[key: string]: any} = {};
      fixedOptions.x = node.position.x;
      fixedOptions.y = node.position.y;
      fixedOptions.layoutOptions = {'elk.position': `${node.position.x}, ${node.position.y}`};

      return {
        id: node.id,
        width: computeWidth(node.data.sheet.name, node.data.sheet.isCsv),
        height: NODE_HEIGHT,
        ...fixedOptions
      };
    });
  const nonFixedNodes = nodes
    .filter((n) => !isLayouted(n) || forceRearrange)
    .map((node) => {
      return {
        id: node.id,
        width: computeWidth(node.data.sheet.name, node.data.sheet.isCsv),
        height: NODE_HEIGHT,
      };
    });
  const children = [
      {
        id: 'elkfixed',
        layoutOptions: {
          'algorithm': 'fixed'
        },
        children: fixedNodes
      },
      ...nonFixedNodes
    ];

  const graph = {
    id: 'root' ,
    layoutOptions: {
      'algorithm': 'layered',
      'direction': 'RIGHT',
      'spacing.nodeNode': '25',
      'spacing.nodeNodeBetweenLayers': '25',
      'spacing.edgeNode': '25',
      'spacing.edgeNodeBetweenLayers': '20',
      'spacing.edgeEdge': '20',
      'spacing.edgeEdgeBetweenLayers': '15',
      'layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'edgeRouting': 'POLYLINE',
      'layered.nodePlacement.favorStraightEdges': 'true',
      'portAlignment.default': 'CENTER',
    },
    children: children,
    edges: nodes
      .map((node) => {
        return node.data.sheet.dependsOn
          .map((d) => {
            if (map.has(d)) {
              return {
                id: `${d}-->${node.id}`,
                sources: [d],
                targets: [node.id]
              };
            } else {
              return null;
            }
          })
          .filter((e) => e !== null);
      })
      .flat(),
  };

  return elk
    .layout(graph)
    .then((graph) => {
      graph.children!.map((c) => {
        if (c.id === 'elkfixed') {
          c.children!.map((cc) => {
            const n = map.get(cc.id)!;

            n.position = {x: c.x! + cc.x!, y: c.y! + cc.y!};
          });
          return;
        }
        const n = map.get(c.id)!;

        n.position = {x: c.x!, y: c.y!};
      })
    });
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
          <span className="label" data-action="open-editor" title="Open editor">{data.sheet.name}</span>
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
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })
    }
  });

  const finals = nodes.filter((n) => !toBeRemoved.has(n.id));

  return layout(finals).then(() => finals);
}

function setSelectedNode(nodes: Node[], sheets: Sheet[], editorSelectedSheetIndex: number | null): boolean {
  let changed = false;
  nodes.forEach((node) => {
    const previousClassName= node.className;
    node.className = editorSelectedSheetIndex !== null && node.id === sheets[editorSelectedSheetIndex].name ? 'editor-selected' : '';

    changed ||= previousClassName != node.className;
  });
  return changed;
}

export default React.forwardRef<Ref, Props>(function Workflow({
  sheets,
  editorSelectedSheetIndex,
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
    (changes) => setNodes(applyNodeChanges(changes, nodes)),
    [nodes]
  );
  const onEdgesChange = React.useCallback(
    (changes) => setEdges(applyEdgeChanges(changes, edges)),
    [edges]
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
      arrange: () => {
        layout(nodes, true)
          .then(() => {
            setNodes([...nodes]);
            setShouldFitView(true);
          });

      },
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
      const changed = setSelectedNode(nodes, sheets, editorSelectedSheetIndex)
      if (changed) {
        setNodes([...nodes]);
      }
    },
    [editorSelectedSheetIndex, nodes]
  );

  React.useEffect(
    () => {
      if (shouldFitView && reactFlowInstance.current) {
        setShouldFitView(false);
        reactFlowInstance.current.fitView({duration: 250});
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
      <div style={{ height: '100%', width: '100%', top: visible ? '0px' : '-100000px', position: 'absolute' }}>
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
            if (action === "open-editor") {
              onSheetClicked(node.id);
            } else if (action === "rename") {
              onSheetRenamed(sheets.findIndex((s) => s.name === node.data.sheet.name));
            } else if (action === "delete") {
              onSheetDeleted(sheets.findIndex((s) => s.name === node.data.sheet.name));
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
