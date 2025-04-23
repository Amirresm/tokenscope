import GenerationView from "../generation-view/generation-view";
import { PromptInput } from "../PromptInput";

export function LandingPage() {
    return (
        <div className="flex flex-col h-full">
            <PromptInput />
            <GenerationView />
        </div>
    );
}
            //<label
            //    htmlFor="my-drawer"
            //    className="btn btn-primary drawer-button"
            //    onClick={drawerStore.toggleDrawer}
            //>
            //    Open drawer
            //</label>

