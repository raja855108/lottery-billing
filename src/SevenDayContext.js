/**
 * SevenDayContext.js
 * When Stocker 7 Days tab is active, this context provides the
 * 7-day boundary date string (YYYY-MM-DD) to RunningBill so it
 * filters bill history automatically.
 * Value is null for Seller / Stocker tabs (no filter).
 */
import { createContext, useContext } from 'react'

export const SevenDayCtx = createContext(null)

/** Returns the boundary date string, or null if not in 7-day mode */
export const useSevenDayBoundary = () => useContext(SevenDayCtx)
