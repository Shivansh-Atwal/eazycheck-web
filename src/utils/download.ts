type CapacitorFilesystem = {
  writeFile?: (options: {
    path: string;
    data: string;
    directory?: string;
    recursive?: boolean;
  }) => Promise<{ uri?: string }>;
};

type CapacitorRuntime = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Filesystem?: CapacitorFilesystem;
  };
};

declare global {
  interface Window {
    Capacitor?: CapacitorRuntime;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

const isNativeCapacitor = (): boolean => {
  const runtime = window.Capacitor;
  return Boolean(runtime?.isNativePlatform?.() || runtime?.getPlatform?.() === 'android' || runtime?.getPlatform?.() === 'ios');
};

const toBase64 = (content: string): string => {
  return btoa(unescape(encodeURIComponent(content)));
};

const browserDownload = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadTextFile = async (
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8'
): Promise<void> => {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'download-file',
      filename,
      content,
      mimeType,
    }));
    return;
  }

  const filesystem = window.Capacitor?.Plugins?.Filesystem;

  if (isNativeCapacitor() && filesystem?.writeFile) {
    try {
      alert(`Downloading ${filename}...`);
      const result = await filesystem.writeFile({
        path: filename,
        data: toBase64(content),
        directory: 'DOCUMENTS',
        recursive: true,
      });
      alert(`Download complete.\nSaved as ${filename}${result.uri ? `\n${result.uri}` : ''}`);
      return;
    } catch (error) {
      console.error('Native file download failed:', error);
      alert(`Download failed for ${filename}. Opening browser download instead.`);
    }
  }

  browserDownload(filename, content, mimeType);
};
