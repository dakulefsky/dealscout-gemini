import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DealCard } from '@/components/deal-card';
import { Deal, getFeed } from '@/lib/api';

function mergeDeals(current: Deal[], incoming: Deal[]) {
  const seen = new Set(current.map((deal) => deal.id));
  return [...current, ...incoming.filter((deal) => !seen.has(deal.id))];
}

export default function HomeScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await getFeed({ limit: 20 });
      setDeals(page.items || []);
      setNextCursor(page.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load deals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const page = await getFeed({ cursor: nextCursor, limit: 20 });
      setDeals((current) => mergeDeals(current, page.items || []));
      setNextCursor(page.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more deals.');
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, nextCursor, refreshing]);

  useEffect(() => { void loadFirstPage(); }, [loadFirstPage]);

  if (loading && deals.length === 0) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#059669" /><Text style={styles.loadingText}>Finding strong deals…</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FlatList
        data={deals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DealCard deal={item} />}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFirstPage(true)} tintColor="#059669" />}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View>
                <Text style={styles.eyebrow}>DEALSCOUT</Text>
                <Text style={styles.heading}>Deals worth checking</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Open saved deals" onPress={() => router.push('/saved')} style={styles.savedButton}>
                <Text style={styles.savedButtonText}>♡ Saved</Text>
              </Pressable>
            </View>
            <Text style={styles.subheading}>Verified Amazon price drops, ranked by deal quality and freshness.</Text>
            {error ? (
              <Pressable onPress={() => void loadFirstPage()} style={styles.errorBox} accessibilityRole="button">
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText}>Tap to retry</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No deals are live right now.</Text><Text style={styles.emptyText}>Pull down to check again.</Text></View>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color="#059669" /> : nextCursor ? <View style={styles.footerSpacer} /> : deals.length ? <Text style={styles.caughtUp}>You’re caught up.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748b', fontSize: 14 },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  header: { paddingTop: 18, paddingBottom: 18 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  eyebrow: { color: '#059669', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  heading: { color: '#0f172a', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 3 },
  subheading: { color: '#64748b', fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 520 },
  savedButton: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  savedButtonText: { color: '#334155', fontWeight: '800', fontSize: 12 },
  errorBox: { marginTop: 14, borderRadius: 14, backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, padding: 12 },
  errorText: { color: '#9a3412', fontSize: 13, fontWeight: '700' },
  retryText: { color: '#c2410c', fontSize: 12, marginTop: 3 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { color: '#334155', fontWeight: '800', fontSize: 16 },
  emptyText: { color: '#94a3b8', marginTop: 5 },
  footer: { paddingVertical: 24 },
  footerSpacer: { height: 30 },
  caughtUp: { color: '#94a3b8', textAlign: 'center', paddingVertical: 24, fontSize: 12 },
});
