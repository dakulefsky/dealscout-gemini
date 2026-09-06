import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DealCard from '../src/components/DealCard';
import { bookmarks } from '../src/api';

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
      setItems((result?.deals || []).filter((deal) => idOf(deal)));
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
    try {
      const result = await bookmarks.toggle(id);
      if (result?.isSaved) setItems(previous);
    } catch {
      setItems(previous);
    }
  }, [items]);

  if (loading && !items.length) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={idOf}
        numColumns={2}
        columnWrapperStyle={items.length ? styles.row : undefined}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
        ListHeaderComponent={items.length ? (
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR SHORTLIST</Text>
            <Text style={styles.heading}>Saved deals</Text>
            <Text style={styles.subheading}>{items.length} {items.length === 1 ? 'deal' : 'deals'} worth another look.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => <View style={styles.cell}><DealCard deal={item} saved onSave={remove} /></View>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEyebrow}>{error ? 'COULD NOT LOAD' : 'YOUR SHORTLIST'}</Text>
            <Text style={styles.emptyTitle}>{error ? 'Saved deals are unavailable' : 'Nothing saved yet'}</Text>
            <Text style={styles.emptyBody}>{error || 'Keep the deals you want to compare or come back to.'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={error ? 'Try loading saved deals again' : 'Browse deals'} onPress={error ? () => load() : () => router.push('/')} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>{error ? 'Try again' : 'Browse deals'}</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f4ec' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f4ec' },
  content: { paddingBottom: 34, flexGrow: 1 },
  header: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#cfc8ba', marginBottom: 12 },
  eyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: '900', color: '#166534' },
  heading: { marginTop: 5, fontSize: 29, lineHeight: 34, fontWeight: '900', color: '#17201b' },
  subheading: { marginTop: 5, color: '#746f65', fontSize: 13 },
  row: { paddingHorizontal: 9 },
  cell: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
  empty: { flex: 1, minHeight: 520, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: '900', color: '#166534', marginBottom: 7 },
  emptyTitle: { fontSize: 25, color: '#17201b', fontWeight: '900', textAlign: 'center' },
  emptyBody: { maxWidth: 290, marginTop: 8, color: '#746f65', lineHeight: 19, textAlign: 'center' },
  emptyButton: { marginTop: 22, minWidth: 150, paddingVertical: 13, paddingHorizontal: 20, backgroundColor: '#174b32', alignItems: 'center' },
  emptyButtonText: { color: '#fff', fontWeight: '900' },
});
