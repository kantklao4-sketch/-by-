/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { BrushIcon, EraserIcon, UndoIcon, ClearIcon } from './icons';

interface MagicFillPanelProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onApply: () => void;
  isLoading: boolean;
  isMaskDrawn: boolean;
  brushSize: number;
  setBrushSize: (size: number) => void;
  isErasing: boolean;
  setIsErasing: (isErasing: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndoMask: boolean;
}

const MagicFillPanel: React.FC<MagicFillPanelProps> = ({
  prompt, setPrompt, onApply, isLoading, isMaskDrawn,
  brushSize, setBrushSize, isErasing, setIsErasing, onUndo, onClear, canUndoMask
}) => {
  const brushSizes = [
    { label: 'S', value: 15 },
    { label: 'M', value: 30 },
    { label: 'L', value: 60 },
  ];

  return (
    <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
      <p className="text-md text-gray-400">
        ระบายสีบนพื้นที่ที่ต้องการแก้ไข จากนั้นอธิบายสิ่งที่คุณต้องการ
      </p>

      <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex flex-wrap items-center justify-center gap-3 backdrop-blur-sm">
        <span className="text-sm font-semibold text-gray-300 mr-2">เครื่องมือ:</span>
        <button
          onClick={() => setIsErasing(false)}
          disabled={isLoading}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${
            !isErasing ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-200'
          }`}
        >
          <BrushIcon className="w-4 h-4" />
          พู่กัน
        </button>
        <button
          onClick={() => setIsErasing(true)}
          disabled={isLoading}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${
            isErasing ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-200'
          }`}
        >
          <EraserIcon className="w-4 h-4" />
          ยางลบ
        </button>
        <div className="h-6 w-px bg-gray-600 mx-1"></div>
        <span className="text-sm font-semibold text-gray-300 mr-1">ขนาด:</span>
        {brushSizes.map(({ label, value }) => (
          <button
            key={label}
            onClick={() => setBrushSize(value)}
            disabled={isLoading}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all disabled:opacity-50 ${
              brushSize === value ? 'bg-blue-500 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : 'bg-white/10 hover:bg-white/20 text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
         <div className="h-6 w-px bg-gray-600 mx-1"></div>
         <button onClick={onUndo} disabled={isLoading || !canUndoMask} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-white/10 hover:bg-white/20 text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <UndoIcon className="w-4 h-4" />
            เลิกทำ
         </button>
         <button onClick={onClear} disabled={isLoading || !isMaskDrawn} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-white/10 hover:bg-white/20 text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ClearIcon className="w-4 h-4" />
            ล้าง
         </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onApply(); }} className="w-full flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={isMaskDrawn ? "เช่น 'ลบคนนี้ออก' หรือ 'เพิ่มฝูงนก'" : "กรุณาระบายสีบนภาพก่อน"}
          className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading || !isMaskDrawn}
        />
        <button
          type="submit"
          className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          disabled={isLoading || !prompt.trim() || !isMaskDrawn}
        >
          สร้าง
        </button>
      </form>
    </div>
  );
};

export default MagicFillPanel;