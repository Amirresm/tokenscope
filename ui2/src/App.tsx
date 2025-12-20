import {
    ChartBarIcon,
    FolderIcon,
    ListIcon,
    UserIcon,
} from "@phosphor-icons/react";
import { LandingPage } from "./components/page/Landing";
import { Sidebar } from "./components/sidebar/Sidebar";
import React from "react";
import drawerStore, { DrawerTabsEnum } from "./store/components/drawerStore";

const tabs = [
    { tab: DrawerTabsEnum.SESSION, icon: UserIcon },
    { tab: DrawerTabsEnum.GENERATION, icon: ListIcon },
    { tab: DrawerTabsEnum.STATS, icon: ChartBarIcon },
    { tab: DrawerTabsEnum.PROJECTS, icon: FolderIcon },
];

function App() {
    const drawerState = drawerStore.drawerStateSignal.value;
    const drawerOpen = drawerState.open;

    const handleToggleDrawer = React.useCallback(
        (tab: DrawerTabsEnum) => {
            if (drawerOpen && drawerState.tab === tab) {
                drawerStore.closeDrawer();
            } else {
                drawerStore.setDrawerTab(tab);
                drawerStore.openDrawer();
            }
        },
        [drawerOpen, drawerState],
    );

    return (
        <div className={`drawer drawer-end ${drawerOpen ? "drawer-open" : ""}`}>
            <input
                id="my-drawer"
                type="checkbox"
                className="group drawer-toggle"
                checked={drawerOpen}
            />
            <div className="drawer-content transition-all h-screen mr-4 flex">
                <div className="grow">
                    <LandingPage />
                </div>
                <div className="flex flex-col items-center gap-2 my-4">
                    {tabs.map(({ tab, icon: Icon }) => (
                        <button
                            key={tab}
                            className={`btn btn-ghost btn-sm btn-square ${
                                drawerState.tab === tab ? "btn-active" : ""
                            }`}
                            onClick={() => handleToggleDrawer(tab)}
                        >
                            <Icon />
                        </button>
                    ))}
                    <div className="divider divider-horizontal mx-0 grow self-center"></div>
                </div>
            </div>
            <div className="drawer-side">
                <label
                    htmlFor="my-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                ></label>
                <Sidebar />
            </div>
        </div>
    );
}

export default App;
