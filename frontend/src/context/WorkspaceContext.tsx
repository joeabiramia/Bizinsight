import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";

export type WorkspaceRole = "owner" | "admin" | "analyst" | "viewer";

export interface WorkspaceInfo {
  owner_id: string;
  owner_name: string;
}

interface WorkspaceContextType {
  workspace: WorkspaceInfo | null;   // null = user owns their own workspace (no parent)
  role: WorkspaceRole;
  isInWorkspace: boolean;            // true when the user is a member of someone else's workspace
  loading: boolean;
  refresh: () => Promise<void>;
  /** True if the role allows the given action */
  can: (action: WorkspaceAction) => boolean;
}

export type WorkspaceAction =
  | "upload"
  | "analyze"
  | "view"
  | "delete_dataset"
  | "manage_team"
  | "manage_settings";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4, admin: 3, analyst: 2, viewer: 1,
};

const ACTION_MIN_RANK: Record<WorkspaceAction, number> = {
  upload:           2,
  analyze:          2,
  view:             1,
  delete_dataset:   3,
  manage_team:      3,
  manage_settings:  4,
};

function checkCan(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return ROLE_RANK[role] >= ACTION_MIN_RANK[action];
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("owner");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspace(null);
      setRole("owner");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/workspace/my-workspace");
      const data = res.data;
      if (data.workspace) {
        setWorkspace(data.workspace);
        setRole(data.role as WorkspaceRole);
      } else {
        setWorkspace(null);
        setRole("owner");
      }
    } catch {
      setWorkspace(null);
      setRole("owner");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load workspace context whenever the logged-in user changes
  useEffect(() => { refresh(); }, [refresh]);

  const can = useCallback(
    (action: WorkspaceAction) => checkCan(role, action),
    [role],
  );

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      role,
      isInWorkspace: workspace !== null,
      loading,
      refresh,
      can,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
