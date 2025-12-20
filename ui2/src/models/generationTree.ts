import { Edge, Node } from "@xyflow/react";

type GenerationTreeNodeJson = {
    id: string;
    text: string;
    parent_text: string;
    token_count: number;
    parent_token_count: number;
    total_confidence: number;
    parent_total_confidence: number;
    branch_id: string;
    leaf: boolean;
    y: number;
    x: number;
};

type GenerationTreeEdgeJson = {
    from: string;
    to: string;
};

export type GenerationTreeData = {
    nodes: GenerationTreeNodeJson[];
    edges: GenerationTreeEdgeJson[];
};

export type GenerationTreeNodeData = {
    label: string;
    text: string;
    parentText: string;
    tokenCount: number;
    confidence: number;
    totalConfidence: number;
    branchId: string;
    leaf: boolean;
    depth: number;
};

export type GenerationTreeNode = {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: GenerationTreeNodeData;
};

export type GenerationTree = {
    nodes: Node<GenerationTreeNodeData>[];
    edges: Edge[];
};

export function generationTreeFromData(
    data: GenerationTreeData,
): GenerationTree {
    return {
        nodes: data.nodes.map((node) => ({
            id: node.id,
            type: "text",
            position: { x: node.x * 300, y: node.y * 80 },
            data: {
                label: node.text,
                text: node.text,
                parentText: node.parent_text,
                tokenCount: node.token_count + node.parent_token_count,
                confidence: node.total_confidence / node.token_count,
                totalConfidence:
                    (node.total_confidence + node.parent_total_confidence) /
                    (node.token_count + node.parent_token_count),
                branchId: node.branch_id,
                leaf: node.leaf,
                depth: node.y,
            },
        })),
        edges: data.edges.map((edge) => ({
            id: `e${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to,
            type: "simplebezier",
        })),
    };
}
