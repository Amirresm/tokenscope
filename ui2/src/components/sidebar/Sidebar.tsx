import GenerationSidebar from "./generation-sidebar/generation-sidebar";
import StatsSidebar from "./stats-sidebar/stats-sidebar";
import ProjectSidebar from "./projects-sidebar/projects-sidebar";
import SessionSidebar from "./session-sidebar/session-sidebar";
import drawerStore from "../../store/components/drawerStore";

export function Sidebar() {
    return (
        <div className="w-80 h-full flex flex-col p-4 pl-0">
            {(() => {
                if (drawerStore.drawerStateSignal.value.tab === "session")
                    return <SessionSidebar />;
                if (drawerStore.drawerStateSignal.value.tab === "generation")
                    return <GenerationSidebar />;
                if (drawerStore.drawerStateSignal.value.tab === "stats")
                    return <StatsSidebar />;
                if (drawerStore.drawerStateSignal.value.tab === "projects")
                    return <ProjectSidebar />;
                else
                    return (
                        <div className="p-4 text-center text-sm text-gray-500">
                            Select a tab to view content
                        </div>
                    );
            })()}
        </div>
    );
}
