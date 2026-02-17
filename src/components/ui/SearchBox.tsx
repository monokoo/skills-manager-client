import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  width?: number | string;
  expandedWidth?: number | string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
  width = 200,
  expandedWidth = 280,
}) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div 
      layout
      className={`relative group h-9 ${className}`}
      animate={{ width: value || isFocused ? expandedWidth : width }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors z-10 ${isFocused ? 'text-blue-500' : 'text-gray-400'}`}>
        <Search size={14} />
      </div>
      <motion.input
        type="text"
        placeholder={placeholder || t('searchPlaceholder') || "搜索..."}
        className="w-full h-full pl-9 pr-9 bg-gray-100/50 dark:bg-white/5 
          border-gray-200/60 dark:border-white/10 rounded-xl 
          focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10 
          focus:border-blue-500/50 transition-all duration-300 
          placeholder:text-gray-400 text-xs shadow-sm outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value && (
        <button 
          className="absolute inset-y-0 right-0 pr-2.5 z-10 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          onClick={() => onChange('')}
        >
          <X size={12} />
        </button>
      )}
    </motion.div>
  );
};
