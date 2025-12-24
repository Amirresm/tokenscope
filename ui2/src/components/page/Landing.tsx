import { ReactFlowProvider } from "@xyflow/react";
import GenerationView from "../generation-view/generation-view";
import GraphPage from "../graph/GraphPage";
import { PromptInput } from "../PromptInput";
import globalStore from "../../store/components/globalStore";
import { AstPage } from "../ast/AstPage";

export function LandingPage() {
    const viewMode = globalStore.viewMode.value;
    return (
        <ReactFlowProvider>
            <div className="flex flex-col h-full">
                <PromptInput />
                {viewMode === "generation" ? (
                    <GenerationView />
                ) : viewMode === "graph" ? (
                    <GraphPage />
                ) : viewMode === "ast" ? (
                    <AstPage />
                ) : null}
            </div>
        </ReactFlowProvider>
    );
}
