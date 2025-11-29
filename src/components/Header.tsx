import React from 'react';
import { motion } from 'framer-motion';
import { Menu, Thermometer, AlertTriangle, Leaf } from 'lucide-react';
import Button from './ui/Button';

interface HeaderProps {
  selectedDataType: 'temperature' | 'disasters' | 'environmental';
  onDataTypeChange: (type: 'temperature' | 'disasters' | 'environmental') => void;
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ selectedDataType, onDataTypeChange, onMenuToggle }) => {
  const dataTypes = [
    { key: 'temperature', label: 'Climate Data', icon: Thermometer },
    { key: 'disasters', label: 'Disasters', icon: AlertTriangle },
    { key: 'environmental', label: 'Environmental', icon: Leaf }
  ];

  return (
    <motion.header 
      className="fixed top-[32px] left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <Button onClick={onMenuToggle} className="p-2 rounded-md" variant="ghost">
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center space-x-3">
            <img src='/Group 2.png' alt="Logo" className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">GEOSTORM</h1>
              <p className="text-sm text-gray-400">Real-time environmental monitoring</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center space-x-2">
          {dataTypes.map((type) => {
            const Icon = type.icon;
            return (
              <motion.div key={type.key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => onDataTypeChange(type.key as 'temperature' | 'disasters' | 'environmental')}
                  variant={selectedDataType === type.key ? 'primary' : 'ghost'}
                  className="flex items-center space-x-2 px-4 py-2"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{type.label}</span>
                </Button>
              </motion.div>
            );
          })}
        </nav>
      </div>
    </motion.header>
  );
};

export default Header;