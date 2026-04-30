export const fallbackLng = "ar";
export const languages = ["ar", "en"];
export const defaultNS = "translation";
export const cookieName = "i18next";
export const headerName = "x-i18next-current-language";

export function getOptions(lng = fallbackLng, ns = defaultNS) {
  return {
    supportedLngs: languages,
    fallbackLng,
    lng,
    fallbackNS: defaultNS,
    defaultNS,
    ns,
  };
}
