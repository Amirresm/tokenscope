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

    const selectedProject = projectsStore.selectedProject.value
    const sampleInfo = projectsStore.selectedSampleInfo.value;

    console.log(selectedProject, sampleInfo);
    const newSession = (!sessionId || !branchId) && (!selectedProject || !sampleInfo);

    if (newSession) {
        return <PromptInput />;
    }

    return (
        <ReactFlowProvider>
            <div className="flex flex-col h-full">
                <MainHeader />
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
