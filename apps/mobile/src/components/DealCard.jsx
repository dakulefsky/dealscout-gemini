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

function checkedLabel(timestamp, now = Date.now()) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const ageSeconds = Math.max(0, Math.floor((now - seconds * 1000) / 1000));
  if (ageSeconds < 60) return 'CHECKED NOW';
  if (ageSeconds < 3600) return `CHECKED ${Math.floor(ageSeconds / 60)}M`;
  if (ageSeconds < 86400) return `CHECKED ${Math.floor(ageSeconds / 3600)}H`;
  return `CHECKED ${Math.floor(ageSeconds / 86400)}D`;
}

export default function DealCard({ deal, onSave, onOpen, onDismiss, saved = false }) {
  const id = deal?.id || deal?.asin;
  const salePrice = field(deal, 'salePrice', 'sale_price');
  const originalPrice = field(deal, 'originalPrice', 'original_price');
  const discount = Number(field(deal, 'discountPercent', 'discount_percent') || 0);
  const imageUrl = field(deal, 'imageUrl', 'image_url');
  const checked = checkedLabel(field(deal, 'priceCheckAt', 'price_check_at'));

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
          {discount > 0 && <Text style={styles.discount}>{Math.round(discount)}% OFF</Text>}
          <Text numberOfLines={2} style={styles.title}>{deal?.title || 'Amazon deal'}</Text>
          <View style={styles.priceRow}>
            {money(salePrice) && <Text style={styles.sale}>{money(salePrice)}</Text>}
            {money(originalPrice) && Number(originalPrice) > Number(salePrice) && <Text style={styles.original}>{money(originalPrice)}</Text>}
          </View>
          {checked && <Text style={styles.checked}>{checked}</Text>}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Not interested in ${deal?.title || 'deal'}`}
          onPress={() => onDismiss?.(deal)}
          style={styles.dismissButton}
        >
          <Text style={styles.dismissText}>Not interested</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderTopWidth: 2, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#c9d0cb', overflow: 'hidden', backgroundColor: '#fff' },
  image: { width: '100%', aspectRatio: 1.25, backgroundColor: '#f7f5ef' },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  discount: { alignSelf: 'flex-start', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: '#064e3b', backgroundColor: '#dcebdc', paddingHorizontal: 6, paddingVertical: 3, marginBottom: 7 },
  title: { minHeight: 38, color: '#0f172a', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 8 },
  sale: { fontSize: 17, color: '#0f172a', fontWeight: '900' },
  original: { fontSize: 12, color: '#94a3b8', textDecorationLine: 'line-through' },
  checked: { marginTop: 6, fontSize: 9, letterSpacing: 0.7, fontWeight: '900', color: '#64748b' },
  actions: { flexDirection: 'row', gap: 7, marginHorizontal: 10, marginBottom: 10 },
  dismissButton: { flex: 1.3, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#d7ded8', backgroundColor: '#fff' },
  dismissText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  saveButton: { flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: '#f3efe5' },
  saveText: { fontSize: 12, fontWeight: '800', color: '#334155' },
});
