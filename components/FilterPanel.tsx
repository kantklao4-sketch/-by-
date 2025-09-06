/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface FilterPanelProps {
  onApplyFilter: (prompt: string) => void;
  isLoading: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onApplyFilter, isLoading }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const presets = [
    { name: 'วินเทจ', prompt: 'Apply a classic vintage photo effect with faded colors, a subtle sepia tone, and light film grain.' },
    { name: 'ขาว-ดำ', prompt: 'Convert the image to a high-contrast, dramatic black and white.' },
    { name: 'ภาพวาดสีน้ำมัน', prompt: 'Transform the image into a classical oil painting, with visible brush strokes, rich textures, and a classic art style.' },
    { name: 'แนวการ์ตูน', prompt: 'Redraw the image in a fun, vibrant cartoon style, with thick outlines, simplified details, and bright, flat colors.' },
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

  const handleApply = () => {
    if (activePrompt) {
      onApplyFilter(activePrompt);
    }
  };

  const filteredPresets = presets.filter(preset =>
    preset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">เลือกฟิลเตอร์</h3>
      
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="ค้นหาฟิลเตอร์..."
        className="w-full bg-gray-900/50 border border-gray-600 text-gray-200 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
        disabled={isLoading}
      />

      {filteredPresets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {filteredPresets.map(preset => (
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
      ) : (
        <p className="text-center text-gray-400 py-4">ไม่พบฟิลเตอร์ที่ตรงกัน</p>
      )}


      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="หรืออธิบายฟิลเตอร์ที่ต้องการ (เช่น 'แสงนีออนสไตล์ยุค 80')"
        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
        disabled={isLoading}
      />
      
      {activePrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
          <button
            onClick={handleApply}
            className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || !activePrompt.trim()}
          >
            ใช้ฟิลเตอร์นี้
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;