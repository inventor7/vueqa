/**
 * Media Manager
 *
 * Handles local file storage for syncable media (images, docs).
 * Wraps @capacitor/filesystem to provide a simple API.
 */

import { Filesystem, Directory } from "@capacitor/filesystem";

const MEDIA_DIR = "sync_media";

export const mediaManager = {
  /**
   * Initialize media directory.
   */
  async init(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: MEDIA_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {
      // Ignore if exists
    }
  },

  /**
   * Save a base64 or blob data to a file.
   * Returns the file path (relative to Data directory or full URI).
   */
  async saveFile(filename: string, dataBase64: string): Promise<string> {
    await this.init();

    const path = `${MEDIA_DIR}/${filename}`;

    const result = await Filesystem.writeFile({
      path,
      data: dataBase64,
      directory: Directory.Data,
      recursive: true,
    });

    return result.uri;
  },

  /**
   * Read file as base64.
   */
  async readFile(filename: string): Promise<string> {
    const path = `${MEDIA_DIR}/${filename}`;

    const result = await Filesystem.readFile({
      path,
      directory: Directory.Data,
    });

    return result.data as string;
  },

  /**
   * Check if file exists.
   */
  async exists(filename: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: `${MEDIA_DIR}/${filename}`,
        directory: Directory.Data,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get public URL for a file (for <img> src).
   * Capacitor provides a way to convert native path to webview path.
   */
  async getPublicUrl(filename: string): Promise<string> {
    const uri = await Filesystem.getUri({
      path: `${MEDIA_DIR}/${filename}`,
      directory: Directory.Data,
    });
    return uri.uri; // Capacitor.convertFileSrc(uri.uri) might be needed in some contexts
  },

  /**
   * Extract filename from a local path.
   */
  getFilename(path: string): string {
    return path.split("/").pop() || "";
  },
};
