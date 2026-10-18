import { Platform } from "react-native";

export function isShowcaseDemo() {
  return Platform.OS === "web"
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("tagalongShowcase") === "1";
}
