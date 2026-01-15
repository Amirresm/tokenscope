import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";

focusManager.setEventListener((handleFocus) => {
    const setIsFocused = () => {
        handleFocus(true);
    };
    const setIsNotFocused = () => {
        handleFocus(false);
    };

    if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("focus", setIsFocused, false);
        window.addEventListener("blur", setIsNotFocused, false);

        return () => {
            // Be sure to unsubscribe if a new handler is set
            window.removeEventListener("focus", setIsFocused);
            window.removeEventListener("blur", setIsNotFocused);
        };
    }
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            networkMode: "always",
        },
    },
});

export function Root() {
    return (
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    );
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Root />
    </StrictMode>,
);
