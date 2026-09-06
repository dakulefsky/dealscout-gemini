import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DealCard from '../../src/components/DealCard';
import { bookmarks, deals, functions } from '../../src/api';
import { isAmazonOwnedUrl } from '../../src/amazonUrl';
import { addCategoryInterest, loadInterests } from '../../src/personalization';
import { personalizedRank } from '../../../../src/lib/personalizationCore';

function field(deal, camel, snake) {
  return deal?.[camel] ?? deal?.[snake];
}

function idOf(deal) {
  return String(deal?.id || deal?.asin || '');
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : null;
}

function isEnded(deal) {
  return Boolean(field(deal, 'isExpired', 'is_expired')) || String(deal?.status || '').toUpperCase() === 'EXPIRED';
}

function recommendationScore(candidate, current, interests) {
  const category = String(candidate?.category || '').trim();
  const sameCategory = category && category === String(current?.category || '').trim() ? 1000 : 0;
  const interest = Number(interests?.[category] || 0) * 20;
  const quality = Number(field(candidate, 'qualityScore', 'quality_score') || 0);
  const discount = Number(field(candidate, 'discountPercent', 'discount_percent') || 0);
  return sameCategory + interest + quality + discount;
}

export default function DealDetailScreen() {
  const params = useLocalSearchParams();
  const id = useMemo(() => String(Array.isArray(params.id) ? params.id[0] : params.id || ''), [params.id]);
  const [deal, setDeal] = useState(null);
  const [saved, setSaved] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
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
      .then(async ([nextDeal, savedResult]) => {
        if (controller.signal.aborted) return;
        setDeal(nextDeal);
        setSaved((savedResult?.bookmarkIds || []).map(String).includes(id));

        try {
          const [feedResult, interests] = await Promise.all([
            deals.page({ limit: 24, sort: 'discount_desc' }),
            loadInterests(),
          ]);
          if (controller.signal.aborted) return;
          const rows = feedResult?.deals || feedResult?.items || feedResult?.data || [];
          const eligible = rows.filter((candidate) => idOf(candidate) && idOf(candidate) !== id && !isEnded(candidate));
          const personalized = personalizedRank(eligible, interests || {});
          const ranked = [...personalized].sort((a, b) => recommendationScore(b, nextDeal, interests) - recommendationScore(a, nextDeal, interests));
          const count = Math.min(8, ranked.length - (ranked.length % 2));
          setRecommendations(count >= 2 ? ranked.slice(0, count) : []);
        } catch {
          setRecommendations([]);
        }
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
    const storedUrl = field(deal, 'productUrl', 'product_url');
    if (!isAmazonOwnedUrl(storedUrl)) return;

    let targetUrl = storedUrl;
    try {
      const result = await functions.amazonRedirect(storedUrl);
      if (isAmazonOwnedUrl(result?.redirectUrl)) targetUrl = result.redirectUrl;
    } catch {
      // Keep the shopper path usable if the formatter endpoint is temporarily unavailable.
    }

    const supported = await Linking.canOpenURL(targetUrl);
    if (!supported) return;
    await Linking.openURL(targetUrl);
    if (deal?.category) await addCategoryInterest(deal.category, 3);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (error || !deal) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error || 'Deal not found'}</Text></SafeAreaView>;

  const salePrice = field(deal, 'salePrice', 'sale_price');
  const originalPrice = field(deal, 'originalPrice', 'original_price');
  const discount = Number(field(deal, 'discountPercent', 'discount_percent') || 0);
  const imageUrl = field(deal, 'imageUrl', 'image_url');
  const savings = Number(originalPrice) > Number(salePrice) ? Number(originalPrice) - Number(salePrice) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageWrap}>
          <Image source={imageUrl ? { uri: imageUrl } : undefined} style={styles.image} contentFit="contain" transition={150} />
        </View>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>DEALSCOUT PICK</Text>
          <Text style={styles.title}>{deal.title}</Text>
          <View style={styles.priceRow}>
            {money(salePrice) && <Text style={styles.sale}>{money(salePrice)}</Text>}
            {money(originalPrice) && Number(originalPrice) > Number(salePrice) && <Text style={styles.original}>{money(originalPrice)}</Text>}
          </View>
          <View style={styles.facts}>
            {discount > 0 && <View style={styles.fact}><Text style={styles.factLabel}>DISCOUNT</Text><Text style={styles.factValue}>{Math.round(discount)}% off</Text></View>}
            {savings > 0 && <View style={styles.fact}><Text style={styles.factLabel}>YOU SAVE</Text><Text style={styles.factValue}>{money(savings)}</Text></View>}
            {deal.category && <View style={styles.fact}><Text style={styles.factLabel}>CATEGORY</Text><Text style={styles.factValue} numberOfLines={1}>{deal.category}</Text></View>}
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved deals' : 'Save deal'} onPress={toggleSave} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel={`View ${deal.title} on Amazon`} onPress={openAmazon} style={styles.primaryButton}>
              <Text style={styles.primaryText}>View deal on Amazon</Text>
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>Price and availability can change on Amazon.</Text>
        </View>

        {recommendations.length > 0 && (
          <View style={styles.recommendations}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionEyebrow}>KEEP SCOUTING</Text>
                <Text style={styles.sectionTitle}>More deals you might like</Text>
                <Text style={styles.sectionSubtitle}>Live deals, with similar categories and your interests ranked first.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Browse all deals" onPress={() => router.push('/')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {recommendations.map((item) => (
                <View key={idOf(item)} style={styles.cardWrap}>
                  <DealCard deal={item} onPress={() => router.push(`/deal/${idOf(item)}`)} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f4ec' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f7f4ec' },
  error: { color: '#991b1b', fontWeight: '700', textAlign: 'center' },
  content: { paddingBottom: 36 },
  imageWrap: { backgroundColor: '#fff', padding: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d8d2c5' },
  image: { width: '100%', aspectRatio: 1.15 },
  body: { paddingHorizontal: 20, paddingVertical: 24 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: '900', color: '#166534', marginBottom: 9 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#17201b' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 16 },
  sale: { fontSize: 32, fontWeight: '900', color: '#17201b' },
  original: { fontSize: 15, color: '#827d72', textDecorationLine: 'line-through' },
  facts: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#cfc8ba', marginTop: 22, paddingVertical: 14 },
  fact: { flex: 1, paddingRight: 8 },
  factLabel: { fontSize: 9, letterSpacing: 1.1, fontWeight: '900', color: '#7b756a', marginBottom: 4 },
  factValue: { fontSize: 13, fontWeight: '800', color: '#253028' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  secondaryButton: { flex: 1, paddingVertical: 15, borderWidth: 1, borderColor: '#1f4d36', backgroundColor: '#f7f4ec', alignItems: 'center' },
  secondaryText: { color: '#1f4d36', fontWeight: '900' },
  primaryButton: { flex: 2, paddingVertical: 15, backgroundColor: '#174b32', alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  disclaimer: { color: '#827d72', fontSize: 11, textAlign: 'center', marginTop: 12 },
  recommendations: { paddingHorizontal: 16, paddingTop: 26, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#cfc8ba' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  sectionCopy: { flex: 1 },
  sectionEyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: '900', color: '#166534', marginBottom: 5 },
  sectionTitle: { fontSize: 23, lineHeight: 28, fontWeight: '900', color: '#17201b' },
  sectionSubtitle: { marginTop: 5, fontSize: 12, lineHeight: 17, color: '#746f65' },
  seeAll: { color: '#174b32', fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cardWrap: { width: '50%', paddingHorizontal: 5, marginBottom: 12 },
});
