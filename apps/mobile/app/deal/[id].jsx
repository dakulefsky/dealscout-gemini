import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookmarks, deals } from '../../src/api';
import { addCategoryInterest } from '../../src/personalization';

function field(deal, camel, snake) {
  return deal?.[camel] ?? deal?.[snake];
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : null;
}

export default function DealDetailScreen() {
  const params = useLocalSearchParams();
  const id = useMemo(() => String(Array.isArray(params.id) ? params.id[0] : params.id || ''), [params.id]);
  const [deal, setDeal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      deals.get(id, { signal: controller.signal }),
      bookmarks.list().catch(() => ({ bookmarkIds: [] })),
    ])
      .then(([nextDeal, savedResult]) => {
        if (controller.signal.aborted) return;
        setDeal(nextDeal);
        setSaved((savedResult?.bookmarkIds || []).map(String).includes(id));
      })
      .catch((err) => { if (err?.name !== 'AbortError') setError(err?.message || 'Could not load this deal'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  async function toggleSave() {
    if (!id) return;
    const previous = saved;
    setSaved(!previous);
    try {
      const result = await bookmarks.toggle(id);
      const nextSaved = Boolean(result?.isSaved);
      setSaved(nextSaved);
      if (nextSaved && deal?.category) await addCategoryInterest(deal.category, 4);
    } catch {
      setSaved(previous);
    }
  }

  async function openAmazon() {
    const url = field(deal, 'productUrl', 'product_url');
    if (!url || !/^https:\/\//i.test(url)) return;
    const supported = await Linking.canOpenURL(url);
    if (!supported) return;
    await Linking.openURL(url);
    if (deal?.category) await addCategoryInterest(deal.category, 3);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (error || !deal) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Deal not found'}</Text></SafeAreaView>;

  const salePrice = field(deal, 'salePrice', 'sale_price');
  const originalPrice = field(deal, 'originalPrice', 'original_price');
  const discount = Number(field(deal, 'discountPercent', 'discount_percent') || 0);
  const imageUrl = field(deal, 'imageUrl', 'image_url');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageWrap}>
          <Image source={imageUrl ? { uri: imageUrl } : undefined} style={styles.image} contentFit="contain" transition={150} />
        </View>
        <View style={styles.body}>
          {discount > 0 && <Text style={styles.discount}>{Math.round(discount)}% OFF</Text>}
          <Text style={styles.title}>{deal.title}</Text>
          <View style={styles.priceRow}>
            {money(salePrice) && <Text style={styles.sale}>{money(salePrice)}</Text>}
            {money(originalPrice) && Number(originalPrice) > Number(salePrice) && <Text style={styles.original}>{money(originalPrice)}</Text>}
          </View>
          {deal.category && <Text style={styles.category}>{deal.category}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved deals' : 'Save deal'} onPress={toggleSave} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel={`View ${deal.title} on Amazon`} onPress={openAmazon} style={styles.primaryButton}>
              <Text style={styles.primaryText}>View on Amazon</Text>
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>Price and availability can change on Amazon.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  error: { color: '#b91c1c', fontWeight: '700', textAlign: 'center' },
  content: { paddingBottom: 28 },
  imageWrap: { backgroundColor: '#fff', padding: 18 },
  image: { width: '100%', aspectRatio: 1.2 },
  body: { padding: 18 },
  discount: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '900', color: '#047857', backgroundColor: '#ecfdf5', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, marginBottom: 10 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', color: '#0f172a' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 14 },
  sale: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  original: { fontSize: 15, color: '#94a3b8', textDecorationLine: 'line-through' },
  category: { marginTop: 10, color: '#64748b', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  secondaryButton: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#e2e8f0', alignItems: 'center' },
  secondaryText: { color: '#334155', fontWeight: '900' },
  primaryButton: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  disclaimer: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 12 },
});
