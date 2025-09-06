/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateFaceSwapImage, generateMagicFillImage, generateCombinedImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import MagicFillPanel from './components/MagicFillPanel';
import CombinePanel, { type Placement } from './components/CombinePanel';
import FreestylePanel from './components/FreestylePanel';
import FaceSwapPanel from './components/FaceSwapPanel';
import { UndoIcon, RedoIcon, EyeIcon, UploadIcon, ResetIcon } from './components/icons';
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

// New Error Formatting Helper
const formatErrorMessage = (error: unknown, context: string): string => {
  const defaultMessage = `เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่าง${context} กรุณาลองใหม่อีกครั้ง`;

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Safety/Blocking errors
    if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
      return `คำขอ${context}ของคุณถูกบล็อกเนื่องจากนโยบายความปลอดภัย กรุณาปรับเปลี่ยนคำสั่ง (เช่น หลีกเลี่ยงเนื้อหาที่ไม่เหมาะสม) แล้วลองใหม่อีกครั้ง`;
    }
    
    // Model didn't return an image
    if (errorMessage.includes('did not return an image')) {
      return `AI ไม่สามารถสร้างผลลัพธ์สำหรับ${context}ได้ อาจเป็นเพราะคำสั่งซับซ้อนเกินไปหรือไม่ชัดเจน กรุณาลองใช้คำสั่งที่ง่ายและตรงไปตรงมามากขึ้น`;
    }

    // Return the specific error from the service, but with a user-friendly prefix.
    return `${context}ล้มเหลว: ${error.message}`;
  }
  
  return defaultMessage;
};


type Tab = 'retouch' | 'magicfill' | 'freestyle' | 'combine' | 'faceswap' | 'adjust' | 'filters' | 'crop';

