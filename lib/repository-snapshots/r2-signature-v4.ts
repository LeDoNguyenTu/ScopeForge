import { createHash, createHmac } from "node:crypto";

export interface R2SigningCredentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface SignedR2Request {
  url: string;
  headers: Record<string, string>;
}

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const OBJECT_KEY_PATTERN = /^repository-source\/[a-f0-9]{64}[.]tar[.]gz$/;
const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/;
const BUCKET_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])?$/;

function assertCredentials(credentials: R2SigningCredentials): void {
  if (!ACCOUNT_ID_PATTERN.test(credentials.accountId)) throw new Error("R2 account ID is invalid.");
  if (credentials.accessKeyId.length < 8 || credentials.accessKeyId.length > 128) {
    throw new Error("R2 access key ID is invalid.");
  }
  if (credentials.secretAccessKey.length < 16 || credentials.secretAccessKey.length > 256) {
    throw new Error("R2 secret access key is invalid.");
  }
  if (!BUCKET_PATTERN.test(credentials.bucket) || credentials.bucket.includes("..")) {
    throw new Error("R2 bucket name is invalid for virtual-hosted signing.");
  }
}

export function assertRepositorySnapshotObjectKey(objectKey: string): void {
  if (!OBJECT_KEY_PATTERN.test(objectKey)) throw new Error("Repository snapshot object key is invalid.");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalObjectPath(objectKey: string): string {
  return `/${objectKey.split("/").map(awsEncode).join("/")}`;
}

function amzTimestamp(date: Date): { dateStamp: string; amzDate: string } {
  if (!Number.isFinite(date.getTime())) throw new Error("R2 signing time is invalid.");
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { dateStamp: iso.slice(0, 8), amzDate: iso };
}

function signingKey(secretAccessKey: string, dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function signatureFor(
  secretAccessKey: string,
  dateStamp: string,
  stringToSign: string,
): string {
  return createHmac("sha256", signingKey(secretAccessKey, dateStamp))
    .update(stringToSign, "utf8")
    .digest("hex");
}

function endpoint(credentials: R2SigningCredentials): { host: string; baseUrl: string } {
  assertCredentials(credentials);
  const host = `${credentials.bucket}.${credentials.accountId}.r2.cloudflarestorage.com`;
  return { host, baseUrl: `https://${host}` };
}

function canonicalQuery(entries: ReadonlyArray<readonly [string, string]>): string {
  return [...entries]
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function createPresignedR2Url(input: {
  credentials: R2SigningCredentials;
  method: "GET" | "PUT";
  objectKey: string;
  expiresInSeconds: number;
  maxExpiresInSeconds: number;
  signedHeaders: string;
  canonicalHeaders: string;
  now: Date;
}): string {
  const {
    credentials,
    method,
    objectKey,
    expiresInSeconds,
    maxExpiresInSeconds,
    signedHeaders,
    canonicalHeaders,
    now,
  } = input;
  assertRepositorySnapshotObjectKey(objectKey);
  if (
    !Number.isInteger(expiresInSeconds)
    || expiresInSeconds < 1
    || expiresInSeconds > maxExpiresInSeconds
  ) {
    throw new Error(`Repository snapshot ${method === "GET" ? "download" : "upload"} expiry is invalid.`);
  }
  const { host, baseUrl } = endpoint(credentials);
  const { dateStamp, amzDate } = amzTimestamp(now);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const queryEntries = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${credentials.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ] as const;
  const unsignedQuery = canonicalQuery(queryEntries);
  const canonicalRequest = [
    method,
    canonicalObjectPath(objectKey),
    unsignedQuery,
    canonicalHeaders.replace("{host}", host),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = signatureFor(credentials.secretAccessKey, dateStamp, stringToSign);
  const signedQuery = canonicalQuery([...queryEntries, ["X-Amz-Signature", signature]]);
  return `${baseUrl}${canonicalObjectPath(objectKey)}?${signedQuery}`;
}

export function createPresignedR2PutUrl(input: {
  credentials: R2SigningCredentials;
  objectKey: string;
  expiresInSeconds: number;
  now: Date;
}): string {
  return createPresignedR2Url({
    ...input,
    method: "PUT",
    maxExpiresInSeconds: 360,
    signedHeaders: "content-type;host;if-none-match",
    canonicalHeaders: [
      "content-type:application/gzip",
      "host:{host}",
      "if-none-match:*",
      "",
    ].join("\n"),
  });
}

export function createPresignedR2GetUrl(input: {
  credentials: R2SigningCredentials;
  objectKey: string;
  expiresInSeconds: number;
  now: Date;
}): string {
  return createPresignedR2Url({
    ...input,
    method: "GET",
    maxExpiresInSeconds: 120,
    signedHeaders: "host",
    canonicalHeaders: [
      "host:{host}",
      "",
    ].join("\n"),
  });
}

export function createSignedR2Request(input: {
  credentials: R2SigningCredentials;
  method: "HEAD" | "DELETE";
  objectKey: string;
  now: Date;
}): SignedR2Request {
  const { credentials, method, objectKey, now } = input;
  assertRepositorySnapshotObjectKey(objectKey);
  const { host, baseUrl } = endpoint(credentials);
  const { dateStamp, amzDate } = amzTimestamp(now);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${EMPTY_SHA256}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalObjectPath(objectKey),
    "",
    canonicalHeaders,
    signedHeaders,
    EMPTY_SHA256,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = signatureFor(credentials.secretAccessKey, dateStamp, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return Object.freeze({
    url: `${baseUrl}${canonicalObjectPath(objectKey)}`,
    headers: Object.freeze({
      host,
      "x-amz-content-sha256": EMPTY_SHA256,
      "x-amz-date": amzDate,
      authorization,
    }),
  });
}