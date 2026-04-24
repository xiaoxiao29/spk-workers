import { describe, it, expect } from "vitest";
import { DeviceList } from "../../src/device/DeviceList";

describe("DeviceList", () => {
  const testYaml = `
avoton:
  avoton:
    - RS814+
    - RS812+
    - DS1815+
broadwell:
  broadwell:
    - DS916+
    - DS716+
cedarview:
  cedarview:
    - DS412+
`;

  it("should parse device list", () => {
    const list = new DeviceList(testYaml);
    const devices = list.getDevices();
    expect(devices.length).toBe(6);
  });

  it("should get architecture list", () => {
    const list = new DeviceList(testYaml);
    const archs = list.getArchList();
    expect(archs).toContain("avoton");
    expect(archs).toContain("broadwell");
    expect(archs).toContain("cedarview");
  });

  it("should get devices by family", () => {
    const list = new DeviceList(testYaml);
    const families = list.getDevicesByFamily();
    expect(families.size).toBe(3);
  });
});
