import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  return JSON.parse(raw as string);
}