const tabDisplayNames: Record<Tab, string> = {
  retouch: 'รีทัช',
  magicfill: 'เติมภาพ',
  freestyle: 'จินตนาการ',
  combine: 'ผสานภาพ',
  faceswap: 'สลับใบหน้า',
  adjust: 'ปรับแต่ง',
  filters: 'ฟิลเตอร์',
  crop: 'ตัดภาพ',
};

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
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
  const [magicFillBrushSize, setMagicFillBrushSize] = useState<number>(30);
  const [isMagicFillErasing, setIsMagicFillErasing] = useState<boolean>(false);
  const [isMagicFillMaskDrawn, setIsMagicFillMaskDrawn] = useState<boolean>(false);
  const magicFillMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const magicFillIsDrawingRef = useRef(false);
  const magicFillMaskHistoryRef = useRef<ImageData[]>([]);
  const [canUndoMagicFillMask, setCanUndoMagicFillMask] = useState<boolean>(false);

  // State for Freestyle Protection Mask
  const [freestyleBrushSize, setFreestyleBrushSize] = useState<number>(30);
  const [isFreestyleErasing, setIsFreestyleErasing] = useState<boolean>(false);
  const [isFreestyleMaskDrawn, setIsFreestyleMaskDrawn] = useState<boolean>(false);
  const freestyleMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const freestyleIsDrawingRef = useRef(false);
  const freestyleMaskHistoryRef = useRef<ImageData[]>([]);
  const [canUndoFreestyleMask, setCanUndoFreestyleMask] = useState<boolean>(false);


  // State for Combine placement guide
  const [combinePlacement, setCombinePlacement] = useState<Placement>('blend');

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

  // Effect to resize mask canvases to match image display size
  useEffect(() => {
      const resizeCanvases = () => {
          if (imgRef.current) {
              const { width, height } = imgRef.current.getBoundingClientRect();
              if (magicFillMaskCanvasRef.current) {
                  magicFillMaskCanvasRef.current.width = width;
                  magicFillMaskCanvasRef.current.height = height;
              }
              if (freestyleMaskCanvasRef.current) {
                  freestyleMaskCanvasRef.current.width = width;
                  freestyleMaskCanvasRef.current.height = height;
              }
          }
      };
      resizeCanvases();
      window.addEventListener('resize', resizeCanvases);
      return () => window.removeEventListener('resize', resizeCanvases);
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
    setCombinePlacement('blend');
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
    setCombinePlacement('blend');
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

    setLoadingMessage('AI กำลังรีทัชภาพ...');
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        setError(formatErrorMessage(err, 'การรีทัช'));
        console.error(err);
    } finally {
        setLoadingMessage(null);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('ยังไม่ได้โหลดรูปภาพเพื่อใช้ฟิลเตอร์');
      return;
    }
    
    setLoadingMessage('AI กำลังใช้ฟิลเตอร์...');
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        setError(formatErrorMessage(err, 'การใช้ฟิลเตอร์'));
        console.error(err);
    } finally {
        setLoadingMessage(null);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('ยังไม่ได้โหลดรูปภาพเพื่อปรับแต่ง');
      return;
    }
    
    setLoadingMessage('AI กำลังปรับแต่งภาพ...');
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt, secondaryImage);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        setError(formatErrorMessage(err, 'การปรับแต่ง'));
        console.error(err);
    } finally {
        setLoadingMessage(null);
    }
  }, [currentImage, addImageToHistory, secondaryImage]);

  const handleApplyFaceSwap = useCallback(async () => {
    if (!currentImage || !secondaryImage) {
      setError('กรุณาอัปโหลดทั้งภาพต้นฉบับและภาพเป้าหมายเพื่อทำการสลับใบหน้า');
      return;
    }

    setLoadingMessage('AI กำลังสลับใบหน้า...');
    setError(null);

    try {
      const swappedImageUrl = await generateFaceSwapImage(currentImage, secondaryImage);
      const newImageFile = dataURLtoFile(swappedImageUrl, `faceswap-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    } catch (err) {
      setError(formatErrorMessage(err, 'การสลับใบหน้า'));
      console.error(err);
    } finally {
      setLoadingMessage(null);
    }
  }, [currentImage, secondaryImage, addImageToHistory]);

  const handleApplyCombine = useCallback(async (combinePrompt: string) => {
    if (!currentImage || !secondaryImage) {
      setError('กรุณาอัปโหลดภาพทั้งสองภาพเพื่อทำการผสาน');
      return;
    }

    if (!combinePrompt.trim()) {
        setError('กรุณาอธิบายวิธีที่คุณต้องการผสานภาพ');
        return;
    }

    setLoadingMessage('AI กำลังผสานภาพ...');
    setError(null);

    try {
      const combinedImageUrl = await generateCombinedImage(currentImage, secondaryImage, combinePrompt);
      const newImageFile = dataURLtoFile(combinedImageUrl, `combined-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    } catch (err) {
      setError(formatErrorMessage(err, 'การผสานภาพ'));
      console.error(err);
    } finally {
      setLoadingMessage(null);
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
      setCombinePlacement('blend');
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setSecondaryImage(null);
      setCombinePlacement('blend');
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setSecondaryImage(null);
      setCombinePlacement('blend');
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
      setCombinePlacement('blend');
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
    if(activeTab !== 'combine') {
      setCombinePlacement('blend');
    }
  }, [activeTab]);
  
  const handleClearSecondaryImage = useCallback(() => {
      setSecondaryImage(null);
      setCombinePlacement('blend');
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
  
  // --- Mask Drawing Logic ---
  const getCoords = (e: React.MouseEvent | React.TouchEvent): {x: number, y: number} | null => {
    const canvasRef = activeTab === 'magicfill' ? magicFillMaskCanvasRef : freestyleMaskCanvasRef;
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
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
      if (loadingMessage || (activeTab !== 'magicfill' && activeTab !== 'freestyle')) return;
      
      const canvasRef = activeTab === 'magicfill' ? magicFillMaskCanvasRef : freestyleMaskCanvasRef;
      const historyRef = activeTab === 'magicfill' ? magicFillMaskHistoryRef : freestyleMaskHistoryRef;
      const setCanUndo = activeTab === 'magicfill' ? setCanUndoMagicFillMask : setCanUndoFreestyleMask;
      const isDrawingRef = activeTab === 'magicfill' ? magicFillIsDrawingRef : freestyleIsDrawingRef;

      const coords = getCoords(e);
      if (!coords || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      historyRef.current.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
      setCanUndo(true);

      isDrawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      const canvasRef = activeTab === 'magicfill' ? magicFillMaskCanvasRef : freestyleMaskCanvasRef;
      const isDrawingRef = activeTab === 'magicfill' ? magicFillIsDrawingRef : freestyleIsDrawingRef;
      
      if (!isDrawingRef.current || !canvasRef.current) return;
      const coords = getCoords(e);
      if (!coords) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const brushSize = activeTab === 'magicfill' ? magicFillBrushSize : freestyleBrushSize;
      const isErasing = activeTab === 'magicfill' ? isMagicFillErasing : isFreestyleErasing;

      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isErasing) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
          ctx.globalCompositeOperation = 'source-over';
          // Magic Fill: semi-transparent blue for filling area
          // Freestyle: semi-transparent gold for protection area
          ctx.strokeStyle = activeTab === 'magicfill' ? 'rgba(74, 144, 226, 0.6)' : 'rgba(234, 179, 8, 0.6)';
      }

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
  };

  const stopDrawing = () => {
      const canvasRef = activeTab === 'magicfill' ? magicFillMaskCanvasRef : freestyleMaskCanvasRef;
      const isDrawingRef = activeTab === 'magicfill' ? magicFillIsDrawingRef : freestyleIsDrawingRef;
      const setIsMaskDrawn = activeTab === 'magicfill' ? setIsMagicFillMaskDrawn : setIsFreestyleMaskDrawn;

      if (!isDrawingRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if(ctx) ctx.closePath();
      isDrawingRef.current = false;
      
      const imageData = ctx?.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const hasDrawing = imageData?.data.some(channel => channel !== 0);
      setIsMaskDrawn(!!hasDrawing);
  };

  const clearMask = useCallback(() => {
    const canvasRef = activeTab === 'magicfill' ? magicFillMaskCanvasRef : freestyleMaskCanvasRef;
    const historyRef = activeTab === 'magicfill' ? magicFillMaskHistoryRef : freestyleMaskHistoryRef;
    const setCanUndo = activeTab === 'magicfill' ? setCanUndoMagicFillMask : setCanUndoFreestyleMask;
    const setIsMaskDrawn = activeTab === 'magicfill' ? setIsMagicFillMaskDrawn : setIsFreestyleMaskDrawn;

    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            setIsMaskDrawn(false);
            historyRef.current = [];
            setCanUndo(false);
        }
    }
  }, [activeTab]);

  const undoMaskStroke = useCallback(() => {
    const canvasRef = activeTab === 'magicfill' ? magicFillMaskCanvasRef : freestyleMaskCanvasRef;
    const historyRef = activeTab === 'magicfill' ? magicFillMaskHistoryRef : freestyleMaskHistoryRef;
    const setCanUndo = activeTab === 'magicfill' ? setCanUndoMagicFillMask : setCanUndoFreestyleMask;
    const setIsMaskDrawn = activeTab === 'magicfill' ? setIsMagicFillMaskDrawn : setIsFreestyleMaskDrawn;

    if (historyRef.current.length > 0 && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const lastState = historyRef.current.pop();
        if (ctx && lastState) {
            ctx.putImageData(lastState, 0, 0);
        }
        setCanUndo(historyRef.current.length > 0);
        const hasDrawing = lastState?.data.some(c => c !== 0);
        setIsMaskDrawn(!!hasDrawing);
    }
  }, [activeTab]);

  const handleApplyMagicFill = useCallback(async () => {
      if (!currentImage || !magicFillMaskCanvasRef.current || !isMagicFillMaskDrawn) {
          setError('กรุณาระบายสีบนพื้นที่ที่ต้องการแก้ไขก่อน');
          return;
      }
      
      const image = imgRef.current;
      const sourceCanvas = magicFillMaskCanvasRef.current;
      if (!image) return;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = image.naturalWidth;
      maskCanvas.height = image.naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');

      if (!maskCtx) {
          setError('ไม่สามารถสร้างมาสก์สำหรับแก้ไขได้');
          return;
      }
      
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
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
          if (data[i + 3] > 0) {
              data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
          }
      }
      tempCtx.putImageData(imageData, 0, 0);
      maskCtx.drawImage(tempMaskCanvas, 0, 0, maskCanvas.width, maskCanvas.height);


      setLoadingMessage('AI กำลังเติมภาพ...');
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
          setError(formatErrorMessage(err, 'การเติมภาพ'));
          console.error(err);
      } finally {
          setLoadingMessage(null);
      }
  }, [currentImage, magicFillPrompt, addImageToHistory, isMagicFillMaskDrawn, clearMask]);


  const handleApplyFreestyle = useCallback(async (freestylePrompt: string) => {
    if (!currentImage) {
      setError('ยังไม่ได้โหลดรูปภาพเพื่อแก้ไข');
      return;
    }

    setLoadingMessage('AI กำลังสร้างสรรค์ตามจินตนาการ...');
    setError(null);

    try {
      let finalImageUrl: string;
      if (isFreestyleMaskDrawn && freestyleMaskCanvasRef.current && imgRef.current) {
        // --- INPAINTING LOGIC (with inverted mask) ---
        const image = imgRef.current;
        const sourceCanvas = freestyleMaskCanvasRef.current;
        
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = image.naturalWidth;
        maskCanvas.height = image.naturalHeight;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) throw new Error('Could not create mask context.');

        // Start with a WHITE background (areas to be changed)
        maskCtx.fillStyle = 'white';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

        // Draw the user's protection mask (which will become BLACK)
        maskCtx.globalCompositeOperation = 'source-over';
        const tempMaskCanvas = document.createElement('canvas');
        tempMaskCanvas.width = sourceCanvas.width;
        tempMaskCanvas.height = sourceCanvas.height;
        const tempCtx = tempMaskCanvas.getContext('2d', { willReadFrequently: true });
        if(!tempCtx) throw new Error('Could not create temp mask context.');

        tempCtx.drawImage(sourceCanvas, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, tempMaskCanvas.width, tempMaskCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // If pixel is not transparent (i.e., user painted here)
            data[i] = 0;     // R = black
            data[i + 1] = 0; // G = black
            data[i + 2] = 0; // B = black
            data[i + 3] = 255; // A = opaque
          }
        }
        tempCtx.putImageData(imageData, 0, 0);
        maskCtx.drawImage(tempMaskCanvas, 0, 0, maskCanvas.width, maskCanvas.height);
        
        const maskDataUrl = maskCanvas.toDataURL('image/png');
        const maskFile = dataURLtoFile(maskDataUrl, 'freestyle_mask.png');
        
        // Use the magic fill service, as it's designed for inpainting
        finalImageUrl = await generateMagicFillImage(currentImage, maskFile, freestylePrompt);

      } else {
        // --- STANDARD FULL IMAGE EDIT ---
        finalImageUrl = await generateAdjustedImage(currentImage, freestylePrompt, null);
      }
      
      const newImageFile = dataURLtoFile(finalImageUrl, `freestyle-${Date.now()}.png`);
      addImageToHistory(newImageFile);
      clearMask();

    } catch (err) {
      setError(formatErrorMessage(err, 'การแก้ไขตามจินตนาการ'));
      console.error(err);
    } finally {
      setLoadingMessage(null);
    }
  }, [currentImage, addImageToHistory, isFreestyleMaskDrawn, clearMask]);


  const getCombineOverlayClass = (placement: Placement): string => {
    const baseClasses = "absolute z-20 pointer-events-none transition-all duration-300 ease-in-out border-2 border-dashed border-blue-400 bg-black/30 rounded-lg p-1 shadow-lg";
    switch (placement) {
      case 'overlay':
        return `${baseClasses} inset-4`;
      case 'top-left':
        return `${baseClasses} top-4 left-4 w-1/3 max-w-[150px] h-auto`;
      case 'top-right':
        return `${baseClasses} top-4 right-4 w-1/3 max-w-[150px] h-auto`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4 w-1/3 max-w-[150px] h-auto`;
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4 w-1/3 max-w-[150px] h-auto`;
      default:
        return 'hidden';
    }
  };


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
            {loadingMessage && (
                <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <Spinner />
                    <p className="text-gray-300">{loadingMessage}</p>
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
            
            {activeTab === 'magicfill' && !loadingMessage && (
              <canvas
                ref={magicFillMaskCanvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                onTouchEnd={(e) => { e.preventDefault(); stopDrawing(); }}
                className={`absolute top-0 left-0 w-full h-full z-20 ${isMagicFillErasing ? 'cursor-[url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' fill=\'white\' viewBox=\'0 0 24 24\' width=\'24px\' height=\'24px\'><path d=\'M0 0h24v24H0z\' fill=\'none\'/><path d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.3 14.3c-.39.39-1.02.39-1.41 0L12 13.41l-2.89 2.89c-.39.39-1.02.39-1.41 0a.9959.9959 0 0 1 0-1.41L10.59 12 7.7 9.11a.9959.9959 0 0 1 0-1.41c.39-.39 1.02-.39 1.41 0L12 10.59l2.89-2.89c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L13.41 12l2.89 2.89c.38.39.38 1.03 0 1.41z\'/></svg>"),_auto]' : 'cursor-crosshair'}`}
              />
            )}

            {activeTab === 'freestyle' && !loadingMessage && (
              <canvas
                ref={freestyleMaskCanvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                onTouchEnd={(e) => { e.preventDefault(); stopDrawing(); }}
                className={`absolute top-0 left-0 w-full h-full z-20 ${isFreestyleErasing ? 'cursor-[url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' fill=\'white\' viewBox=\'0 0 24 24\' width=\'24px\' height=\'24px\'><path d=\'M0 0h24v24H0z\' fill=\'none\'/><path d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.3 14.3c-.39.39-1.02.39-1.41 0L12 13.41l-2.89 2.89c-.39.39-1.02.39-1.41 0a.9959.9959 0 0 1 0-1.41L10.59 12 7.7 9.11a.9959.9959 0 0 1 0-1.41c.39-.39 1.02-.39 1.41 0L12 10.59l2.89-2.89c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L13.41 12l2.89 2.89c.38.39.38 1.03 0 1.41z\'/></svg>"),_auto]' : 'cursor-crosshair'}`}
              />
            )}
            
            {/* Face Swap Source Indicator */}
            {activeTab === 'faceswap' && !loadingMessage && (
              <div className="absolute inset-0 z-10 pointer-events-none border-4 border-dashed border-green-400 rounded-xl flex items-start justify-center animate-fade-in">
                <span className="bg-green-500 text-white font-bold text-sm px-3 py-1 rounded-b-lg shadow-lg">
                  ใบหน้าต้นฉบับ
                </span>
              </div>
            )}

            {displayHotspot && !loadingMessage && activeTab === 'retouch' && (
                <div 
                    className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
                >
                    <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
                </div>
            )}

            {/* Visual Guide for Combine Images */}
            {activeTab === 'combine' && secondaryImageUrl && combinePlacement !== 'blend' && !loadingMessage && (
              <div className={getCombineOverlayClass(combinePlacement)}>
                  <img 
                      src={secondaryImageUrl} 
                      alt="Combine Preview" 
                      className="w-full h-full object-contain opacity-70"
                  />
              </div>
            )}
        </div>
        
        <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-2 backdrop-blur-sm">
            {(['retouch', 'magicfill', 'freestyle', 'combine', 'faceswap', 'adjust', 'filters', 'crop'] as Tab[]).map(tab => (
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
                            disabled={!!loadingMessage || !editHotspot}
                        />
                        <button 
                            type="submit"
                            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                            disabled={!!loadingMessage || !prompt.trim() || !editHotspot}
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
                  isLoading={!!loadingMessage}
                  isMaskDrawn={isMagicFillMaskDrawn}
                  brushSize={magicFillBrushSize}
                  setBrushSize={setMagicFillBrushSize}
                  isErasing={isMagicFillErasing}
                  setIsErasing={setIsMagicFillErasing}
                  onUndo={undoMaskStroke}
                  onClear={clearMask}
                  canUndoMask={canUndoMagicFillMask}
                />
            )}
            {activeTab === 'freestyle' && (
              <FreestylePanel 
                onApplyFreestyle={handleApplyFreestyle} 
                isLoading={!!loadingMessage}
                brushSize={freestyleBrushSize}
                setBrushSize={setFreestyleBrushSize}
                isErasing={isFreestyleErasing}
                setIsErasing={setIsFreestyleErasing}
                isMaskDrawn={isFreestyleMaskDrawn}
                onUndo={undoMaskStroke}
                onClear={clearMask}
                canUndoMask={canUndoFreestyleMask}
              />
            )}
            {activeTab === 'faceswap' && (
              <FaceSwapPanel
                onApplyFaceSwap={handleApplyFaceSwap}
                isLoading={!!loadingMessage}
                secondaryImage={secondaryImage}
                onSecondaryImageUpload={handleSecondaryImageUpload}
                onClearSecondaryImage={handleClearSecondaryImage}
              />
            )}
            {activeTab === 'combine' && <CombinePanel onApplyCombine={handleApplyCombine} isLoading={!!loadingMessage} secondaryImage={secondaryImage} onSecondaryImageUpload={handleSecondaryImageUpload} onClearSecondaryImage={handleClearSecondaryImage} placement={combinePlacement} setPlacement={setCombinePlacement} />}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={!!loadingMessage} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={!!loadingMessage} secondaryImage={secondaryImage} onSecondaryImageUpload={handleSecondaryImageUpload} onClearSecondaryImage={handleClearSecondaryImage} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={!!loadingMessage} />}
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
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="รีเซ็ตการแก้ไขทั้งหมดกลับไปเป็นภาพต้นฉบับ"
            >
                <ResetIcon className="w-5 h-5 mr-2" />
                รีเซ็ต
            </button>
            
             <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>

            <button 
                onClick={handleUploadNew}
                className="flex items-center justify-center text-center bg-blue-600/20 border border-blue-500/30 text-blue-300 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-blue-600/40 hover:border-blue-500/50 hover:text-blue-200 active:scale-95 text-base"
                aria-label="อัปโหลดภาพใหม่"
            >
                <UploadIcon className="w-5 h-5 mr-2" />
                อัปโหลดใหม่
            </button>
        </div>
      </div>
    );
  };
  
  // FIX: Added a return statement for the App component to render the UI.
  return (
    <div className="bg-gradient-to-b from-[#111827] to-[#1a202c] text-white min-h-screen font-sans">
      <Header />
      <main className="container mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-68px)]">
        {renderContent()}
      </main>
    </div>
  );
};

// FIX: Added a default export for the App component.
export default App;