export interface PackageMetadata {
  package: string;
  version: string;
  displayname: string;
  description: string;
  maintainer?: string;
  maintainer_url?: string;
  distributor?: string;
  distributor_url?: string;
  support_url?: string;
  helpurl?: string;
  arch: string[];
  thumbnail: string[];
  thumbnail_url: string[];
  snapshot: string[];
  snapshot_url: string[];
  beta?: boolean;
  firmware?: string;
  os_min_ver?: string;
  qinst?: boolean;
  qupgrade?: boolean;
  qstart?: boolean;
  spk?: string;
  spk_url?: string;
  silent_install?: boolean;
  silent_uninstall?: boolean;
  silent_upgrade?: boolean;
  checksum?: string;
  size?: number;
}

export function normalizeArchs(arch: string | string[] | undefined | null): string[] {
  if (!arch) return [];
  if (Array.isArray(arch)) return arch;
  if (typeof arch !== 'string') return [];
  const trimmed = arch.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not a valid JSON array
    }
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

export interface PackageInfo {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
  metadata: PackageMetadata;
}

export interface CacheData {
  key: string;
  metadata: Partial<PackageMetadata>;
  updated: number;
  archs: string[];
}

export class Package {
  metadata: PackageMetadata;

  constructor(metadata: PackageMetadata) {
    this.metadata = metadata;
  }

  static async fromCache(
    env: Env,
    packageName: string
  ): Promise<PackageInfo | null> {
    const cacheKey = `pkg:${packageName}`;
    const cacheValue = await env.SPKS_CACHE.get(cacheKey);

    if (!cacheValue) {
      return null;
    }

    try {
      const cacheData: CacheData = JSON.parse(cacheValue);
      const metadata: PackageMetadata = {
        package: cacheData.metadata.package || packageName,
        version: cacheData.metadata.version || "unknown",
        displayname: cacheData.metadata.displayname || cacheData.metadata.package || packageName,
        description: cacheData.metadata.description || "",
        arch: normalizeArchs(cacheData.metadata.arch),
        thumbnail: cacheData.metadata.thumbnail || [],
        thumbnail_url: cacheData.metadata.thumbnail_url || [],
        snapshot: cacheData.metadata.snapshot || [],
        snapshot_url: cacheData.metadata.snapshot_url || [],
        maintainer: cacheData.metadata.maintainer,
        maintainer_url: cacheData.metadata.maintainer_url,
        distributor: cacheData.metadata.distributor,
        distributor_url: cacheData.metadata.distributor_url,
        helpurl: cacheData.metadata.helpurl,
        beta: cacheData.metadata.beta,
        firmware: cacheData.metadata.firmware,
        qinst: cacheData.metadata.qinst,
        qupgrade: cacheData.metadata.qupgrade,
        qstart: cacheData.metadata.qstart,
        spk: cacheData.key,
        spk_url: "",
        silent_install: cacheData.metadata.silent_install,
        silent_uninstall: cacheData.metadata.silent_uninstall,
        silent_upgrade: cacheData.metadata.silent_upgrade,
        checksum: cacheData.metadata.checksum,
      };

      return {
        key: cacheData.key,
        filename: cacheData.key.replace("packages/", ""),
        size: 0,
        lastModified: new Date(cacheData.updated).toISOString(),
        metadata,
      };
    } catch (e) {
      console.error("Failed to parse cache data:", e);
      return null;
    }
  }

  static async fromR2Object(
    obj: R2Object,
    config: { baseUrl: string; packagesPath: string },
    env: Env
  ): Promise<PackageInfo | null> {
    const filename = obj.key.replace(config.packagesPath, "");
    const packageName = filename.replace(".spk", "").split("-").slice(0, -1).join("-") || filename.replace(".spk", "");

    const cached = await this.fromCache(env, packageName);
    if (cached) {
      const spkUrl = `${config.baseUrl}/packages/${filename}`;
      cached.metadata.spk_url = spkUrl;
      cached.filename = filename;
      cached.size = obj.size;
      cached.lastModified = obj.uploaded?.toISOString() || new Date().toISOString();
      return cached;
    }

    const spkUrl = `${config.baseUrl}/packages/${filename}`;
    return {
      key: obj.key,
      filename,
      size: obj.size,
      lastModified: obj.uploaded?.toISOString() || new Date().toISOString(),
      metadata: {
        package: packageName,
        version: "unknown",
        displayname: packageName,
        description: "",
        arch: [],
        thumbnail: [],
        thumbnail_url: [],
        snapshot: [],
        snapshot_url: [],
        spk: obj.key,
        spk_url: spkUrl,
      },
    };
  }

