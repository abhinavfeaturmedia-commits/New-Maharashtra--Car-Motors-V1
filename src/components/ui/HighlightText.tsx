import React from 'react';

interface HighlightTextProps {
    text?: any;
    highlight: string;
}

const HighlightText: React.FC<HighlightTextProps> = ({ text, highlight }) => {
    const textStr = text !== undefined && text !== null ? String(text) : '';
    if (!textStr) return null;
    if (!highlight.trim()) return <>{textStr}</>;

    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapeRegExp(highlight)})`, 'gi');
    const parts = textStr.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

export default HighlightText;
