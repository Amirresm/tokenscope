import { useQuery } from "@tanstack/react-query";
import { fetchCurrentModel } from "../api/llmManagementAPI";

export function useCurrentModelQuery() {
    const currentModelQuery = useQuery({
        queryKey: ["current-model"],
        queryFn: async () =>
            fetchCurrentModel().then((data) => {
                const modelName = data?.modelNameOrPath
                    ? data.modelNameOrPath?.split("/")[
                          data.modelNameOrPath?.split("/").length - 1
                      ]
                    : null;
                return { ...data, modelName };
            }),
        refetchOnWindowFocus: true,
        staleTime: 100
    });

    return currentModelQuery;
}
