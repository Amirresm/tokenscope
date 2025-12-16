import { ReactFlowProvider } from "@xyflow/react";
import generationStore from "../../store/generationStore";
import GenerationView from "../generation-view/generation-view";
import GraphPage from "../graph/GraphPage";
import { PromptInput } from "../PromptInput";

export function LandingPage() {
    const viewMode = generationStore.viewMode.value;
    return (
        <ReactFlowProvider>
            <div className="flex flex-col h-full">
                <PromptInput />
                {viewMode === "generation" ? (
                    <GenerationView />
                ) : viewMode === "graph" ? (
                    <GraphPage />
                ) : null}
            </div>
        </ReactFlowProvider>
    );
}
