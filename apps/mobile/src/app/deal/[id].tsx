import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Deal, getDeal, getSavedDeals, toggleSaved } from '@/lib/api';

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [dealResult, savedResult] = await Promise.all([getDeal(id), getSavedDeals()]);
        if (!active) return;
        setDeal(dealResult);
        setSaved(savedResult.bookmarkIds.includes(dealResult.id));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load this deal.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  async function onToggleSaved() {
    if (!deal || busy) return;
    setBusy(true);
    try {
      const result = await toggleSaved(deal.id);
      setSaved(result.isSaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update saved deals.');
    } finally {
      setBusy(false);
    }
  }

  async function openAmazon() {
    if (!deal?.productUrl) return;
    const supported = await Linking.canOpenURL(deal.productUrl);
    if (!supported) {
      setError('Amazon link is not available on this device.');
      return;
    }
    await Linking.openURL(deal.productUrl);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#059669" /></SafeAreaView>;
  if (!deal) return <SafeAreaView style={styles.center}><Text style={styles.errorText}>{error || 'Deal not found.'}</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <Stack.Screen options={{ title: 'Deal' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageWrap}>
          {deal.imageUrl ? <Image source={deal.imageUrl} contentFit="contain" style={styles.image} /> : <Text style={styles.muted}>No product image</Text>}
        </View>
        <Text style={styles.category}>{deal.category || 'Amazon deal'}</Text>
        <Text style={styles.title}>{deal.title}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.salePrice}>{money(deal.salePrice)}</Text>
          {deal.originalPrice > deal.salePrice ? <Text style={styles.originalPrice}>{money(deal.originalPrice)}</Text> : null}
          <Text style={styles.discount}>{Math.round(deal.discountPercent)}% off</Text>
        </View>
        <View style={styles.factBox}>
          <Text style={styles.factTitle}>Verified deal facts</Text>
          <Text style={styles.factText}>ASIN {deal.asin}</Text>
          <Text style={styles.factText}>DealScout quality score {Math.round(deal.qualityScore || 0)}</Text>
          <Text style={styles.factText}>{deal.priceCheckAt ? `Price checked ${new Date(deal.priceCheckAt * 1000).toLocaleString()}` : 'Price check time unavailable'}</Text>
          <Text style={styles.disclaimer}>Final price and availability are determined on Amazon.</Text>
        </View>
        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        <Pressable disabled={!deal.productUrl} onPress={() => void openAmazon()} style={({ pressed }) => [styles.amazonButton, pressed && styles.pressed, !deal.productUrl && styles.disabled]} accessibilityRole="link">
          <Text style={styles.amazonButtonText}>View on Amazon</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void onToggleSaved()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.saveButtonText}>{busy ? 'Updating…' : saved ? '♥ Saved' : '♡ Save deal'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 18, paddingBottom: 42 },
  imageWrap: { height: 300, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', padding: 20 },
  image: { width: '100%', height: '100%' },
  category: { color: '#059669', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 22 },
  title: { color: '#0f172a', fontSize: 23, lineHeight: 30, fontWeight: '900', marginTop: 6 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },
  salePrice: { color: '#047857', fontSize: 28, fontWeight: '900' },
  originalPrice: { color: '#94a3b8', fontSize: 14, textDecorationLine: 'line-through' },
  discount: { color: '#047857', backgroundColor: '#d1fae5', fontSize: 12, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  factBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 15, marginTop: 20, gap: 5 },
  factTitle: { color: '#334155', fontWeight: '900', fontSize: 14, marginBottom: 3 },
  factText: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  disclaimer: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 5 },
  amazonButton: { backgroundColor: '#0f172a', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  amazonButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  saveButton: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#334155', fontWeight: '900', fontSize: 14 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
  muted: { color: '#94a3b8' },
  errorBox: { color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginTop: 14 },
  errorText: { color: '#b91c1c', textAlign: 'center' },
});
