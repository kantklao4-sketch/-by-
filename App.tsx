/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateFaceSwapImage, generateMagicFillImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import MagicFillPanel from './components/MagicFillPanel';
import { UndoIcon, RedoIcon, EyeIcon, UploadIcon } from './components/icons';
import StartScreen from './components/StartScreen';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'magicfill' | 'faceswap' | 'adjust' | 'filters' | 'crop';

const tabDisplayNames: Record<Tab, string> = {
  retouch: 'รีทัช',
  magicfill: 'เติมภาพ',
  faceswap: 'สลับใบหน้า',
  adjust: 'ปรับแต่ง',
  filters: 'ฟิลเตอร์',
  crop: 'ตัดภาพ',
};

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  const [secondaryImage, setSecondaryImage] = useState<File | null>(null);
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // State for Magic Fill
  const [magicFillPrompt, setMagicFillPrompt] = useState<string>('');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [isErasing, setIsErasing] = useState<boolean>(false);
  const [isMaskDrawn, setIsMaskDrawn] = useState<boolean>(false);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const maskHistoryRef = useRef<ImageData[]>([]);
  const [canUndoMask, setCanUndoMask] = useState<boolean>(false);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);


  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);

  // Effect to create and revoke object URLs safely for the secondary image
  useEffect(() => {
    if (secondaryImage) {
        const url = URL.createObjectURL(secondaryImage);
        setSecondaryImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }
    setSecondaryImageUrl(null);
  }, [secondaryImage]);

  // Effect to resize mask canvas to match image display size
  useEffect(() => {
      const resizeCanvas = () => {
          if (imgRef.current && maskCanvasRef.current) {
              const { width, height } = imgRef.current.getBoundingClientRect();
              maskCanvasRef.current.width = width;
              maskCanvasRef.current.height = height;
          }
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
  }, [currentImageUrl, activeTab]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSecondaryImage(null);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSecondaryImage(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('ยังไม่ได้โหลดรูปภาพเพื่อแก้ไข');
      return;
    }
    
    if (!prompt.trim()) {
        setError('กรุณาใส่คำอธิบายการแก้ไขของคุณ');
        return;
    }

    if (!editHotspot) {
        setError('กรุณาคลิกบนภาพเพื่อเลือกพื้นที่ที่ต้องการแก้ไข');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`สร้างรูปภาพไม่สำเร็จ ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('ยังไม่ได้โหลดรูปภาพเพื่อใช้ฟิลเตอร์');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`ใช้ฟิลเตอร์ไม่สำเร็จ ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('ยังไม่ได้โหลดรูปภาพเพื่อปรับแต่ง');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt, secondaryImage);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`ปรับแต่งไม่สำเร็จ ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, secondaryImage]);

  const handleApplyFaceSwap = useCallback(async () => {
    if (!currentImage || !secondaryImage) {
      setError('กรุณาอัปโหลดทั้งภาพต้นฉบับและภาพเป้าหมายเพื่อทำการสลับใบหน้า');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const swappedImageUrl = await generateFaceSwapImage(currentImage, secondaryImage);
      const newImageFile = dataURLtoFile(swappedImageUrl, `faceswap-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`สลับใบหน้าไม่สำเร็จ ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, secondaryImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('กรุณาเลือกพื้นที่ที่จะตัด');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('ไม่สามารถประมวลผลการตัดภาพได้');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setSecondaryImage(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setSecondaryImage(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setSecondaryImage(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setSecondaryImage(null);
  }, []);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };
  
  const handleSecondaryImageUpload = useCallback((file: File) => {
    setSecondaryImage(file);
  }, []);
  
  const handleSecondaryImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleSecondaryImageUpload(e.target.files[0]);
    }
    e.target.value = ''; // Reset file input
  };

  const handleClearSecondaryImage = useCallback(() => {
      setSecondaryImage(null);
  }, []);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
  };
  
    // --- Magic Fill Drawing Logic ---
  const getCoords = (e: React.MouseEvent | React.TouchEvent): {x: number, y: number} | null => {
    if (!maskCanvasRef.current) return null;
    const canvas = maskCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e.nativeEvent) {
        clientX = e.nativeEvent.touches[0].clientX;
        clientY = e.nativeEvent.touches[0].clientY;
    } else {
        clientX = e.nativeEvent.clientX;
        clientY = e.nativeEvent.clientY;
    }
    return {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (isLoading || activeTab !== 'magicfill') return;
      const coords = getCoords(e);
      if (!coords || !maskCanvasRef.current) return;

      const ctx = maskCanvasRef.current.getContext('2d');
      if (!ctx) return;
      
      // Save state for undo
      maskHistoryRef.current.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
      setCanUndoMask(true);

      isDrawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current || !maskCanvasRef.current) return;
      const coords = getCoords(e);
      if (!coords) return;
      
      const ctx = maskCanvasRef.current.getContext('2d');
      if (!ctx) return;
      
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isErasing) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)'; // Semi-transparent blue
      }

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
  };

  const stopDrawing = () => {
      if (!isDrawingRef.current || !maskCanvasRef.current) return;
      const ctx = maskCanvasRef.current.getContext('2d');
      if(ctx) ctx.closePath();
      isDrawingRef.current = false;
      
      // Check if anything is drawn to enable the button
      const imageData = ctx?.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const hasDrawing = imageData?.data.some(channel => channel !== 0);
      setIsMaskDrawn(!!hasDrawing);
  };

  const clearMask = useCallback(() => {
    if (maskCanvasRef.current) {
        const ctx = maskCanvasRef.current.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            setIsMaskDrawn(false);
            maskHistoryRef.current = [];
            setCanUndoMask(false);
        }
    }
  }, []);

  const undoMaskStroke = useCallback(() => {
    if (maskHistoryRef.current.length > 0 && maskCanvasRef.current) {
        const ctx = maskCanvasRef.current.getContext('2d');
        const lastState = maskHistoryRef.current.pop();
        if (ctx && lastState) {
            ctx.putImageData(lastState, 0, 0);
        }
        setCanUndoMask(maskHistoryRef.current.length > 0);
        // Check if mask is still drawn after undo
        const hasDrawing = lastState?.data.some(c => c !== 0);
        setIsMaskDrawn(!!hasDrawing);
    }
  }, []);

  const handleApplyMagicFill = useCallback(async () => {
      if (!currentImage || !maskCanvasRef.current || !isMaskDrawn) {
          setError('กรุณาระบายสีบนพื้นที่ที่ต้องการแก้ไขก่อน');
          return;
      }
      
      const image = imgRef.current;
      const sourceCanvas = maskCanvasRef.current;
      if (!image) return;

      // Create a new canvas to generate the black and white mask AT THE ORIGINAL IMAGE RESOLUTION
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = image.naturalWidth;
      maskCanvas.height = image.naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');

      if (!maskCtx) {
          setError('ไม่สามารถสร้างมาสก์สำหรับแก้ไขได้');
          return;
      }
      
      // Black background
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Draw the user's strokes (from the display-sized canvas) onto the full-res mask, and make them white
      maskCtx.globalCompositeOperation = 'source-over';
      const tempMaskCanvas = document.createElement('canvas');
      tempMaskCanvas.width = sourceCanvas.width;
      tempMaskCanvas.height = sourceCanvas.height;
      const tempCtx = tempMaskCanvas.getContext('2d', { willReadFrequently: true });
      if(!tempCtx) return;

      tempCtx.drawImage(sourceCanvas, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, tempMaskCanvas.width, tempMaskCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // If pixel is not transparent
              data[i] = 255;     // R = white
              data[i + 1] = 255; // G = white
              data[i + 2] = 255; // B = white
              data[i + 3] = 255; // A = opaque
          }
      }
      tempCtx.putImageData(imageData, 0, 0);
      maskCtx.drawImage(tempMaskCanvas, 0, 0, maskCanvas.width, maskCanvas.height);


      setIsLoading(true);
      setError(null);

      try {
          const maskDataUrl = maskCanvas.toDataURL('image/png');
          const maskFile = dataURLtoFile(maskDataUrl, 'mask.png');
          
          const filledImageUrl = await generateMagicFillImage(currentImage, maskFile, magicFillPrompt);
          const newImageFile = dataURLtoFile(filledImageUrl, `magicfill-${Date.now()}.png`);
          addImageToHistory(newImageFile);
          
          clearMask();
          setMagicFillPrompt('');
          
      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
          setError(`การเติมภาพไม่สำเร็จ: ${errorMessage}`);
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  }, [currentImage, magicFillPrompt, addImageToHistory, isMaskDrawn, clearMask]);


  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">เกิดข้อผิดพลาด</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                ลองอีกครั้ง
            </button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} />;
    }

    const imageDisplay = (
      <div className="relative">
        {/* Base image is the original, always at the bottom */}
        {originalImageUrl && (
            <img
                key={originalImageUrl}
                src={originalImageUrl}
                alt="Original"
                className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
            />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        <img
            ref={imgRef}
            key={currentImageUrl}
            src={currentImageUrl}
            alt="Current"
            onClick={handleImageClick}
            className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );
    
    // For ReactCrop, we need a single image element. We'll use the current one.
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl} 
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
      />
    );


    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20">
            {isLoading && (
                <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <Spinner />
                    <p className="text-gray-300">AI กำลังใช้เวทมนตร์...</p>
                </div>
            )}
            
            {activeTab === 'crop' ? (
              <ReactCrop 
                crop={crop} 
                onChange={c => setCrop(c)} 
                onComplete={c => setCompletedCrop(c)}
                aspect={aspect}
                className="max-h-[60vh]"
              >
                {cropImageElement}
              </ReactCrop>
            ) : imageDisplay }
            
            {activeTab === 'magicfill' && !isLoading && (
              <canvas
                ref={maskCanvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                onTouchEnd={(e) => { e.preventDefault(); stopDrawing(); }}
                className={`absolute top-0 left-0 w-full h-full z-20 ${isErasing ? 'cursor-[url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' fill=\'white\' viewBox=\'0 0 24 24\' width=\'24px\' height=\'24px\'><path d=\'M0 0h24v24H0z\' fill=\'none\'/><path d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.3 14.3c-.39.39-1.02.39-1.41 0L12 13.41l-2.89 2.89c-.39.39-1.02.39-1.41 0a.9959.9959 0 0 1 0-1.41L10.59 12 7.7 9.11a.9959.9959 0 0 1 0-1.41c.39-.39 1.02-.39 1.41 0L12 10.59l2.89-2.89c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L13.41 12l2.89 2.89c.38.39.38 1.03 0 1.41z\'/></svg>"),_auto]' : 'cursor-crosshair'}`}
              />
            )}

            {displayHotspot && !isLoading && activeTab === 'retouch' && (
                <div 
                    className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
                >
                    <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
                </div>
            )}
        </div>
        
        <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-2 backdrop-blur-sm">
            {(['retouch', 'magicfill', 'faceswap', 'adjust', 'filters', 'crop'] as Tab[]).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base ${
                        activeTab === tab 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    {tabDisplayNames[tab]}
                </button>
            ))}
        </div>
        
        <div className="w-full">
            {activeTab === 'retouch' && (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-md text-gray-400">
                        {editHotspot ? 'เยี่ยม! ตอนนี้อธิบายการแก้ไขของคุณด้านล่าง' : 'คลิกบริเวณที่ต้องการบนภาพเพื่อแก้ไขอย่างแม่นยำ'}
                    </p>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={editHotspot ? "เช่น 'เปลี่ยนสีเสื้อเป็นสีน้ำเงิน'" : "กรุณาคลิกบนภาพก่อน"}
                            className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isLoading || !editHotspot}
                        />
                        <button 
                            type="submit"
                            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                            disabled={isLoading || !prompt.trim() || !editHotspot}
                        >
                            สร้าง
                        </button>
                    </form>
                </div>
            )}
            {activeTab === 'magicfill' && (
                <MagicFillPanel 
                  prompt={magicFillPrompt}
                  setPrompt={setMagicFillPrompt}
                  onApply={handleApplyMagicFill}
                  isLoading={isLoading}
                  isMaskDrawn={isMaskDrawn}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  isErasing={isErasing}
                  setIsErasing={setIsErasing}
                  onUndo={undoMaskStroke}
                  onClear={clearMask}
                  canUndoMask={canUndoMask}
                />
            )}
            {activeTab === 'faceswap' && (
                <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-center text-gray-300">สลับใบหน้า</h3>
                    <p className="text-sm text-center text-gray-400 -mt-2">ภาพปัจจุบันคือ 'ภาพต้นฉบับ' กรุณาอัปโหลด 'ภาพเป้าหมาย' ด้านล่าง</p>
                    <div className="w-full bg-gray-900/40 border border-gray-700/60 rounded-lg p-3">
                        <h4 className="text-base font-semibold text-center text-gray-300 mb-3">ภาพเป้าหมาย (ภาพที่จะนำหน้าไปใส่)</h4>
                        {secondaryImageUrl ? (
                        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-md">
                            <img src={secondaryImageUrl} alt="Target" className="w-14 h-14 object-cover rounded-md flex-shrink-0" />
                            <div className="flex-grow overflow-hidden">
                            <p className="text-sm font-medium text-gray-200 truncate">{secondaryImage?.name}</p>
                            <p className="text-xs text-gray-400">{secondaryImage && `${(secondaryImage.size / 1024).toFixed(1)} KB`}</p>
                            </div>
                            <button
                            onClick={handleClearSecondaryImage}
                            disabled={isLoading}
                            className="text-sm font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                            >
                            ลบ
                            </button>
                        </div>
                        ) : (
                        <label htmlFor="target-image-upload" className="relative flex items-center justify-center w-full px-4 py-4 text-sm font-semibold text-gray-300 bg-white/5 rounded-md cursor-pointer group hover:bg-white/10 transition-colors border-2 border-dashed border-gray-600 hover:border-gray-500">
                            <UploadIcon className="w-5 h-5 mr-2" />
                            อัปโหลดภาพเป้าหมาย
                            <input id="target-image-upload" type="file" className="hidden" accept="image/*" onChange={handleSecondaryImageChange} disabled={isLoading} />
                        </label>
                        )}
                    </div>
                    <button
                        onClick={handleApplyFaceSwap}
                        className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                        disabled={isLoading || !currentImage || !secondaryImage}
                    >
                        สลับใบหน้า
                    </button>
                </div>
            )}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} secondaryImage={secondaryImage} onSecondaryImageUpload={handleSecondaryImageUpload} onClearSecondaryImage={handleClearSecondaryImage} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button 
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="ย้อนกลับการกระทำล่าสุด"
            >
                <UndoIcon className="w-5 h-5 mr-2" />
                ย้อนกลับ
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="ทำซ้ำการกระทำล่าสุด"
            >
                <RedoIcon className="w-5 h-5 mr-2" />
                ทำซ้ำ
            </button>
            
            <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>

            {canUndo && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                  aria-label="กดค้างไว้เพื่อดูภาพต้นฉบับ"
              >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  เปรียบเทียบ
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={!canUndo}
                className="text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
              >
                รีเซ็ต
            </button>
            <button 
                onClick={handleUploadNew}
                className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
            >
                อัปโหลดใหม่
            </button>

            <button 
                onClick={handleDownload}
                className="flex-grow sm:flex-grow-0 ml-auto bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
            >
                ดาวน์โหลดรูปภาพ
            </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${currentImage ? 'items-start' : 'items-center'}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;