export interface RepositorySnapshotUploadDescriptor {
  method: "PUT";
  url: string;
  expiresAt: string;
}

export interface RepositorySnapshotObjectStore {
  createAttemptUpload(input: {
    objectKey: string;
    expiresAt: Date;
  }): Promise<RepositorySnapshotUploadDescriptor>;

  headObject(objectKey: string): Promise<{ exists: boolean; size: number | null }>;
  deleteObject(objectKey: string): Promise<void>;
}
