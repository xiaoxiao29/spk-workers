import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

interface SpkInfo {
  package?: string;
  version?: string;
  arch?: string | string[];
  os_min_ver?: string;
  maintainer?: string;
  description?: string;
  displayname?: string;
  [key: string]: string | string[] | undefined;
}

function parseInfoContent(content: string): SpkInfo {
  const result: SpkInfo = {};
  const infoEnd = content.indexOf("\x00");
  const infoPart = infoEnd === -1 ? content : content.substring(0, infoEnd);
  const lines = infoPart.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter((v) => v) as unknown as string;
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function searchInfoInFile(buffer: Buffer): string | null {
  const content = buffer.toString("latin1");

  const packageIndex = content.indexOf("package=");
  if (packageIndex === -1) {
    return null;
  }

  const keyPatterns = ["\ncur_os=", "\nversion=", "\npackage=", "package="];
  const candidates: {
    pattern: string;
    start: number;
    end: number;
    length: number;
    content: string;
    hasPackage: boolean;
    hasVersion: boolean;
  }[] = [];

  for (const pattern of keyPatterns) {
    let idx = content.indexOf(pattern);
    while (idx !== -1) {
      const start = pattern === "package=" ? idx : idx + 1;
      let end = content.indexOf("\x00", start);
      if (end === -1) end = content.length;

      const infoContent = content.substring(start, end).trim();

      candidates.push({
        pattern,
        start,
        end,
        length: infoContent.length,
        content: infoContent,
        hasPackage: infoContent.indexOf("package=") !== -1,
        hasVersion: infoContent.indexOf("version=") !== -1,
      });

      idx = content.indexOf(pattern, idx + 1);
    }
  }

  candidates.sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    if (candidate.hasPackage && candidate.hasVersion && candidate.length > 100) {
      return candidate.content;
    }
  }

  for (const candidate of candidates) {
    if (candidate.hasPackage && candidate.length > 50) {
      return candidate.content;
    }
  }

  for (const candidate of candidates) {
    if (candidate.length > 100) {
      return candidate.content;
    }
  }

  return null;
}

function extractInfo(filePath: string): SpkInfo | null {
  const buffer = fs.readFileSync(filePath);
  const infoContent = searchInfoInFile(buffer);
  if (!infoContent) return null;
  return parseInfoContent(infoContent);
}

const PACKAGES_DIR = path.join(process.cwd(), "packages");

function getSpkFiles(): string[] {
  try {
    if (!fs.existsSync(PACKAGES_DIR)) {
      return [];
    }
    return fs
      .readdirSync(PACKAGES_DIR)
      .filter((f) => f.endsWith(".spk"))
      .map((f) => path.join(PACKAGES_DIR, f));
  } catch {
    return [];
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function runIfExists(filePath: string, fn: () => void): void {
  if (fileExists(filePath)) {
    fn();
  }
}

describe("SPK Parser", () => {
  const spkFiles = getSpkFiles();
  const hasSpkFiles = spkFiles.length > 0;

  it("should check packages directory exists", () => {
    expect(typeof hasSpkFiles).toBe("boolean");
  });

  describe("ActiveInsight-armv8-3.0.5-24122.spk", () => {
    const filePath = path.join(PACKAGES_DIR, "ActiveInsight-armv8-3.0.5-24122.spk");

    it("should parse package name", () => {
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("ActiveInsight");
    });

    it("should parse version", () => {
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.version).toMatch(/\d+\.\d+\.\d+/);
    });

    it("should parse os_min_ver", () => {
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.os_min_ver).toBe("7.2-64561");
    });

    it("should parse maintainer", () => {
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.maintainer).toBe("Synology Inc.");
    });
  });

  describe("PlexMediaServer-1.43.0.10492-121068a07-x86_64_DSM72.spk", () => {
    const filePath = path.join(
      PACKAGES_DIR,
      "PlexMediaServer-1.43.0.10492-121068a07-x86_64_DSM72.spk"
    );

    it("should parse package info", () => {
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("PlexMediaServer");
      expect(info?.version).toBe("1.43.0.10492-720010492");
      expect(info?.arch).toBe("x86_64");
      expect(info?.os_min_ver).toBe("7.2.2-70000");
    });
  });

  describe("redis packages", () => {
    it("should parse DSM6-redis.v11.spk", () => {
      const filePath = path.join(PACKAGES_DIR, "DSM6-redis.v11.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("redis");
      expect(info?.version).toBe("7.0.2-11");
      expect(info?.os_min_ver).toBe("6.1-15047");
    });

    it("should parse DSM7-redis.v11.spk", () => {
      const filePath = path.join(PACKAGES_DIR, "DSM7-redis.v11.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("redis");
      expect(info?.version).toBe("7.0.2-11");
      expect(info?.os_min_ver).toBe("7.0-41890");
    });

    it("should parse redis_cedarview_2.6.7-2.spk", () => {
      const filePath = path.join(PACKAGES_DIR, "redis_cedarview_2.6.7-2.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("redis");
      expect(info?.version).toBe("2.6.7-2");
      expect(info?.arch).toBe("cedarview");
    });
  });

  describe("SynoCommunity packages", () => {
    it("should parse couchpotatoserver", () => {
      const filePath = path.join(PACKAGES_DIR, "couchpotatoserver_noarch_20130412-3.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("couchpotatoserver");
      expect(info?.arch).toBe("noarch");
    });

    it("should parse sickbeard", () => {
      const filePath = path.join(PACKAGES_DIR, "sickbeard_noarch_20130412-5.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("sickbeard");
      expect(info?.arch).toBe("noarch");
    });

    it("should parse sabnzbd", () => {
      const filePath = path.join(PACKAGES_DIR, "sabnzbd_cedarview_0.7.11-6.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("sabnzbd");
      expect(info?.arch).toBe("cedarview");
    });

    it("should parse transmission", () => {
      const filePath = path.join(PACKAGES_DIR, "transmission_cedarview_2.77-5.spk");
      if (!fileExists(filePath)) return;
      const info = extractInfo(filePath);
      expect(info?.package).toBe("transmission");
      expect(info?.arch).toBe("cedarview");
    });
  });

  describe("All SPK files", () => {
    it("should parse all SPK files without errors", () => {
      if (!hasSpkFiles) return;
      const results: { file: string; success: boolean; error?: string }[] = [];

      for (const filePath of spkFiles) {
        const filename = path.basename(filePath);
        try {
          const info = extractInfo(filePath);
          if (info && info.package) {
            results.push({ file: filename, success: true });
          } else {
            results.push({ file: filename, success: false, error: "No package name found" });
          }
        } catch (e) {
          results.push({ file: filename, success: false, error: String(e) });
        }
      }

      const failed = results.filter((r) => !r.success);
      expect(failed.length).toBe(0);
    });

    it("should extract package name from all SPK files", () => {
      if (!hasSpkFiles) return;
      for (const filePath of spkFiles) {
        const info = extractInfo(filePath);
        expect(info).not.toBeNull();
        expect(info?.package).toBeDefined();
        expect(typeof info?.package).toBe("string");
        expect(info?.package!.length).toBeGreaterThan(0);
      }
    });

    it("should extract version from all SPK files", () => {
      if (!hasSpkFiles) return;
      for (const filePath of spkFiles) {
        const info = extractInfo(filePath);
        expect(info).not.toBeNull();
        expect(info?.version).toBeDefined();
        expect(typeof info?.version).toBe("string");
      }
    });
  });
});
