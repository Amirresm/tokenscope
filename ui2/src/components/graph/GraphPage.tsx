import { useQuery } from "@tanstack/react-query";
import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Background,
    Controls,
    Edge,
    EdgeChange,
    Handle,
    MiniMap,
    Node,
    NodeChange,
    NodeProps,
    NodeTypes,
    Position,
    ReactFlow,
    useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import generationStore from "../../store/generationStore";
import React from "react";
import dagre from "@dagrejs/dagre";
import { fetchGenerationTree } from "../../api/generationMetaAPI";
import sessionStore from "../../store/sessionStore";
import { GenerationTreeNodeData } from "../../models/generationTree";
import { prefillGeneration } from "../../api/generationAPI";
import globalStore from "../../store/components/globalStore";

type GenerationTreeNode = Node<GenerationTreeNodeData>;

export function TextNode(props: NodeProps<GenerationTreeNode>) {
    return (
        <div
            className={`p-2 border rounded bg-base-200 min-w-[150px] ${props.data.leaf ? "border-green-300" : "border-gray-300"}`}
        >
            <Handle type="source" position={Position.Bottom} />
            <Handle type="target" position={Position.Top} />
            <div className="whitespace-break-spaces text-xs max-w-2xs flex flex-col gap-2">
                <div className="text-base-content font-bold text-xs">
                    Branch: {props.data.branchId} - {props.data.tokenCount} (
                    {props.data.depth})
                </div>
                <div className="text-base-content/20 font-bold text-xs">
                    Confidence: {props.data.totalConfidence?.toFixed(2)} (
                    {props.data.confidence?.toFixed(2)})
                </div>
                <div className="w-full h-px bg-base-content" />
                <div>
                    {props.data.parentText && (
                        <span className="text-base-content/50">
                            {props.data.parentText}
                        </span>
                    )}
                    <span className="text-base-content">{props.data.text}</span>
                </div>
            </div>
        </div>
    );
}

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (
    nodes: GenerationTreeNode[],
    edges: Edge[],
    direction = "TB",
    align = "UL",
) => {
    const isHorizontal = direction === "LR";
    dagreGraph.setGraph({ rankdir: direction, align });

    nodes.forEach((node) => {
        const nodeWidth = 300;
        const totalParentLines = nodes
            .filter((n) => n.data.depth === node.data.depth - 1)
            .map((n) => (n.data.parentText + n.data.text).split("\n").length)
            .reduce((a, b) => Math.max(a, b), 0);
        const lineHeight = 26;
        const baseNodeHeight = 100;
        const nodeHeight = baseNodeHeight + totalParentLines * lineHeight;
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes: GenerationTreeNode[] = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
            ...node,
            targetPosition: isHorizontal ? Position.Left : Position.Top,
            sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
            position: {
                // x: nodeWithPosition.x - nodeWithPosition.width / 2,
                x: node.position.x * 1.1,
                // y: nodeWithPosition.y - nodeWithPosition.height / 2,
                y: nodeWithPosition.y,
            },
        };

        return newNode;
    });

    return { nodes: newNodes, edges };
};

const nodeTypes = { text: TextNode } as NodeTypes;

function GraphPage() {
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const isGenerating = generationStore.isGenerating.value;

    const { fitView } = useReactFlow();

    const treeDataQuery = useQuery({
        queryKey: ["treeData", sessionId],
        queryFn: async () => {
            if (!sessionId) return null;
            const data = await fetchGenerationTree(sessionId);
            return data;
        },
    });
    const [nodes, setNodes] = React.useState<GenerationTreeNode[]>([]);
    const [edges, setEdges] = React.useState<Edge[]>([]);
    const [focusId, setFocusId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (treeDataQuery.data) {
            const { nodes: layoutedNodes, edges: layoutedEdges } =
                getLayoutedElements(
                    treeDataQuery.data.nodes,
                    treeDataQuery.data.edges,
                );
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);

            if (branchId) {
                for (const node of layoutedNodes) {
                    if (node.id.startsWith(branchId) && node.data.leaf) {
                        setFocusId(node.id);
                        break;
                    }
                }
            }
        }
    }, [treeDataQuery.data]);

    const onNodesChange = React.useCallback(
        (changes: NodeChange<GenerationTreeNode>[]) => {
            setNodes((nodesSnapshot) =>
                applyNodeChanges(changes, nodesSnapshot),
            );
            changes.forEach((change) => {
                if (
                    change.type === "dimensions" &&
                    focusId &&
                    focusId === change.id &&
                    change.dimensions &&
                    change.dimensions.height > 0 &&
                    change.dimensions.width > 0
                ) {
                    fitView({
                        nodes: [{ id: focusId }],
                        duration: 300,
                        minZoom: 0.5,
                        maxZoom: 1.5,
                        ease: (t) => Math.sqrt(t),
                    });

                    setFocusId(null);
                }
            });
        },
        [focusId, fitView],
    );
    const onEdgesChange = React.useCallback(
        (changes: EdgeChange[]) =>
            setEdges((edgesSnapshot) =>
                applyEdgeChanges(changes, edgesSnapshot),
            ),
        [],
    );
    const onConnect = React.useCallback(
        (params: any) =>
            setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
        [],
    );

    const handleNodeClick = React.useCallback(
        async (_: any, node: GenerationTreeNode) => {
            const branchId = node.data.branchId;
            sessionStore.setBranchId(branchId);
            // If generation is already in progress, pause
            if (isGenerating) {
                generationStore.generationAbort.value?.abort();
                generationStore.isGenerating.value = false;
                generationStore.paused.value = true;
                return;
            }

            generationStore.clearGeneration();
            generationStore.isGenerating.value = true;
            generationStore.paused.value = false;

            generationStore.selectedToken.value = undefined;
            generationStore.generationAbort.value = new AbortController();
            await prefillGeneration(
                sessionId || "",
                branchId,
                generationStore.appendToGeneration,
                undefined,
                generationStore.generationAbort.value,
            );

            generationStore.isGenerating.value = false;
            globalStore.viewMode.value = "generation";
        },
        [sessionId, isGenerating],
    );

    return (
        <div className="h-full w-full p-4">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                colorMode="system"
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                minZoom={0.1}
                maxZoom={3}
                // nodesDraggable={false}
                onNodeClick={handleNodeClick}
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    );
}

export default GraphPage;
