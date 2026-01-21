import { ReactFlowProvider } from "@xyflow/react";
import GenerationView from "../generation-view/generation-view";
import GraphPage from "../graph/GraphPage";
import { PromptInput } from "../PromptInput";
import globalStore from "../../store/components/globalStore";
import { AstPage } from "../ast/AstPage";
import sessionStore from "../../store/sessionStore";
import { MainHeader } from "../main-header/MainHeader";
import projectsStore from "../../store/projectsStore";

export function LandingPage() {
    const viewMode = globalStore.viewMode.value;
    const sessionId = sessionStore.sessionId.value;
    const branchId = sessionStore.branchId.value;

    const selectedProject = projectsStore.selectedProject.value;
    const sampleInfo = projectsStore.selectedSampleInfo.value;

    const newSession =
        (!sessionId || !branchId) && (!selectedProject || !sampleInfo);

    if (newSession) {
        return <PromptInput />;
    }

    return (
        <ReactFlowProvider>
            <div className="flex flex-col">
                <MainHeader />
                <div className="bg-base-200 mx-4 mt-2 mb-4 rounded-lg border-base-300 border flex-grow min-h-0">
                    {viewMode === "generation" ? (
                        <GenerationView />
                    ) : viewMode === "graph" ? (
                        <GraphPage />
                    ) : viewMode === "ast" ? (
                        <AstPage />
                    ) : null}
                </div>
            </div>
        </ReactFlowProvider>
    );
}
