// dentro de MM3PixelOrbSprite.jsx
// props: fixedColor = '#000000' por defecto
export default function MM3PixelOrbSprite({
  src = '/mm3-token.png',
  fixedColor = '#000000',
  pixelCols = 28,
  grid = 6,
  zIndex = 0,
  startSelector,
  endSelector,
  durationMs = 14000
}) {
  // ...

  const prepareOffscreens = () => {
    const img = imgRef.current;
    if (!img) return;

    const aspect = img.height / img.width;
    const smallW = Math.max(8, pixelCols);
    const smallH = Math.max(8, Math.round(smallW * aspect));

    // Canvas reducido (pixelado)
    const small = document.createElement('canvas');
    small.width = smallW;
    small.height = smallH;
    const sctx = small.getContext('2d', { alpha: true });
    sctx.imageSmoothingEnabled = false;
    sctx.clearRect(0, 0, smallW, smallH);
    sctx.drawImage(img, 0, 0, smallW, smallH);

    // Canvas tintado: color sólido + máscara alfa del PNG
    const tint = document.createElement('canvas');
    tint.width = smallW;
    tint.height = smallH;
    const tctx = tint.getContext('2d', { alpha: true });
    tctx.imageSmoothingEnabled = false;

    // Relleno con el color fijo
    tctx.clearRect(0, 0, smallW, smallH);
    tctx.fillStyle = fixedColor || '#000000';
    tctx.fillRect(0, 0, smallW, smallH);

    // Mantener solo la forma del logo (alfas del PNG)
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(small, 0, 0);
    tctx.globalCompositeOperation = 'source-over';

    offSmallRef.current = small;
    offTintRef.current = tint;
  };

  // Vuelve a preparar si cambia el color persistente
  useEffect(() => {
    prepareOffscreens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedColor, pixelCols]);
  
  // ...
}
