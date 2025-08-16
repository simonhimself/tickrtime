"use client";

import { useState, useRef, useEffect } from "react";

import { useIsMobile } from "@/hooks/use-media-query";
import type { UseTableHoverReturn } from "@/types";

export function useTableHover(): UseTableHoverReturn {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [iconPosition, setIconPosition] = useState<number>(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tableHeaderRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  const ICON_VERTICAL_OFFSET = 30; // Offset for better alignment

  // Handle row hover (desktop only)
  const handleRowHover = (symbol: string) => {
    if (isMobile) return; // Disable hover on mobile
    
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

  // Handle row tap (mobile only)
  const handleRowTap = (symbol: string) => {
    if (!isMobile) return; // Only handle taps on mobile
    
    if (expandedRow === symbol) {
      setExpandedRow(null); // Collapse if already expanded
    } else {
      setExpandedRow(symbol); // Expand this row
    }
  };

  // Handle hover end with delay (desktop only)
  const handleHoverEnd = () => {
    if (isMobile) return; // Disable hover end on mobile
    
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

  // Whether to show icons (desktop: hover, mobile: expanded row)
  const shouldShowIcons = isMobile ? expandedRow !== null : hoveredRow !== null;
  const activeRow = isMobile ? expandedRow : hoveredRow;

  return {
    hoveredRow,
    expandedRow,
    activeRow,
    iconPosition,
    rowRefs,
    tableHeaderRef,
    handleRowHover,
    handleRowTap,
    handleHoverEnd,
    handleIconAreaHover,
    handleIconAreaLeave,
    shouldShowIcons,
    isMobile,
    ICON_VERTICAL_OFFSET,
  };
}
