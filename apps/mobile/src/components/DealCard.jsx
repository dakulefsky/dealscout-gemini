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

export default function DealCard({ deal, onSave, onOpen, onDismiss, saved = false }) {
  const id = deal?.id || deal?.asin;
  const salePrice = field(deal, 'salePrice', 'sale_price');
  const originalPrice = field(deal, 'originalPrice', 'original_price');
  const discount = Number(field(deal, 'discountPercent', 'discount_percent') || 0);
  const imageUrl = field(deal, 'imageUrl', 'image_url');

  function openDeal() {
    if (!id) return;
    onOpen?.(deal);
    router.push({ pathname: '/deal/[id]', params: { id } });
  }

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${deal?.title || 'deal'}`} onPress={openDeal}>
        <Image source={imageUrl ? { uri: imageUrl } : undefined} style={styles.image} contentFit="contain" transition={150} />
        <View style={styles.body}>
          <Text style={styles.meta}>{discount > 0 ? `${Math.round(discount)}% OFF` : (deal?.category || 'DEAL')}</Text>
          <Text numberOfLines={2} style={styles.title}>{deal?.title || 'Amazon deal'}</Text>
          <View style={styles.priceRow}>
            {money(salePrice) && <Text style={styles.sale}>{money(salePrice)}</Text>}
            {money(originalPrice) && Number(originalPrice) > Number(salePrice) && <Text style={styles.original}>{money(originalPrice)}</Text>}
          </View>
        </View>
      </Pressable>
      {(onDismiss || onSave) && (
        <View style={styles.actions}>
          {onDismiss && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Not interested in ${deal?.title || 'deal'}`} onPress={() => onDismiss(deal)} style={styles.dismissButton}>
              <Text style={styles.dismissText}>Not interested</Text>
            </Pressable>
          )}
          {onSave && (
            <Pressable accessibilityRole="button" accessibilityLabel={saved ? `Remove ${deal?.title || 'deal'} from saved deals` : `Save ${deal?.title || 'deal'}`} onPress={() => onSave(deal)} style={styles.saveButton}>
              <Text style={styles.saveText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderColor: '#d8d2c5', overflow: 'hidden', backgroundColor: '#fff' },
  image: { width: '100%', aspectRatio: 1.2, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e4dfd5' },
  body: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 11 },
  meta: { fontSize: 9, letterSpacing: 1, fontWeight: '900', color: '#166534', marginBottom: 6, textTransform: 'uppercase' },
  title: { minHeight: 38, color: '#17201b', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 8 },
  sale: { fontSize: 18, color: '#17201b', fontWeight: '900' },
  original: { fontSize: 12, color: '#8b857a', textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e4dfd5' },
  dismissButton: { flex: 1.3, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  dismissText: { fontSize: 10, fontWeight: '800', color: '#716b61' },
  saveButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#e4dfd5', backgroundColor: '#f7f4ec' },
  saveText: { fontSize: 11, fontWeight: '900', color: '#174b32' },
});
