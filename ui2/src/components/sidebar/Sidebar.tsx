import { List } from "@phosphor-icons/react";
import drawerStore from "../../store/drawerStore";
import GenerationSidebar from "./generation-sidebar/generation-sidebar";
import StatsSidebar from "./stats-sidebar/stats-sidebar";
import ProjectSidebar from "./projects-sidebar/projects-sidebar";

export function Sidebar() {
    return (
        <div className="w-80 h-full flex flex-row p-4 pl-0">
            {(() => {
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
