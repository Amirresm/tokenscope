import { projectInfoFromData, sampleFromData } from "../models/project";
import { API_BASE_URL } from "./constants";

export async function fetchProjects() {
    try {
        const response = await fetch(`${API_BASE_URL}/fetch_projects`);
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();
        const projects = data as string[];
        return projects;
    } catch (error) {
        console.error("Error:", error);
    }
}

export async function fetchProjectInfo(projectName: string) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/get_project?project_name=${projectName}`,
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();
        console.log("Project Info Data:", data);
        const projectInfo = projectInfoFromData(data);
        return projectInfo;
    } catch (error) {
        console.error("Error:", error);
    }
}

export async function fetchSample(projectName: string, taskId: string) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/get_sample?project_name=${projectName}&task_id=${taskId}`,
        );
        if (!response.ok) {
            console.error("Error:", response.statusText);
            return;
        }
        const data = await response.json();

        console.log(data.tokens[0])
        const sample = sampleFromData(data);
        return sample;
    } catch (error) {
        console.error("Error:", error);
    }
}
