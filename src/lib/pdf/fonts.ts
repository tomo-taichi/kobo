import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

export function ensureFonts() {
  if (registered) return;
  const fontPath = path.join(process.cwd(), "public/fonts/NotoSansJP.ttf");
  Font.register({ family: "NotoSansJP", src: fontPath });
  registered = true;
}
