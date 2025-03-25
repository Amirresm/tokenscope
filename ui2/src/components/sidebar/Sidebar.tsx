import drawerStore from "../../store/drawerStore";
import { GenerationSidebar } from "./GenerationSidebar";

export function Sidebar() {
    if (drawerStore.drawerStateSignal.value.tab === "generation")
        return <GenerationSidebar />;

    return (
        <ul className="menu bg-base-200 text-base-content min-h-full w-80 p-4">
            {/* Sidebar content here */}
            <li>
                <a>Sidebar Item 1</a>
            </li>
            <li>
                <a>Sidebar Item 2</a>
            </li>
        </ul>
    );
}
