import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { bookmarks as bookmarksApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const BookmarksContext = createContext(null);

export function BookmarksProvider({ children }) {
  const [savedDealIds, setSavedDealIds] = useState([]);
  const [savedDealsList, setSavedDealsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchBookmarks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await bookmarksApi.list();
      setSavedDealIds((res.bookmarkIds || []).map(String));
      setSavedDealsList(res.deals || []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const toggleBookmark = async (deal) => {
    if (!deal) return;
    const dealId = String(deal.id || deal.asin || '');
    if (!dealId) return;
    const isCurrentlySaved = savedDealIds.includes(dealId);

    // Optimistic update
    if (isCurrentlySaved) {
      setSavedDealIds((prev) => prev.filter((id) => id !== dealId));
      setSavedDealsList((prev) => prev.filter((d) => (d.id !== dealId && d.asin !== dealId)));
      toast({
        title: 'Removed from Saved Deals',
        description: `"${String(deal.title || 'Deal').substring(0, 40)}" was removed from your saved deals.`,
      });
    } else {
      setSavedDealIds((prev) => [...prev, dealId]);
      setSavedDealsList((prev) => [deal, ...prev]);
      toast({
        title: 'Added to Saved Deals',
        description: `"${String(deal.title || 'Deal').substring(0, 40)}" has been saved.`,
      });
    }

    try {
      await bookmarksApi.toggle(dealId);
      fetchBookmarks();
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      await fetchBookmarks();
      toast({
        title: 'Could not update saved deals',
        description: 'Your saved list was restored. Please try again.',
        variant: 'destructive',
      });
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
