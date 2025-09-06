/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { ShieldIcon, BrushIcon, EraserIcon, UndoIcon, ClearIcon } from './icons';

interface FreestylePanelProps {
  onApplyFreestyle: (prompt: string) => void;
  isLoading: boolean;
  brushSize: number;
  setBrushSize: (size: number) => void;
  isErasing: boolean;
  setIsErasing: (isErasing: boolean) => void;
  isMaskDrawn: boolean;
  onUndo: () => void;
  onClear: () => void;
  canUndoMask: boolean;
}

const FreestylePanel: React.FC<FreestylePanelProps> = ({ 
  onApplyFreestyle, isLoading, brushSize, setBrushSize, isErasing, setIsErasing,
  isMaskDrawn, onUndo, onClear, canUndoMask 
}) => {
  const [prompt, setPrompt] = useState('');
  const [showProtectionTools, setShowProtectionTools] = useState(false);

  const samplePrompts = [
    "เปลี่ยนพื้นหลังเป็นชายหาดตอนพระอาทิตย์ตก",
    "เปลี่ยนสไตล์ภาพเป็นภาพวาดสีน้ำ",
    "เพิ่มผีเสื้อสวยๆ บินรอบตัวแบบ",
    "ทำให้ภาพเป็นขาว-ดำ แต่ให้ดอกไม้เป็นสีแดง",
    "เปลี่ยนฤดูกาลเป็นฤดูหนาวและมีหิมะตก",
    "ใส่แว่นตากันแดดล้ำยุคให้ตัวแบบ",
  ];

  const brushSizes = [
    { label: 'S', value: 15 },
    { label: 'M', value: 30 },
    { label: 'L', value: 60 },
  ];

  const handleSampleClick = (sample: string) => {
    setPrompt(sample);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onApplyFreestyle(prompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col gap-6 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-100">แก้ไขตามจินตนาการ</h3>
        <p className="mt-2 text-gray-400">
          อธิบายการเปลี่ยนแปลงที่คุณต้องการเห็นในภาพ AI จะสร้างสรรค์ผลงานใหม่ทั้งหมดตามคำสั่งของคุณ
        </p>
      </div>
      
      <div className="flex flex-col items-center gap-4">
          <form onSubmit={handleApply} className="w-full flex items-center gap-2">
              <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="เช่น 'ทำให้ภาพนี้ดูเหมือนอยู่ใต้น้ำ'"
                  className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
              />
              <button 
                  type="submit"
                  className="bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-indigo-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                  disabled={isLoading || !prompt.trim()}
              >
                  สร้างสรรค์
              </button>
          </form>
      </div>

      <div className="w-full flex flex-col items-center gap-3">
        <button 
          onClick={() => setShowProtectionTools(!showProtectionTools)}
          className="flex items-center gap-2 text-sm font-semibold text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 px-4 py-2 rounded-full transition-colors"
        >
          <ShieldIcon className="w-5 h-5" />
          {showProtectionTools ? 'ซ่อนเครื่องมือป้องกัน' : 'ป้องกันพื้นที่ (ไม่บังคับ)'}
        </button>

        {showProtectionTools && (
          <div className="w-full flex flex-col items-center gap-4 animate-fade-in pt-2">
            <p className="text-md text-gray-400 text-center">
              ระบายสีทับส่วนของภาพที่คุณ <span className="text-yellow-400 font-bold">ไม่ต้องการ</span> ให้ AI เปลี่ยนแปลง
            </p>
            <div className="w-full bg-gray-900/40 border border-gray-700/60 rounded-lg p-3 flex flex-wrap items-center justify-center gap-3 backdrop-blur-sm">
              <span className="text-sm font-semibold text-gray-300 mr-2">เครื่องมือ:</span>
              <button
                onClick={() => setIsErasing(false)}
                disabled={isLoading}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${
                  !isErasing ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-white/20 text-gray-200'
                }`}
              >
                <BrushIcon className="w-4 h-4" />
                พู่กัน
              </button>
              <button
                onClick={() => setIsErasing(true)}
                disabled={isLoading}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${
                  isErasing ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-white/20 text-gray-200'
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
                    brushSize === value ? 'bg-yellow-500 text-black ring-2 ring-offset-2 ring-offset-gray-800 ring-yellow-500' : 'bg-white/10 hover:bg-white/20 text-gray-200'
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
          </div>
        )}
      </div>

      <div>
        <h4 className="text-base font-semibold text-gray-300 mb-3 text-center">✨ ลองใช้ไอเดียสร้างสรรค์ ✨</h4>
        <div className="flex flex-wrap justify-center gap-2">
            {samplePrompts.map((sample, index) => (
                <button
                    key={index}
                    onClick={() => handleSampleClick(sample)}
                    disabled={isLoading}
                    className="bg-white/5 text-gray-300 text-sm px-4 py-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    {sample}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default FreestylePanel;