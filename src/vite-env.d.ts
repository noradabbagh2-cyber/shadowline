/// <reference types="vite/client" />
declare module '*.bin?inline' {
  const dataUrl: string;
  export default dataUrl;
}