  isCompatibleToArch(arch: string): boolean {
    const archs = this.metadata.arch || [];
    return archs.includes(arch) || archs.includes("noarch");
  }

  isCompatibleToFirmware(firmware: string): boolean {
    const required = this.metadata.firmware;
    if (!required) return true;
    return this.compareFirmware(firmware, required) >= 0;
  }

  private compareFirmware(current: string, required: string): number {
    const parse = (v: string) => {
      const parts = v.split(".").map(Number);
      return { major: parts[0] || 0, minor: parts[1] || 0 };
    };
    const c = parse(current);
    const r = parse(required);
    if (c.major !== r.major) return c.major - r.major;
    return c.minor - r.minor;
  }

  static async saveToCache(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void> {
    const { IndexManager } = await import("../db/IndexManager");
    const { CacheKeyBuilder, CACHE_TTL } = await import("../utils/CacheKeyBuilder");

    const now = Date.now();
    const archs = normalizeArchs(metadata.arch);

    const cacheData: CacheData = {
      key: r2Key,
      metadata,
      updated: now,
      archs,
    };

    await env.SPKS_CACHE.put(
      CacheKeyBuilder.forPackage(packageName),
      JSON.stringify(cacheData),
      { expirationTtl: CACHE_TTL.PACKAGE_DETAIL }
    );

    const promises: Promise<void>[] = [];
    for (const arch of archs) {
      promises.push(IndexManager.addToArchIndex(env, arch, packageName));
    }
    if (!archs.includes("noarch")) {
      promises.push(IndexManager.addToArchIndex(env, "noarch", packageName));
    }
    promises.push(IndexManager.addToAllIndex(env, packageName));
    await Promise.all(promises);
  }

  static async deleteFromCache(
    env: Env,
    packageName: string
  ): Promise<void> {
    const { IndexManager } = await import("../db/IndexManager");
    const { CacheKeyBuilder } = await import("../utils/CacheKeyBuilder");

    const cacheKey = CacheKeyBuilder.forPackage(packageName);
    const cacheValue = await env.SPKS_CACHE.get(cacheKey);

    if (cacheValue) {
      const cacheData: CacheData = JSON.parse(cacheValue);
      const archs = cacheData.archs || [];

      const promises: Promise<void>[] = [];
      for (const arch of archs) {
        promises.push(IndexManager.removeFromArchIndex(env, arch, packageName));
      }
      if (!archs.includes("noarch")) {
        promises.push(IndexManager.removeFromArchIndex(env, "noarch", packageName));
      }
      promises.push(IndexManager.removeFromAllIndex(env, packageName));
      await Promise.all(promises);
    }

    await env.SPKS_CACHE.delete(cacheKey);
  }

  static async getAllPackageNames(env: Env): Promise<string[]> {
    const { IndexManager } = await import("../db/IndexManager");
    return IndexManager.getAllIndex(env);
  }

  static async getPackagesByArch(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]> {
    const { IndexManager } = await import("../db/IndexManager");

    const packageNames = await IndexManager.getArchIndex(env, arch);
    if (packageNames.length === 0) {
      return [];
    }

    const packages: PackageInfo[] = [];
    for (const name of packageNames) {
      const pkg = await this.fromCache(env, name);
      if (pkg) {
        pkg.metadata.spk_url = `${baseUrl}/packages/${pkg.filename}`;
        packages.push(pkg);
      }
    }

    return packages.filter(pkg =>
      pkg.metadata.arch.includes(arch) || pkg.metadata.arch.includes("noarch")
    );
  }
}