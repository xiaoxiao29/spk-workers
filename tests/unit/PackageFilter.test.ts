import { describe, it, expect } from "vitest";
import { PackageFilter } from "../../src/package/PackageFilter";
import { PackageInfo } from "../../src/package/Package";

describe("PackageFilter", () => {
  const createMockPackages = (): PackageInfo[] => [
    {
      key: "packages/pkg1-avoton.spk",
      filename: "pkg1-avoton.spk",
      size: 1024,
      lastModified: "2024-01-01",
      metadata: {
        package: "PackageA",
        version: "1.0.0",
        displayname: "Package A",
        description: "Test package A",
        arch: ["avoton", "noarch"],
        thumbnail: [],
        thumbnail_url: [],
        snapshot: [],
        snapshot_url: [],
        firmware: "6.0",
      },
    },
    {
      key: "packages/pkg2-broadwell.spk",
      filename: "pkg2-broadwell.spk",
      size: 2048,
      lastModified: "2024-01-02",
      metadata: {
        package: "PackageB",
        version: "2.0.0",
        displayname: "Package B",
        description: "Test package B",
        arch: ["broadwell"],
        thumbnail: [],
        thumbnail_url: [],
        snapshot: [],
        snapshot_url: [],
        firmware: "6.2",
      },
    },
  ];

  it("should filter by architecture", () => {
    const filter = new PackageFilter(createMockPackages());
    filter.setArchitectureFilter("avoton");
    const result = filter.getFilteredPackageList();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should return all packages without filter", () => {
    const filter = new PackageFilter(createMockPackages());
    const result = filter.getFilteredPackageList();
    expect(result.length).toBe(2);
  });
});
