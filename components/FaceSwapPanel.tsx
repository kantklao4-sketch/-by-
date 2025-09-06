/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { UploadIcon } from './icons';

interface FaceSwapPanelProps {
  onApplyFaceSwap: () => void;
  isLoading: boolean;
  secondaryImage: File | null;
  onSecondaryImageUpload: (file: File) => void;
  onClearSecondaryImage: () => void;
}

const FaceSwapPanel: React.FC<FaceSwapPanelProps> = ({ 
  onApplyFaceSwap, 
  isLoading, 
  secondaryImage, 
  onSecondaryImageUpload, 
  onClearSecondaryImage 
}) => {
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (secondaryImage) {
      const url = URL.createObjectURL(secondaryImage);
      setSecondaryImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setSecondaryImageUrl(null);
  }, [secondaryImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSecondaryImageUpload(e.target.files[0]);
    }
    e.target.value = ''; // Reset file input
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-300">สลับใบหน้า</h3>
        <p className="text-sm text-gray-400">
          อัปโหลด 'ภาพเป้าหมาย' ที่คุณต้องการนำใบหน้าจาก 'ภาพต้นฉบับ' ไปใส่
        </p>
      </div>

      <div className="w-full bg-gray-900/40 border-2 border-dashed border-green-500/50 rounded-lg p-3">
        <h4 className="text-base font-semibold text-center text-green-300 mb-3">ภาพเป้าหมาย</h4>
        {secondaryImageUrl ? (
          <div className="flex items-center gap-3 p-2 bg-white/5 rounded-md">
            <img src={secondaryImageUrl} alt="Target" className="w-14 h-14 object-cover rounded-md flex-shrink-0" />
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
          <label htmlFor="target-image-upload" className="relative flex items-center justify-center w-full px-4 py-4 text-sm font-semibold text-gray-300 bg-white/5 rounded-md cursor-pointer group hover:bg-white/10 transition-colors">
            <UploadIcon className="w-5 h-5 mr-2" />
            อัปโหลดภาพเป้าหมาย
            <input id="target-image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
          </label>
        )}
      </div>

      <button
        onClick={onApplyFaceSwap}
        className="w-full bg-gradient-to-br from-green-600 to-teal-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-gray-700 disabled:to-gray-600 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        disabled={isLoading || !secondaryImage}
      >
        สลับใบหน้า
      </button>
    </div>
  );
};

export default FaceSwapPanel;