import GenerationSidebar from "./generation-sidebar/generation-sidebar";
import StatsSidebar from "./stats-sidebar/stats-sidebar";
import ProjectSidebar from "./projects-sidebar/projects-sidebar";
import SessionSidebar from "./session-sidebar/session-sidebar";
import drawerStore from "../../store/components/drawerStore";

export function Sidebar() {
    return (
        <div className="w-80 h-full flex flex-col p-4 pl-0">
            <button
                className="btn btn-ghost btn-primary mb-4"
                onClick={() => {
                    const modal = document.getElementById(
                        "llm_management_modal",
                    ) as HTMLDialogElement;
                    modal.showModal();
                }}
            >
                Change LLM
            </button>
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
                        <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4 grow">
                            <li>
                                <a>Sidebar Item 1</a>
                            </li>
                            <li>
                                <a>Sidebar Item 2</a>
                            </li>
                        </ul>
                    );
            })()}
        </div>
    );
}
