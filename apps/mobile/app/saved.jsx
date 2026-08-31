import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DealCard from '../src/components/DealCard';
import { bookmarks } from '../src/api';

function dealOf(row) {
  return row?.deal || row;
}

function idOf(deal) {
  return String(deal?.id || deal?.asin || '');
}

export default function SavedDealsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const result = await bookmarks.list();
      const rows = Array.isArray(result) ? result : result?.items || result?.bookmarks || [];
      setItems(rows.map(dealOf).filter((deal) => idOf(deal)));
    } catch (err) {
      setError(err?.message || 'Could not load saved deals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback(async (deal) => {
    const id = idOf(deal);
    if (!id) return;
    const previous = items;
    setItems((current) => current.filter((item) => idOf(item) !== id));
    try { await bookmarks.toggle(id); } catch { setItems(previous); }
  }, [items]);

  if (loading && !items.length) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={idOf}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
        renderItem={({ item }) => <View style={styles.cell}><DealCard deal={item} saved onSave={remove} /></View>}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No saved deals yet</Text><Text style={styles.emptyBody}>{error || 'Save a deal and it’ll show up here.'}</Text></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  content: { paddingVertical: 12, paddingBottom: 30, flexGrow: 1 },
  row: { paddingHorizontal: 9 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
  empty: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { fontSize: 21, color: '#0f172a', fontWeight: '900' },
  emptyBody: { marginTop: 7, color: '#64748b', textAlign: 'center' },
});
