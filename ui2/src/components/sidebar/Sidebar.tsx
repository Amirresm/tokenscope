import { List } from "@phosphor-icons/react";
import drawerStore from "../../store/drawerStore";
import GenerationSidebar from "./generation-sidebar/generation-sidebar";

export function Sidebar() {
    return (
        <div className="w-80 h-full flex flex-row">
            <div className="flex flex-col items-center gap-2 my-4">
				<button className="btn btn-ghost btn-sm btn-square" onClick={() => drawerStore.closeDrawer()}>
					<List />
				</button>
                <div className="divider divider-horizontal mx-0 grow self-center"></div>
            </div>
            {(() => {
                if (drawerStore.drawerStateSignal.value.tab === "generation")
                    return <GenerationSidebar />;
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
