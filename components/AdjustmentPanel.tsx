/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { UploadIcon } from './icons';

interface AdjustmentPanelProps {
  onApplyAdjustment: (prompt: string) => void;
  isLoading: boolean;
  secondaryImage: File | null;
  onSecondaryImageUpload: (file: File) => void;
  onClearSecondaryImage: () => void;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ onApplyAdjustment, isLoading, secondaryImage, onSecondaryImageUpload, onClearSecondaryImage }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (secondaryImage) {
      const url = URL.createObjectURL(secondaryImage);
      setSecondaryImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setSecondaryImageUrl(null);
  }, [secondaryImage]);


  const presets = [
    { name: 'เบลอพื้นหลัง', prompt: 'Apply a realistic depth-of-field effect, making the background blurry while keeping the main subject in sharp focus.' },
    { name: 'เพิ่มความคมชัด', prompt: 'Slightly enhance the sharpness and details of the image without making it look unnatural.' },
    { name: 'ปรับแสงให้อบอุ่น', prompt: 'Adjust the color temperature to give the image warmer, golden-hour style lighting.' },
    { name: 'จัดแสงสตูดิโอ', prompt: 'Add dramatic, professional studio lighting to the main subject.' },
  ];

  const activePrompt = selectedPresetPrompt || customPrompt;

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
    setCustomPrompt('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPresetPrompt(null);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onSecondaryImageUpload(e.target.files[0]);
    }
    e.target.value = ''; // Reset file input
  };

  const handleApply = () => {
    if (activePrompt || secondaryImage) {
      onApplyAdjustment(activePrompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">ปรับแต่งภาพระดับมืออาชีพ</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset.prompt)}
            disabled={isLoading}
            className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
          >
            {preset.name}
          </button>
        ))}
      </div>
      
      <div className="w-full bg-gray-900/40 border border-gray-700/60 rounded-lg p-3">
        <h4 className="text-base font-semibold text-center text-gray-300 mb-3">ใช้ภาพอ้างอิง (ไม่บังคับ)</h4>
        {secondaryImageUrl ? (
          <div className="flex items-center gap-3 p-2 bg-white/5 rounded-md">
            <img src={secondaryImageUrl} alt="Reference" className="w-14 h-14 object-cover rounded-md flex-shrink-0" />
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
          <label htmlFor="ref-image-upload" className="relative flex items-center justify-center w-full px-4 py-4 text-sm font-semibold text-gray-300 bg-white/5 rounded-md cursor-pointer group hover:bg-white/10 transition-colors border-2 border-dashed border-gray-600 hover:border-gray-500">
            <UploadIcon className="w-5 h-5 mr-2" />
            อัปโหลดภาพอ้างอิง
            <input id="ref-image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
          </label>
        )}
      </div>

      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="หรืออธิบายการปรับแต่ง (เช่น 'เปลี่ยนพื้นหลังเป็นป่า')"
        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
        disabled={isLoading}
      />

      {(activePrompt || secondaryImage) && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <button
                onClick={handleApply}
                className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || (!activePrompt.trim() && !secondaryImage)}
            >
                ใช้การปรับแต่งนี้
            </button>
        </div>
      )}
    </div>
  );
};

export default AdjustmentPanel;