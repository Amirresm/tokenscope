import { API_BASE_URL } from "./constants";

export async function fetchCurrentModel() {
    try {
        const response = await fetch(`${API_BASE_URL}/current_model`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();

        const source = data.model_source as string;
        const modelNameOrPath = data.current_model as string;

        return { source, modelNameOrPath };
    } catch (error) {
        console.error("Error:", error);
    }
}

export async function fetchAvailableModels(source: string) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/available_models?source=${encodeURIComponent(source)}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();

        return data.models as { id: string; metadata: unknown }[];
    } catch (error) {
        console.error("Error:", error);
    }
}

export async function loadModel(modelNameOrPath: string, source: string) {
    try {
        const response = await fetch(`${API_BASE_URL}/load_model`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model_name_or_path: modelNameOrPath,
                source: source,
            }),
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return false;
        }
        return true;
    } catch (error) {
        console.error("Error:", error);
        return false;
    }
}
