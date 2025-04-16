import { LandingPage } from "./components/page/Landing";
import { Sidebar } from "./components/sidebar/Sidebar";
import drawerStore from "./store/drawerStore";

function App() {
    return (
        <div
            className={`drawer drawer-end ${drawerStore.drawerOpenSignal.value ? "drawer-open" : ""}`}
        >
            <input
                id="my-drawer"
                type="checkbox"
                className="group drawer-toggle"
                checked={drawerStore.drawerOpenSignal.value}
            />
            <div className="drawer-content transition-all">
                <div className="">
                    <LandingPage />
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
