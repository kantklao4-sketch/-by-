/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { UploadIcon, CombineIcon, OverlayIcon, TopLeftIcon, TopRightIcon, BottomLeftIcon, BottomRightIcon, PencilIcon } from './icons';

export type Placement = 'blend' | 'overlay' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';

interface CombinePanelProps {
  onApplyCombine: (prompt: string) => void;
  isLoading: boolean;
  secondaryImage: File | null;
  onSecondaryImageUpload: (file: File) => void;
  onClearSecondaryImage: () => void;
  placement: Placement;
  setPlacement: (placement: Placement) => void;
}

const CombinePanel: React.FC<CombinePanelProps> = ({ 
  onApplyCombine, 
  isLoading, 
  secondaryImage, 
  onSecondaryImageUpload, 
  onClearSecondaryImage,
  placement,
  setPlacement
}) => {
  const [combinePrompt, setCombinePrompt] = useState('');
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);

  const placementOptions: { name: Placement; label: string; icon: React.FC<{className?: string}>; samplePrompt: string }[] = [
    { name: 'custom', label: 'กำหนดเอง', icon: PencilIcon, samplePrompt: '' },
    { name: 'blend', label: 'ผสาน', icon: CombineIcon, samplePrompt: 'Blend the style, colors, and mood of the second image onto the first image.' },
    { name: 'overlay', label: 'ซ้อนทับ', icon: OverlayIcon, samplePrompt: 'Overlay the second image on top of the first one with transparency.' },
    { name: 'top-left', label: 'บนซ้าย', icon: TopLeftIcon, samplePrompt: 'Place the second image as a small logo in the top left corner of the first image.' },
    { name: 'top-right', label: 'บนขวา', icon: TopRightIcon, samplePrompt: 'Place the second image as a small logo in the top right corner of the first image.' },
    { name: 'bottom-left', label: 'ล่างซ้าย', icon: BottomLeftIcon, samplePrompt: 'Place the second image as a small logo in the bottom left corner of the first image.' },
    { name: 'bottom-right', label: 'ล่างขวา', icon: BottomRightIcon, samplePrompt: 'Place the second image as a small logo in the bottom right corner of the first image.' },
  ];

  useEffect(() => {
    if (secondaryImage) {
      const url = URL.createObjectURL(secondaryImage);
      setSecondaryImageUrl(url);
    } else {
      setSecondaryImageUrl(null);
      // Reset to default when image is cleared
      setPlacement('blend');
      setCombinePrompt('');
    }
    return () => {
        if(secondaryImageUrl) URL.revokeObjectURL(secondaryImageUrl);
    }
  }, [secondaryImage]);

  const handlePlacementChange = (option: typeof placementOptions[0]) => {
      setPlacement(option.name);
      setCombinePrompt(option.samplePrompt);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onSecondaryImageUpload(e.target.files[0]);
    }
    e.target.value = ''; // Reset file input
  };

  const handleApply = () => {
    onApplyCombine(combinePrompt);
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">ผสานภาพ</h3>
      <p className="text-sm text-center text-gray-400 -mt-2">อัปโหลดภาพที่สองและอธิบายวิธีที่คุณต้องการรวมภาพทั้งสองเข้าด้วยกัน</p>
      
      <div className="w-full bg-gray-900/40 border border-gray-700/60 rounded-lg p-3">
        <h4 className="text-base font-semibold text-center text-gray-300 mb-3">ภาพที่สอง (สำหรับผสาน)</h4>
        {secondaryImageUrl ? (
          <div className="flex items-center gap-3 p-2 bg-white/5 rounded-md">
            <img src={secondaryImageUrl} alt="Secondary" className="w-14 h-14 object-cover rounded-md flex-shrink-0" />
            <div className="flex-grow overflow-hidden">
              <p className="text-sm font-medium text-gray-200 truncate">{secondaryImage?.name}</p>
              <p className="text-xs text-gray-400">{secondaryImage && `${(secondaryImage.size / 1024).toFixed(1)} KB`}</p>
            </div>
            <button
              onClick={onClearSecondaryImage}
              disabled={isLoading}
              className="text-sm font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
            >
              ลบ
            </button>
          </div>
        ) : (
          <label htmlFor="combine-image-upload" className="relative flex items-center justify-center w-full px-4 py-4 text-sm font-semibold text-gray-300 bg-white/5 rounded-md cursor-pointer group hover:bg-white/10 transition-colors border-2 border-dashed border-gray-600 hover:border-gray-500">
            <UploadIcon className="w-5 h-5 mr-2" />
            อัปโหลดภาพที่สอง
            <input id="combine-image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
          </label>
        )}
      </div>

      {secondaryImage && (
          <div className="w-full bg-gray-900/40 border border-gray-700/60 rounded-lg p-3 flex flex-col gap-2 animate-fade-in">
              <h4 className="text-base font-semibold text-center text-gray-300">โหมดการผสาน</h4>
              <div className="grid grid-cols-4 gap-2">
                  {placementOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                          <button
                              key={option.name}
                              onClick={() => handlePlacementChange(option)}
                              disabled={isLoading}
                              className={`flex flex-col items-center justify-center p-2 rounded-md transition-all duration-200 aspect-square ${placement === option.name ? 'bg-blue-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                              aria-label={option.label}
                          >
                              <Icon className="w-6 h-6 mb-1" />
                              <span className="text-xs font-semibold">{option.label}</span>
                          </button>
                      );
                  })}
              </div>
          </div>
      )}


      <input
          type="text"
          value={combinePrompt}
          onChange={(e) => setCombinePrompt(e.target.value)}
          placeholder="เลือกโหมดหรืออธิบายวิธีผสานภาพ..."
          className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
          disabled={isLoading || !secondaryImage}
      />

      <button
          onClick={handleApply}
          className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          disabled={isLoading || !secondaryImage || !combinePrompt.trim()}
      >
          ผสานภาพ
      </button>
    </div>
  );
};

export default CombinePanel;