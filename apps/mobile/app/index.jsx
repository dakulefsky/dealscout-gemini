import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DealCard from '../src/components/DealCard';
import { bookmarks, deals } from '../src/api';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 250;

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

export default function HomeScreen() {
  const [items, setItems] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [nextCursor, setNextCursor] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);

  const featured = useMemo(() => balancedFeatured(items, 4), [items]);
  const featuredIds = useMemo(() => new Set(featured.map(idOf)), [featured]);
  const feedItems = useMemo(() => items.filter((deal) => !featuredIds.has(idOf(deal))), [items, featuredIds]);

  const loadSaved = useCallback(async () => {
    try {
      const result = await bookmarks.list();
      setSavedIds(new Set((result?.bookmarkIds || []).map(String).filter(Boolean)));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  const loadFirstPage = useCallback(async ({ showSpinner = true } = {}) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const page = await deals.page({ limit: PAGE_SIZE, sort: '-created_date', q: query.trim() }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setItems(page?.items || []);
      setNextCursor(page?.nextCursor || null);
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message || 'Could not load deals');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => loadFirstPage(), query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadFirstPage, query]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await deals.page({ limit: PAGE_SIZE, sort: '-created_date', q: query.trim(), cursor: nextCursor });
      setItems((current) => mergeDeals(current, page?.items || []));
      setNextCursor(page?.nextCursor || null);
    } catch (err) {
      setError(err?.message || 'Could not load more deals');
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, nextCursor, query]);

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
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(id); else next.delete(id);
        return next;
      });
    }
  }, [savedIds]);

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.trustChip}><Text style={styles.trustText}>Freshly checked</Text></View>
        <Text style={styles.heroTitle}>Good deals. No digging.</Text>
        <View style={styles.heroActions}>
          <Pressable onPress={() => router.push('/saved')} accessibilityRole="button" accessibilityLabel="Open saved deals" style={styles.savedButton}>
            <Text style={styles.savedButtonText}>Saved{savedIds.size ? ` ${savedIds.size}` : ''}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search deals" placeholderTextColor="#94a3b8" returnKeyType="search" style={styles.search} accessibilityLabel="Search deals" />
      </View>

      {featured.length > 0 && (
        <View style={styles.featuredSection}>
          <Text style={styles.eyebrow}>DEAL DROP</Text>
          <Text style={styles.sectionTitle}>Today’s best finds</Text>
          <View style={styles.featuredGrid}>
            {featured.map((deal) => <View key={idOf(deal)} style={styles.featuredCell}><DealCard deal={deal} saved={savedIds.has(idOf(deal))} onSave={toggleSave} /></View>)}
          </View>
        </View>
      )}

      <Text style={styles.moreTitle}>More deals for you</Text>
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
        renderItem={({ item }) => <View style={styles.cell}><DealCard deal={item} saved={savedIds.has(idOf(item))} onSave={toggleSave} /></View>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFirstPage({ showSpinner: false }); loadSaved(); }} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : !nextCursor && items.length ? <Text style={styles.endText}>You’ve seen today’s best deals</Text> : null}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{error || 'No deals match your search.'}</Text> : null}
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
  heroActions: { flexDirection: 'row', marginTop: 14 },
  savedButton: { borderRadius: 999, backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 9 },
  savedButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  searchWrap: { padding: 14 },
  search: { height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, color: '#0f172a', fontSize: 15 },
  featuredSection: { marginHorizontal: 14, marginBottom: 18, padding: 14, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 22 },
  eyebrow: { fontSize: 11, color: '#c2410c', fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 22, color: '#0f172a', fontWeight: '900', marginTop: 4, marginBottom: 12 },
  featuredGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, rowGap: 10 },
  featuredCell: { width: '50%', paddingHorizontal: 5 },
  moreTitle: { paddingHorizontal: 16, marginBottom: 12, fontSize: 22, color: '#0f172a', fontWeight: '900' },
  row: { paddingHorizontal: 9 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
  footer: { paddingVertical: 24 },
  endText: { textAlign: 'center', color: '#64748b', fontSize: 13, fontWeight: '800', paddingVertical: 28 },
  empty: { textAlign: 'center', color: '#64748b', padding: 36 },
});
