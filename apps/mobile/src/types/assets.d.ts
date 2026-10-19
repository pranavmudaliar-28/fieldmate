/** Metro resolves an imported image to an asset id, which <Image> accepts as a source. */
declare module '*.png' {
  const asset: number;
  export default asset;
}
