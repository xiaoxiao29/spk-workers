/**
 * 全局类型声明
 */

/// <reference types="@cloudflare/workers-types" />

declare global {
  interface Env {
    SPKS_BUCKET: R2Bucket;
    SPKS_CACHE: KVNamespace;
    SPKS_DB: D1Database;
    SSPKS_SITE_NAME?: string;
    SSPKS_SITE_THEME?: string;
    SSPKS_STORAGE_BACKEND?: 'kv' | 'd1' | 'hybrid';
    SSPKS_PACKAGES_FILE_MASK?: string;
    SSPKS_API_KEY?: string;
    SSPKS_SITE_REDIRECTINDEX?: string;
    SSPKS_EXTERNAL_STORAGE_URL?: string;
  }
}

export {};