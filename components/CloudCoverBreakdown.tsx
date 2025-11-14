import React from 'react';

interface CloudCoverBreakdownProps {
  low: number;
  mid: number;
  high: number;
}

const CloudLayer: React.FC<{ label: string; value: number; gradient: string; }> = ({ label, value, gradient }) => (
    <div className="flex items-center gap-3">
        <span className="w-10 text-sm text-right text-gray-400 font-medium">{label}</span>
        <div className="flex-1 bg-black/20 rounded-full h-5 relative overflow-hidden border border-white/10">
            <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                style={{ width: `${value}%`, background: gradient }}
            ></div>
        </div>
        <span className="w-12 text-sm font-mono text-white text-left">{value.toFixed(0)}%</span>
    </div>
);

const CloudCoverBreakdown: React.FC<CloudCoverBreakdownProps> = ({ low, mid, high }) => {
  return (
    <div className="flex items-center gap-3">
        <div className="w-8 h-8 text-gray-400 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
        </div>
        <div className="w-full">
            <p className="text-sm text-gray-400 mb-2">Cloud Layers</p>
            <div className="space-y-1.5">
                <CloudLayer label="High" value={high} gradient="linear-gradient(to right, #e2e8f0, #cbd5e0)" />
                <CloudLayer label="Mid" value={mid} gradient="linear-gradient(to right, #a0aec0, #718096)" />
                <CloudLayer label="Low" value={low} gradient="linear-gradient(to right, #718096, #4a5568)" />
            </div>
        </div>
    </div>
  );
};

export default CloudCoverBreakdown;
