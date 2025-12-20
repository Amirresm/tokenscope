import { generationTreeFromData } from "../models/generationTree";
import { API_BASE_URL } from "./constants";

export async function fetchGenerationTree(sessionId: string) {
    try {
        const response = await fetch(`${API_BASE_URL}/get_generation_tree`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session_id: sessionId,
            }),
        });
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();

        const tree = generationTreeFromData(data);
        return tree;
    } catch (error) {
        console.error("Error:", error);
    }
}
