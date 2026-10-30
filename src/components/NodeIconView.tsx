import React from 'react';
import {
  Flag,
  CheckCircle2,
  XCircle,
  Star,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { NodeIconType, NODE_ICON_LABELS } from '../types/outline';

interface NodeIconViewProps {
  icon: NodeIconType;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}

// 渲染 BooguNote 经典的 7 种矢量节点图标
export const NodeIconView: React.FC<NodeIconViewProps> = ({
  icon,
  size = 15,
  onClick,
}) => {
  if (icon === 'none') return null;

  const title = NODE_ICON_LABELS[icon] || icon;

  const renderIcon = () => {
    switch (icon) {
      case 'flag':
        return <Flag size={size} color="#ef4444" fill="#fee2e2" />;
      case 'tick':
        return <CheckCircle2 size={size} color="#16a34a" fill="#dcfce7" />;
      case 'cross':
        return <XCircle size={size} color="#dc2626" fill="#fee2e2" />;
      case 'star':
        return <Star size={size} color="#eab308" fill="#fef08a" />;
      case 'question':
        return <HelpCircle size={size} color="#2563eb" fill="#dbeafe" />;
      case 'warning':
        return <AlertTriangle size={size} color="#d97706" fill="#fef3c7" />;
      case 'idea':
        return <Lightbulb size={size} color="#ca8a04" fill="#fef9c3" />;
      default:
        return null;
    }
  };

  return (
    <span
      className="bn-node-icon"
      title={`${title} (点击切换图标)`}
      onClick={onClick}
    >
      {renderIcon()}
    </span>
  );
};

