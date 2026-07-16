declare module 'pdfmake' {
  type VirtualFont = { data: string; encoding: BufferEncoding };
  type FontContainer = {
    vfs: Record<string, VirtualFont>;
    fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>;
  };

  type PdfMake = {
    virtualfs: { writeFileSync(name: string, content: string, encoding: BufferEncoding): void };
    addFonts(fonts: FontContainer['fonts']): void;
    setLocalAccessPolicy(policy: (path: string) => boolean): void;
    setUrlAccessPolicy(policy: (url: string) => boolean): void;
    createPdf(definition: unknown): { getBuffer(): Promise<Buffer> };
  };

  const pdfMake: PdfMake;
  export default pdfMake;
}

declare module 'pdfmake/build/fonts/Roboto.js' {
  const container: {
    vfs: Record<string, { data: string; encoding: BufferEncoding }>;
    fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>;
  };
  export default container;
}
