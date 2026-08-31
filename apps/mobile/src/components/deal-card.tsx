import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Deal } from '@/lib/api';

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${deal.title}, ${money(deal.salePrice)}, ${deal.discountPercent}% off`}
      onPress={() => router.push({ pathname: '/deal/[id]', params: { id: deal.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        {deal.imageUrl ? (
          <Image source={deal.imageUrl} contentFit="contain" transition={120} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}><Text style={styles.imageFallbackText}>DealScout</Text></View>
        )}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{deal.title}</Text>
        <Text numberOfLines={1} style={styles.category}>{deal.category || 'Amazon deal'}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.salePrice}>{money(deal.salePrice)}</Text>
          {deal.originalPrice > deal.salePrice ? <Text style={styles.originalPrice}>{money(deal.originalPrice)}</Text> : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.discount}>{Math.round(deal.discountPercent)}% off</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    flexDirection: 'row',
    minHeight: 150,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.995 }] },
  imageWrap: { width: 136, backgroundColor: '#f8fafc', padding: 12, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 126 },
  imageFallback: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  imageFallbackText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  body: { flex: 1, padding: 14 },
  title: { color: '#0f172a', fontSize: 15, fontWeight: '800', lineHeight: 20 },
  category: { color: '#64748b', fontSize: 12, marginTop: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 11 },
  salePrice: { color: '#047857', fontSize: 19, fontWeight: '900' },
  originalPrice: { color: '#94a3b8', textDecorationLine: 'line-through', fontSize: 12 },
  footer: { marginTop: 'auto', paddingTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discount: { alignSelf: 'flex-start', overflow: 'hidden', color: '#047857', backgroundColor: '#ecfdf5', fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chevron: { color: '#94a3b8', fontSize: 24, lineHeight: 24 },
});
