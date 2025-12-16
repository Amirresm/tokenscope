import { useQuery } from "@tanstack/react-query";
import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Background,
    Controls,
    Edge,
    Handle,
    MiniMap,
    Node,
    NodeProps,
    Position,
    ReactFlow,
    useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import generationStore from "../../store/generationStore";
import generationAPI from "../../api/generationAPI";
import React from "react";
import dagre from "@dagrejs/dagre";

export function TextNode(props: NodeProps) {
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
    nodes: Node[],
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
        // const nodeHeight = 300
        console.log(
            node.data.branchId,
            "depth:",
            node.data.depth,
            "numLines:",
            totalParentLines,
            "calculatedHeight:",
            nodeHeight,
        );
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        // console.log("node", node);
        // console.log("nodeWithPosition", nodeWithPosition);
        const newNode = {
            ...node,
            targetPosition: isHorizontal ? "left" : "top",
            sourcePosition: isHorizontal ? "right" : "bottom",
            position: {
                // x: nodeWithPosition.x - nodeWithPosition.width / 2,
                // x: nodeWithPosition.x,
                x: node.position.x * 1.1,
                // y: nodeWithPosition.y - nodeWithPosition.height / 2,
                y: nodeWithPosition.y,
            },
        };

        return newNode;
    });

    return { nodes: newNodes, edges };
};

const nodeTypes = { text: TextNode };

function GraphPage() {
    const sessionId = generationStore.sessionId.value;
    const branchId = generationStore.branchId.value;
    const isGenerating = generationStore.isGenerating.value;

    const { fitView } = useReactFlow();

    const treeDataQuery = useQuery({
        queryKey: ["treeData", sessionId],
        queryFn: async () => {
            if (!sessionId) return null;
            const data = await generationAPI.getGenerationTree({ sessionId });
            return data;
        },
    });
    const [nodes, setNodes] = React.useState([]);
    const [edges, setEdges] = React.useState([]);
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
        (changes) => {
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
        (changes) =>
            setEdges((edgesSnapshot) =>
                applyEdgeChanges(changes, edgesSnapshot),
            ),
        [],
    );
    const onConnect = React.useCallback(
        (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
        [],
    );

    const handleNodeClick = React.useCallback(
        async (event, node) => {
            const branchId = node.data.branchId;
            generationStore.setBranchId(branchId);
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
            await generationAPI.prefillGeneration({
                sessionId: sessionId || "",
                branchId: branchId,
                abortSignal: generationStore.generationAbort.value,
                handleData: generationStore.appendToGeneration,
            });

            generationStore.isGenerating.value = false;
            generationStore.viewMode.value = "generation";
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
