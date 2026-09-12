import type { Json } from "./database.types";
import type { Phase6dDatabase } from "./database.phase6d.types";
import type { Phase10a1Database } from "./database.phase10a1.types";

export type Phase10a2Functions = Phase10a1Database["public"]["Functions"]
  & Phase6dDatabase["public"]["Functions"]
  & {
    register_private_repository_snapshot_worker_node: {
      Args: {
        target_credential_hash: string;
        target_software_version: string;
      };
      Returns: Json;
    };
    enqueue_private_repository_snapshot_worker_task: {
      Args: {
        target_workspace_id: string;
        target_asset_id: string;
        target_actor_id: string;
        target_github_repository_link_id: string;
      };
      Returns: Json;
    };
    enqueue_connected_private_project_snapshot: {
      Args: {
        target_workspace_id: string;
        target_asset_id: string;
        target_actor_id: string;
        target_link_id: string;
      };
      Returns: Json;
    };
  };

export type Phase10a2Database = Omit<Phase10a1Database, "public"> & {
  public: Omit<Phase10a1Database["public"], "Functions"> & {
    Functions: Phase10a2Functions;
  };
};
