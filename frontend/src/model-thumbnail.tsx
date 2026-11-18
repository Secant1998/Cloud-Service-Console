import { createRoot } from "react-dom/client";
import { ModelViewport } from "./components/ModelViewport";

declare global {
  interface Window { modelThumbnail: { ready: boolean; render: (id: string) => Promise<{ png?: string; error?: string }> }; }
}

const style = document.createElement("style");
style.textContent = ".model-viewport-shell,.model-viewport-stage,.model-viewport{position:absolute;inset:0}.model-viewport canvas{display:block;width:100%;height:100%}.model-viewport-status,.model-viewport-error{display:none}";
document.head.append(style);
window.modelThumbnail = {
  ready: true,
  render: id => new Promise(resolve => {
    const root = createRoot(document.getElementById("root")!);
    root.render(<ModelViewport assetId={id} theme="light" thumbnail onThumbnail={result => {
      resolve(result);
      window.setTimeout(() => root.unmount(), 0);
    }}/>);
  }),
};
