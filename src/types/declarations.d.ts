declare module "@expo/vector-icons";
declare module "@expo/vector-icons/*";
declare module "react-native-vector-icons/*";
declare module "@shopify/react-native-skia" {
  export const Canvas: any;
  export const Image: any;
  export const RoundedRect: any;
  export const Paragraph: any;
  export const FontStyle: any;
  export const Skia: any;
  export const FilterMode: any;
  export const MipmapMode: any;
  export const TileMode: any;
  export const useImage: any;
  export const useTouchHandler: any;
  export type SkImage = any;
}

declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.jpg" {
  const value: number;
  export default value;
}

declare module "*.jpeg" {
  const value: number;
  export default value;
}

declare module "*.webp" {
  const value: number;
  export default value;
}

declare module "*.svg" {
  const value: number;
  export default value;
}

declare module "upng-js";

interface ImportMeta {
  glob?: (pattern: string, options?: any) => Record<string, any>;
}
