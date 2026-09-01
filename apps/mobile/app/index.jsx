import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DealCard from '../src/components/DealCard';
import { bookmarks, categories as categoriesApi, deals } from '../src/api';
import { addCategoryInterest, loadInterests, reduceCategoryInterest, resetInterests } from '../src/personalization';
import { checkpointVisit, dealFreshnessTimestampMs, dismissDeal, loadDismissedIds, loadPreviousVisit } from '../src/engagement';
import { rankDeals } from '../../../src/lib/dealRanking';
import { dwellWeight, personalizedRank } from '../../../src/lib/personalizationCore';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 250;
const SORTS = [
  { key: 'best', label: 'Best for you' },
  { key: 'newest', label: 'Newest' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'price-low', label: 'Lowest price' },
  { key: 'price-high', label: 'Highest price' },
];
const DISCOUNT_TIERS = [
  { value: 0, label: 'Any discount' },
  { value: 15, label: '15%+' },
  { value: 25, label: '25%+' },
  { value: 30, label: '30%+' },
  { value: 50, label: '50%+' },
];
const PRICE_TIERS = [
  { value: 'all', label: 'Any price' },
  { value: 'under-50', label: 'Under $50', max: 50 },
  { value: '50-150', label: '$50–$150', min: 50, max: 150 },
  { value: '150-300', label: '$150–$300', min: 150, max: 300 },
  { value: 'over-300', label: '$300+', min: 300 },
];

function idOf(deal) {
  return String(deal?.id || deal?.asin || '');
}

