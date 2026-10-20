declare module "imagetracerjs" {
  const ImageTracer: {
    imagedataToSVG: (imgData: ImageData, options?: Record<string, unknown> | string) => string;
  };
  export default ImageTracer;
}
