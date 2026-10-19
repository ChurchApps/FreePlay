import i18n from "i18next";
import en from "../locales/en.json";

const t = i18n.createInstance();

beforeAll(async () => {
  await t.init({ resources: { en: { translation: en } }, lng: "en", interpolation: { escapeValue: false } });
});

describe("en auth screen strings", () => {
  it.each(["providerOAuth", "providerDeviceAuth"])("%s shows the provider name and minutes", (ns) => {
    expect(t.t(`${ns}.connectTo`, { name: "Go Curriculum" })).toContain("Go Curriculum");
    expect(t.t(`${ns}.expiresIn`, { minutes: 14 })).toContain("14");
  });
});
