/**
 * Sync Transport
 *
 * HTTP adapter for sync API calls.
 * Abstracts the HTTP client and provides error normalization.
 */

import type {
  StatusStepResponse,
  FetchStepResponse,
  PersistStepResponse,
  RecordPing,
} from "./types";

export interface SyncTransportConfig {
  /** Base URL for sync API (e.g., 'https://api.example.com') */
  baseUrl: string;

  /** Get auth token (called before each syncRequest) */
  getToken: () => Promise<string | null>;

  /** syncRequest timeout in ms */
  timeout?: number;
}

export class SyncTransportError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseData?: unknown,
  ) {
    super(message);
    this.name = "SyncTransportError";
  }
}

/**
 * HTTP transport for sync operations.
 */
export class SyncTransport {
  private config: Required<SyncTransportConfig>;

  constructor(config: SyncTransportConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  private async syncRequest<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.config.getToken();

    if (!token) {
      throw new SyncTransportError("No auth token available");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new SyncTransportError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData,
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof SyncTransportError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new SyncTransportError("syncRequest timeout");
      }

      throw new SyncTransportError(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Step 1: Status - Compare local records with server
   */
  async status(
    table: string,
    records: RecordPing[],
  ): Promise<StatusStepResponse> {
    const response = await this.syncRequest<{
      result: StatusStepResponse;
      error?: { data: { message: string } };
    }>("POST", `/api/sync/${table}/step1/status`, { objects: records });

    if (response.error) {
      throw new SyncTransportError(response.error.data.message);
    }

    return response.result;
  }

  /**
   * Step 2: Fetch - Download records by ruid
   */
  async fetch<T = Record<string, unknown>>(
    table: string,
    ruids: string[],
  ): Promise<T[]> {
    if (ruids.length === 0) return [];

    const response = await this.syncRequest<FetchStepResponse<T>>(
      "POST",
      `/api/sync/${table}/step2/fetch`,
      { ruids },
    );

    if (response.error) {
      throw new SyncTransportError(response.error.data.message);
    }

    return response.result;
  }

  /**
   * Step 3: Persist - Upload local changes
   */
  async persist<T = Record<string, unknown>>(
    table: string,
    records: T[],
  ): Promise<PersistStepResponse> {
    if (records.length === 0) {
      return { done: [], failed: [] };
    }

    const response = await this.syncRequest<{
      result: PersistStepResponse;
      error?: { data: { message: string } };
    }>("POST", `/api/sync/${table}/step3/persist`, { objects: records });

    if (response.error) {
      throw new SyncTransportError(response.error.data.message);
    }

    return response.result;
  }

  /**
   * Upload a file (multipart/form-data)
   */
  async uploadFile(file: Blob, fileName: string): Promise<{ url: string }> {
    const token = await this.config.getToken();
    if (!token) throw new SyncTransportError("No auth token available");

    const formData = new FormData();
    formData.append("file", file, fileName);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Content-Type header is set automatically by fetch for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        throw new SyncTransportError(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new SyncTransportError(
        error instanceof Error ? error.message : "Upload failed",
      );
    }
  }

  /**
   * Download a file (returns Blob)
   */
  async downloadFile(url: string): Promise<Blob> {
    const token = await this.config.getToken();
    if (!token) throw new SyncTransportError("No auth token available");

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new SyncTransportError(`Download failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      throw new SyncTransportError(
        error instanceof Error ? error.message : "Download failed",
      );
    }
  }
}

/** Singleton transport instance */
let transportInstance: SyncTransport | null = null;

/** Initialize the sync transport */
export function initSyncTransport(config: SyncTransportConfig): SyncTransport {
  transportInstance = new SyncTransport(config);
  return transportInstance;
}

/** Get the sync transport instance */
export function getSyncTransport(): SyncTransport {
  if (!transportInstance) {
    throw new Error(
      "SyncTransport not initialized. Call initSyncTransport() first.",
    );
  }
  return transportInstance;
}
