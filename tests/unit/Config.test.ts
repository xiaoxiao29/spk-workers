import { describe, it, expect } from "vitest";
import { Config } from "../../src/config/Config";

describe("Config", () => {
  const mockEnv = {
    SSPKS_SITE_NAME: "Test Server",
    SSPKS_SITE_THEME: "material",
    SSPKS_PACKAGES_FILE_MASK: "*.spk",
    SSPKS_API_KEY: "test-key",
  } as Record<string, string | undefined>;

  it("should load site config from env", () => {
    const config = new Config(mockEnv, "https://example.com", "");
    expect(config.site.name).toBe("Test Server");
    expect(config.site.theme).toBe("material");
  });

  it("should use default values", () => {
    const config = new Config({} as Record<string, string | undefined>, "https://example.com", "");
    expect(config.site.name).toBe("Simple SPK Server");
    expect(config.site.theme).toBe("material");
  });

  it("should have correct paths", () => {
    const config = new Config(mockEnv, "https://example.com", "");
    expect(config.paths.packages).toBe("packages/");
    expect(config.paths.models).toBe("conf/synology_models.yaml");
  });
});
