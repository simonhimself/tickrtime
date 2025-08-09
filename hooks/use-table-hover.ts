"use client";

import { useState, useRef, useEffect } from "react";

import type { UseTableHoverReturn } from "@/types";

export function useTableHover(): UseTableHoverReturn {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [iconPosition, setIconPosition] = useState<number>(0);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tableHeaderRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ICON_VERTICAL_OFFSET = 30; // Offset for better alignment

  // Handle row hover
  const handleRowHover = (symbol: string) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    setHoveredRow(symbol);
    
    const rowElement = rowRefs.current[symbol];
    const headerElement = tableHeaderRef.current;
    
    if (rowElement && headerElement) {
      const headerRect = headerElement.getBoundingClientRect();
      const rowRect = rowElement.getBoundingClientRect();
      const offset = rowRect.top - headerRect.top + (rowRect.height / 2);
      setIconPosition(offset);
    }
  };

  // Handle hover end with delay
  const handleHoverEnd = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredRow(null);
    }, 50);
  };

  // Handle icon area hover (keep icons visible)
  const handleIconAreaHover = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // Handle icon area leave
  const handleIconAreaLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredRow(null);
    }, 50);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Whether to show icons
  const shouldShowIcons = hoveredRow !== null;

  return {
    hoveredRow,
    iconPosition,
    rowRefs,
    tableHeaderRef,
    handleRowHover,
    handleHoverEnd,
    handleIconAreaHover,
    handleIconAreaLeave,
    shouldShowIcons,
    ICON_VERTICAL_OFFSET,
  };
}