function mergeDeals(current, incoming) {
  const seen = new Set(current.map(idOf));
  return [...current, ...(incoming || []).filter((deal) => {
    const id = idOf(deal);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

function balancedFeatured(items, maxItems = 4) {
  const bounded = (items || []).slice(0, maxItems);
  const evenLength = bounded.length - (bounded.length % 2);
  return evenLength >= 2 ? bounded.slice(0, evenLength) : [];
}

function serverSort(sort) {
  if (sort === 'discount') return 'discount_desc';
  if (sort === 'price-low') return 'price_asc';
  if (sort === 'price-high') return 'price_desc';
  return '-created_date';
}

function Chip({ active, label, onPress, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [interests, setInterests] = useState({});
  const [savedIds, setSavedIds] = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [previousVisit, setPreviousVisit] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sort, setSort] = useState('best');
  const [minDiscount, setMinDiscount] = useState(0);
  const [priceTier, setPriceTier] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);
  const paginationRequestRef = useRef(null);
  const feedGenerationRef = useRef(0);
  const viewedAtRef = useRef(new Map());
  const dwellRecordedRef = useRef(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 }).current;

  const selectedPriceTier = useMemo(() => PRICE_TIERS.find((tier) => tier.value === priceTier) || PRICE_TIERS[0], [priceTier]);
  const feedParams = useMemo(() => ({
    limit: PAGE_SIZE,
    sort: serverSort(sort),
    q: query.trim(),
    category: activeCategory === 'all' ? '' : activeCategory,
    minDiscount: minDiscount || '',
    minPrice: selectedPriceTier.min ?? '',
    maxPrice: selectedPriceTier.max ?? '',
  }), [activeCategory, minDiscount, query, selectedPriceTier, sort]);

  const hasActiveFilters = activeCategory !== 'all' || query.trim() !== '' || minDiscount > 0 || priceTier !== 'all' || sort !== 'best';
  const rankedItems = useMemo(() => sort === 'best' ? personalizedRank(rankDeals(items), interests) : items, [interests, items, sort]);
  const visibleRankedItems = useMemo(() => rankedItems.filter((deal) => !dismissedIds.has(idOf(deal))), [dismissedIds, rankedItems]);
  const featured = useMemo(() => hasActiveFilters ? [] : balancedFeatured(visibleRankedItems, 4), [hasActiveFilters, visibleRankedItems]);
  const featuredIds = useMemo(() => new Set(featured.map(idOf)), [featured]);
  const feedItems = useMemo(() => visibleRankedItems.filter((deal) => !featuredIds.has(idOf(deal))), [visibleRankedItems, featuredIds]);
  const personalized = Object.values(interests).some((score) => Number(score) > 0);
  const refreshedSinceLastVisit = useMemo(() => previousVisit > 0
    ? visibleRankedItems.filter((deal) => dealFreshnessTimestampMs(deal) > previousVisit).length
    : 0, [previousVisit, visibleRankedItems]);

  const loadSaved = useCallback(async () => {
    try {
      const result = await bookmarks.list();
      setSavedIds(new Set((result?.bookmarkIds || []).map(String).filter(Boolean)));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  const loadPersonalization = useCallback(async () => {
    try { setInterests(await loadInterests()); } catch { setInterests({}); }
  }, []);

  useEffect(() => {
    categoriesApi.list()
      .then((result) => setCategories(Array.isArray(result) ? result : []))
      .catch(() => setCategories([]));
    loadPersonalization();
    loadSaved();
    loadDismissedIds().then(setDismissedIds).catch(() => setDismissedIds(new Set()));
    loadPreviousVisit().then(setPreviousVisit).catch(() => setPreviousVisit(0));
  }, [loadPersonalization, loadSaved]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') checkpointVisit().catch(() => {});
    });
    return () => {
      subscription.remove();
      checkpointVisit().catch(() => {});
    };
  }, []);

  const loadFirstPage = useCallback(async ({ showSpinner = true } = {}) => {
    requestRef.current?.abort();
    paginationRequestRef.current?.abort();
    paginationRequestRef.current = null;
    setLoadingMore(false);
    const generation = feedGenerationRef.current + 1;
    feedGenerationRef.current = generation;
    const controller = new AbortController();
    requestRef.current = controller;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const page = await deals.page(feedParams, { signal: controller.signal });
      if (controller.signal.aborted || generation !== feedGenerationRef.current) return;
      setItems(page?.items || []);
      setNextCursor(page?.nextCursor || null);
      viewedAtRef.current.clear();
      dwellRecordedRef.current.clear();
    } catch (err) {
      if (err?.name !== 'AbortError' && generation === feedGenerationRef.current) setError(err?.message || 'Could not load deals');
    } finally {
      if (!controller.signal.aborted && generation === feedGenerationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [feedParams]);

  useEffect(() => {
    const timer = setTimeout(() => loadFirstPage(), query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
      paginationRequestRef.current?.abort();
    };
  }, [loadFirstPage, query]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    const generation = feedGenerationRef.current;
    paginationRequestRef.current?.abort();
    const controller = new AbortController();
    paginationRequestRef.current = controller;
    setLoadingMore(true);
    try {
      const page = await deals.page({ ...feedParams, cursor: nextCursor }, { signal: controller.signal });
      if (controller.signal.aborted || generation !== feedGenerationRef.current) return;
      setItems((current) => mergeDeals(current, page?.items || []));
      setNextCursor(page?.nextCursor || null);
    } catch (err) {
      if (err?.name !== 'AbortError' && generation === feedGenerationRef.current) setError(err?.message || 'Could not load more deals');
    } finally {
      if (paginationRequestRef.current === controller) paginationRequestRef.current = null;
      if (generation === feedGenerationRef.current) setLoadingMore(false);
    }
  }, [feedParams, loading, loadingMore, nextCursor]);

  const toggleSave = useCallback(async (deal) => {
    const id = idOf(deal);
    if (!id) return;
    const wasSaved = savedIds.has(id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });
    try {
      const result = await bookmarks.toggle(id);
      setSavedIds((current) => {
        const next = new Set(current);
        if (result?.isSaved) next.add(id); else next.delete(id);
        return next;
      });
      if (result?.isSaved && deal?.category) setInterests(await addCategoryInterest(deal.category, 4));
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(id); else next.delete(id);
        return next;
      });
    }
  }, [savedIds]);

  const openDeal = useCallback(async (deal) => {
    if (!deal?.category) return;
    try { setInterests(await addCategoryInterest(deal.category, 2)); } catch { /* personalization is optional */ }
  }, []);

  const dismiss = useCallback(async (deal) => {
    const id = idOf(deal);
    if (!id) return;
    setDismissedIds((current) => new Set([...current, id]));
    try {
      const [nextDismissed, nextInterests] = await Promise.all([
        dismissDeal(id),
        deal?.category ? reduceCategoryInterest(deal.category, 3) : Promise.resolve(interests),
      ]);
      setDismissedIds(nextDismissed);
      setInterests(nextInterests);
    } catch { /* exact deal remains hidden for this session */ }
  }, [interests]);

  const onViewableItemsChanged = useRef(({ changed }) => {
    for (const token of changed || []) {
      const deal = token.item;
      const id = idOf(deal);
      if (!id || dwellRecordedRef.current.has(id)) continue;
      if (token.isViewable) {
        if (!viewedAtRef.current.has(id)) viewedAtRef.current.set(id, Date.now());
        continue;
      }
      const startedAt = viewedAtRef.current.get(id);
      viewedAtRef.current.delete(id);
      if (!startedAt) continue;
      const weight = dwellWeight(Date.now() - startedAt);
      if (!weight || !deal?.category) continue;
      dwellRecordedRef.current.add(id);
      addCategoryInterest(deal.category, weight).then(setInterests).catch(() => {});
    }
  }).current;

  const resetFilters = useCallback(() => {
    setActiveCategory('all');
    setQuery('');
    setSort('best');
    setMinDiscount(0);
    setPriceTier('all');
  }, []);

  const resetRecommendations = useCallback(async () => {
    setInterests(await resetInterests());
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshing(true);
    loadFirstPage({ showSpinner: false });
    loadSaved();
    loadPersonalization();
  }, [loadFirstPage, loadPersonalization, loadSaved]);

  const card = (deal) => (
    <DealCard
      deal={deal}
      saved={savedIds.has(idOf(deal))}
      onSave={toggleSave}
      onOpen={openDeal}
      onDismiss={dismiss}
    />
  );

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.trustChip}><Text style={styles.trustText}>Freshly checked</Text></View>
        <Text style={styles.heroTitle}>Good deals. No digging.</Text>
        {!hasActiveFilters && refreshedSinceLastVisit > 0 && (
          <Text style={styles.returnCue}>{refreshedSinceLastVisit} {refreshedSinceLastVisit === 1 ? 'deal refreshed' : 'deals refreshed'} since your last visit</Text>
        )}
        <View style={styles.heroActions}>
          <Pressable onPress={() => router.push('/saved')} accessibilityRole="button" accessibilityLabel="Open saved deals" style={styles.savedButton}>
            <Text style={styles.savedButtonText}>Saved{savedIds.size ? ` ${savedIds.size}` : ''}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel="Deal categories">
          <Chip active={activeCategory === 'all'} label="All" onPress={() => setActiveCategory('all')} />
          {categories.map((category) => {
            const name = category?.name || category?.id;
            if (!name) return null;
            return <Chip key={category.id || name} active={String(activeCategory).toLowerCase() === String(name).toLowerCase()} label={name} onPress={() => setActiveCategory(name)} />;
          })}
        </ScrollView>

        <TextInput value={query} onChangeText={setQuery} placeholder="Search deals" placeholderTextColor="#94a3b8" returnKeyType="search" style={styles.search} accessibilityLabel="Search deals" />

        <Text style={styles.controlLabel}>Sort</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORTS.map((option) => <Chip key={option.key} active={sort === option.key} label={option.label} onPress={() => setSort(option.key)} />)}
        </ScrollView>

        <Text style={styles.controlLabel}>Discount</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DISCOUNT_TIERS.map((tier) => <Chip key={tier.value} active={minDiscount === tier.value} label={tier.label} onPress={() => setMinDiscount(tier.value)} />)}
        </ScrollView>

        <Text style={styles.controlLabel}>Price</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PRICE_TIERS.map((tier) => <Chip key={tier.value} active={priceTier === tier.value} label={tier.label} onPress={() => setPriceTier(tier.value)} />)}
        </ScrollView>

        {(hasActiveFilters || personalized) && (
          <View style={styles.resetRow}>
            {hasActiveFilters && <Pressable onPress={resetFilters} accessibilityRole="button"><Text style={styles.resetText}>Reset filters</Text></Pressable>}
            {personalized && <Pressable onPress={resetRecommendations} accessibilityRole="button"><Text style={styles.resetText}>Reset recommendations</Text></Pressable>}
          </View>
        )}
      </View>

      {featured.length > 0 && (
        <View style={styles.featuredSection}>
          <Text style={styles.eyebrow}>DEAL DROP</Text>
          <Text style={styles.sectionTitle}>Today’s best finds</Text>
          <View style={styles.featuredGrid}>
            {featured.map((deal) => <View key={idOf(deal)} style={styles.featuredCell}>{card(deal)}</View>)}
          </View>
        </View>
      )}

      <Text style={styles.moreTitle}>{hasActiveFilters ? 'Deals' : 'More deals for you'}</Text>
    </View>
  );

  if (loading && !items.length) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /><Text style={styles.loadingText}>Finding good deals…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={feedItems}
        keyExtractor={idOf}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        renderItem={({ item }) => <View style={styles.cell}>{card(item)}</View>}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={0.7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : !nextCursor && items.length ? <Text style={styles.endText}>You’ve seen today’s best deals</Text> : null}
        ListEmptyComponent={!loading ? <View style={styles.emptyWrap}><Text style={styles.empty}>{error || 'No deals match your filters.'}</Text>{hasActiveFilters && <Pressable onPress={resetFilters} style={styles.emptyReset}><Text style={styles.emptyResetText}>Reset filters</Text></Pressable>}</View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc' },
  loadingText: { color: '#64748b', fontWeight: '700' },
  content: { paddingBottom: 36 },
  hero: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  trustChip: { alignSelf: 'flex-start', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  trustText: { color: '#065f46', fontWeight: '800', fontSize: 11 },
  heroTitle: { marginTop: 12, fontSize: 34, lineHeight: 38, letterSpacing: -1, fontWeight: '900', color: '#020617' },
  returnCue: { marginTop: 9, color: '#047857', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  heroActions: { flexDirection: 'row', marginTop: 14 },
  savedButton: { borderRadius: 999, backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 9 },
  savedButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  controls: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  search: { height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, color: '#0f172a', fontSize: 15, marginTop: 10, marginBottom: 12 },
  controlLabel: { color: '#64748b', fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, marginBottom: 7 },
  chipRow: { gap: 8, paddingRight: 12 },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#fff' },
  resetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12, marginBottom: 4 },
  resetText: { color: '#be123c', fontSize: 12, fontWeight: '800' },
  featuredSection: { marginHorizontal: 14, marginTop: 10, marginBottom: 18, padding: 14, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 22 },
  eyebrow: { fontSize: 11, color: '#c2410c', fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 22, color: '#0f172a', fontWeight: '900', marginTop: 4, marginBottom: 12 },
  featuredGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, rowGap: 10 },
  featuredCell: { width: '50%', paddingHorizontal: 5 },
  moreTitle: { paddingHorizontal: 16, marginBottom: 12, marginTop: 8, fontSize: 22, color: '#0f172a', fontWeight: '900' },
  row: { paddingHorizontal: 9 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
  footer: { paddingVertical: 24 },
  endText: { textAlign: 'center', color: '#64748b', fontSize: 13, fontWeight: '800', paddingVertical: 28 },
  emptyWrap: { alignItems: 'center', padding: 36 },
  empty: { textAlign: 'center', color: '#64748b' },
  emptyReset: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  emptyResetText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});