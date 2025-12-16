const getSessions = async () => {
    try {
        const response = await fetch("http://10.0.0.92:3000/api/sessions");
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
};

const getSessionBranches = async (session: string) => {
    try {
        const response = await fetch(
            `http://10.0.0.92:3000/api/session_branches?session_id=${session}`,
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
};

export default {
    getSessions,
    getSessionBranches,
};
