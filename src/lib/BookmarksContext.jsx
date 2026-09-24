import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { bookmarks as bookmarksApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const BookmarksContext = createContext(null);

export function BookmarksProvider({ children }) {
  const [savedDealIds, setSavedDealIds] = useState([]);
  const [savedDealsList, setSavedDealsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestVersion = useRef(0);
  const pendingIds = useRef(new Set());
  const { toast } = useToast();

  const fetchBookmarks = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      setIsLoading(true);
      const res = await bookmarksApi.list();
      if (version !== requestVersion.current || pendingIds.current.size) return;
      setSavedDealIds((res.bookmarkIds || []).map(String));
      setSavedDealsList(res.deals || []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const toggleBookmark = async (deal) => {
    if (!deal) return;
    const dealId = String(deal.id || deal.asin || '');
    if (!dealId || pendingIds.current.has(dealId)) return;
    pendingIds.current.add(dealId);
    requestVersion.current += 1; // An earlier list response must not undo this action.
    setIsLoading(false);
    const isCurrentlySaved = savedDealIds.includes(dealId);

    // Optimistic update
    if (isCurrentlySaved) {
      setSavedDealIds((prev) => prev.filter((id) => id !== dealId));
      setSavedDealsList((prev) => prev.filter((d) => String(d.id || d.asin) !== dealId));
      toast({
        title: 'Removed from Saved Deals',
        description: `"${String(deal.title || 'Deal').substring(0, 40)}" was removed from your saved deals.`,
      });
    } else {
      setSavedDealIds((prev) => prev.includes(dealId) ? prev : [...prev, dealId]);
      setSavedDealsList((prev) => [deal, ...prev.filter((d) => String(d.id || d.asin) !== dealId)]);
      toast({
        title: 'Added to Saved Deals',
        description: `"${String(deal.title || 'Deal').substring(0, 40)}" has been saved.`,
      });
    }

    try {
      await bookmarksApi.toggle(dealId);
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      setSavedDealIds((prev) => isCurrentlySaved
        ? (prev.includes(dealId) ? prev : [...prev, dealId])
        : prev.filter((id) => id !== dealId));
      setSavedDealsList((prev) => isCurrentlySaved
        ? [deal, ...prev.filter((d) => String(d.id || d.asin) !== dealId)]
        : prev.filter((d) => String(d.id || d.asin) !== dealId));
      toast({
        title: 'Could not update saved deals',
        description: 'Your saved list was restored. Please try again.',
        variant: 'destructive',
      });
    } finally {
      pendingIds.current.delete(dealId);
      if (pendingIds.current.size === 0) await fetchBookmarks();
    }
  };

  const isSaved = (dealId) => savedDealIds.includes(String(dealId || ''));

  return (
    <BookmarksContext.Provider
      value={{
        savedDealIds,
        savedDealsList,
        isLoading,
        toggleBookmark,
        isSaved,
        refreshBookmarks: fetchBookmarks,
      }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return ctx;
}
