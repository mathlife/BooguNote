import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileCode, RefreshCw } from 'lucide-react';
import { OutlineNode } from '../types/outline';
import { exportToMarkdown, parseMarkdownToNodes } from '../utils/mdParser';
import { exportToBooXml, parseBooXml } from '../utils/booParser';

interface SourcePreviewModalProps {
  nodes: OutlineNode[];
  onApplyNodes: (newNodes: OutlineNode[]) => void;
  onClose: () => void;
}

export const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({
  nodes,
  onApplyNodes,
  onClose,
}) => {
  const [format, setFormat] = useState<'md-full' | 'md-clean' | 'boo-xml'>(
    'md-full'
  );
  const [sourceText, setSourceText] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    if (format === 'md-full') {
      setSourceText(exportToMarkdown(nodes, true));
    } else if (format === 'md-clean') {
      setSourceText(exportToMarkdown(nodes, false));
    } else {
      setSourceText(exportToBooXml(nodes));
    }
  }, [format, nodes]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sourceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleApplyChanges = () => {
    try {
      setErrorMsg(null);
      if (format === 'boo-xml') {
        const parsed = parseBooXml(sourceText);
        onApplyNodes(parsed);
      } else {
        const parsed = parseMarkdownToNodes(sourceText);
        onApplyNodes(parsed);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || '解析失败，请检查格式语法');
    }
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div
        className="bn-modal-card bn-source-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bn-modal-header">
          <div className="bn-modal-title">
            <FileCode size={18} /> Markdown / .boo 源码实时双向转换器
          </div>
          <button type="button" className="bn-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="bn-source-toolbar">
          <div className="bn-format-tabs">
            <button
              type="button"
              className={`bn-format-tab ${format === 'md-full' ? 'active' : ''}`}
              onClick={() => setFormat('md-full')}
            >
              Markdown (含属性注释)
            </button>
            <button
              type="button"
              className={`bn-format-tab ${format === 'md-clean' ? 'active' : ''}`}
              onClick={() => setFormat('md-clean')}
            >
              纯净 Markdown
            </button>
            <button
              type="button"
              className={`bn-format-tab ${format === 'boo-xml' ? 'active' : ''}`}
              onClick={() => setFormat('boo-xml')}
            >
              .boo (Legacy XML)
            </button>
          </div>

          <div className="bn-source-actions">
            <button
              type="button"
              className="bn-toolbar-btn"
              onClick={handleCopy}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '复制源码'}
            </button>
            <button
              type="button"
              className="bn-toolbar-btn primary"
              onClick={handleApplyChanges}
            >
              <RefreshCw size={14} /> 应用修改到大纲
            </button>
          </div>
        </div>

        {errorMsg && <div className="bn-source-error">{errorMsg}</div>}

        <div className="bn-source-editor-wrap">
          <textarea
            className="bn-source-textarea"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

