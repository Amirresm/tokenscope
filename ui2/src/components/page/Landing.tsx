import drawerStore from "../../store/drawerStore";
import { GenerationView } from "../GenerationView";
import { PromptInput } from "../PromptInput";

export function LandingPage() {
    return (
        <>
            <PromptInput />
            <GenerationView />
            <label
                htmlFor="my-drawer"
                className="btn btn-primary drawer-button"
                onClick={drawerStore.toggleDrawer}
            >
                Open drawer
            </label>
        </>
    );
}
