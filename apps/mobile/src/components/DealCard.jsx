import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : null;
}

function field(deal, camel, snake) {
  return deal?.[camel] ?? deal?.[snake];
}

export default function DealCard({ deal, onSave, saved = false }) {
  const id = deal?.id || deal?.asin;
  const salePrice = field(deal, 'salePrice', 'sale_price');
  const originalPrice = field(deal, 'originalPrice', 'original_price');
  const discount = Number(field(deal, 'discountPercent', 'discount_percent') || 0);
  const imageUrl = field(deal, 'imageUrl', 'image_url');

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${deal?.title || 'deal'}`}
        onPress={() => id && router.push({ pathname: '/deal/[id]', params: { id } })}
      >
        <Image source={imageUrl ? { uri: imageUrl } : undefined} style={styles.image} contentFit="contain" transition={150} />
        <View style={styles.body}>
          {discount > 0 && <Text style={styles.discount}>{Math.round(discount)}% OFF</Text>}
          <Text numberOfLines={2} style={styles.title}>{deal?.title || 'Amazon deal'}</Text>
          <View style={styles.priceRow}>
            {money(salePrice) && <Text style={styles.sale}>{money(salePrice)}</Text>}
            {money(originalPrice) && Number(originalPrice) > Number(salePrice) && <Text style={styles.original}>{money(originalPrice)}</Text>}
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? `Remove ${deal?.title || 'deal'} from saved deals` : `Save ${deal?.title || 'deal'}`}
        onPress={() => onSave?.(deal)}
        style={styles.saveButton}
      >
        <Text style={styles.saveText}>{saved ? 'Saved' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' },
  image: { width: '100%', aspectRatio: 1.25, backgroundColor: '#fff' },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  discount: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '900', color: '#047857', backgroundColor: '#ecfdf5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, marginBottom: 7 },
  title: { minHeight: 38, color: '#0f172a', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 8 },
  sale: { fontSize: 17, color: '#0f172a', fontWeight: '900' },
  original: { fontSize: 12, color: '#94a3b8', textDecorationLine: 'line-through' },
  saveButton: { marginHorizontal: 10, marginBottom: 10, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: '#f1f5f9' },
  saveText: { fontSize: 12, fontWeight: '800', color: '#334155' },
});
