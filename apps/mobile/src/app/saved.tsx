import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DealCard } from '@/components/deal-card';
import { Deal, getSavedDeals } from '@/lib/api';

export default function SavedScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getSavedDeals();
      setDeals(result.deals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load saved deals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Saved Deals' }} />
      {loading && deals.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DealCard deal={item} />}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#059669" />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Nothing saved yet.</Text><Text style={styles.emptyText}>Save a deal and it will follow this device here.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 36 },
  error: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 14 },
  empty: { paddingVertical: 80, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: '#334155', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
});
