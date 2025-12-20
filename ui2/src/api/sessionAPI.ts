import { API_BASE_URL } from "./constants";

export async function fetchSessions() {
    try {
        const response = await fetch(`${API_BASE_URL}/sessions`);
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();
        const sessions = data.sessions as string[];
        return sessions;
    } catch (error) {
        console.error("Error:", error);
    }
}

export async function fetchSessionBranches(session: string) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/session_branches?session_id=${session}`,
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();
        const branches = data.branches as string[];
        return branches;
    } catch (error) {
        console.error("Error:", error);
    }
}
