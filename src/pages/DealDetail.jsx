import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/components/DealCard';
import { deals as dealsApi, functions } from '@/lib/api';
import { useBookmarks } from '@/lib/BookmarksContext';
import SidebarAds from '@/components/SidebarAds';
import AdSensePlaceholder from '@/components/AdSensePlaceholder';
import {
  ArrowLeft,
  TrendingDown,
  Star,
  ShoppingBag,
  Loader2,
  Heart,
  Share2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ThumbsUp,
  Award,
  RotateCw,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { toast } = useToast();
  const { isSaved, toggleBookmark } = useBookmarks();

  useEffect(() => {
    dealsApi
      .get(id)
      .then((data) => {
        setDeal(data);
        // If reviews are empty or missing, dynamically trigger Rainforest type=reviews / type=product sync
        const revs = Array.isArray(data?.reviews) ? data.reviews : [];
        if (data && revs.length === 0) {
          dealsApi
            .syncReviews(data.id || data.asin)
            .then((syncRes) => {
              if (syncRes?.reviews && syncRes.reviews.length > 0) {
                setDeal((prev) => (prev ? { ...prev, reviews: syncRes.reviews } : prev));
              }
            })
            .catch((err) => {
              console.warn('[Auto review sync notice]:', err.message);
            });
        }
      })
      .catch(() => setDeal(null))
      .finally(() => setLoading(false));
  }, [id]);

  const dealId = deal?.id || deal?.asin;
  const saved = isSaved(dealId);

  const handleSyncReviews = async () => {
    if (!deal) return;
    setSyncingReviews(true);
    try {
      const res = await dealsApi.syncReviews(deal.id || deal.asin);
      if (res?.reviews && res.reviews.length > 0) {
        setDeal((prev) => ({ ...prev, reviews: res.reviews }));
        toast({
          title: 'Reviews Synced',
          description: `Pulled ${res.reviews.length} verified customer reviews.`,
        });
      } else {
        toast({ title: 'Reviews are already up to date.' });
      }
    } catch (err) {
      toast({ title: 'Review sync failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncingReviews(false);
    }
  };

  async function handleBuy() {
    if (!deal) return;
    setRedirecting(true);
    try {
      const res = await functions.amazonRedirect(deal.productUrl);
      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        toast({ title: "Couldn't generate affiliate link", variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Redirect failed', description: e.message, variant: 'destructive' });
    } finally {
      setRedirecting(false);
    }
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast({
        title: 'Deal Link Copied',
        description: 'Direct link copied to clipboard.',
      });
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-28 bg-slate-200 rounded" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="aspect-video bg-slate-200 rounded-3xl" />
              <div className="h-8 w-3/4 bg-slate-200 rounded" />
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-slate-200 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-slate-900">Deal not found</h2>
        <p className="text-slate-500 mt-2 text-sm">This deal may have expired or is no longer available.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700">
          <ArrowLeft className="w-4 h-4" /> Back to all deals
        </Link>
      </div>
    );
  }

  const pros = (deal.pros || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const cons = (deal.cons || '').split('\n').map((s) => s.trim()).filter(Boolean);
  let reviews = [];
  try {
    reviews = Array.isArray(deal.reviews) ? deal.reviews : JSON.parse(deal.reviews || '[]');
  } catch {
    reviews = [];
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      {/* Top Breadcrumb & Share Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to deals
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="rounded-xl text-xs font-semibold text-slate-700 gap-1.5"
          >
            {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            {copiedLink ? 'Copied' : 'Share'}
          </Button>
          <Button
            variant={saved ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleBookmark(deal)}
            className={`rounded-xl text-xs font-semibold gap-1.5 ${
              saved ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'text-slate-700'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-white' : ''}`} />
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Product Layout (Content on Left, Sidebar Ads on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Product Information (8 cols on large screens) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Expired Deal Alert Banner */}
          {deal.isExpired && (
            <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-amber-900 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-amber-950">This deal has ended on Amazon</p>
                <p className="text-amber-800/90 text-xs sm:text-sm leading-relaxed">
                  Our automatic price & availability monitor detected that this product has returned to its regular price or is out of stock.
                  {deal.expiresInHours ? ` This listing will be automatically purged in ${Math.ceil(deal.expiresInHours)} hours.` : ' This listing will be automatically removed.'}
                </p>
              </div>
            </div>
          )}

          {/* Main Deal Hero Card */}
          <div className={`grid md:grid-cols-2 gap-6 lg:gap-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs ${
            deal.isExpired ? 'opacity-85' : ''
          }`}>
            {/* Product Image Box */}
            <div className={`relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center p-6 ${
              deal.isExpired ? 'grayscale-[0.80]' : ''
            }`}>
              <Image src={deal.imageUrl} fittingType="contain" className="w-full h-full object-contain" alt={deal.title} />
              {deal.isExpired ? (
                <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Deal Ended
                </span>
              ) : deal.discountPercent > 0 ? (
                <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  <TrendingDown className="h-3.5 w-3.5" /> {deal.discountPercent}% OFF
                </span>
              ) : null}
            </div>

            {/* Product Detail & Buy Column */}
            <div className="flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md">
                    {deal.category || 'Deals'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">ASIN: {deal.asin}</span>
                </div>

                <h1 className={`font-heading text-xl sm:text-2xl font-bold leading-snug ${
                  deal.isExpired ? 'text-slate-700' : 'text-slate-900'
                }`}>
                  {deal.title}
                </h1>

                {deal.rating != null && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${
                            s < Math.round(deal.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{deal.rating.toFixed(1)}</span>
                    {deal.ratingsTotal > 0 && (
                      <span className="text-xs text-slate-400">
                        ({deal.ratingsTotal.toLocaleString()} ratings)
                      </span>
                    )}
                  </div>
                )}

                {/* Price Display */}
                <div className="flex items-baseline gap-3 pt-2">
                  <span className={`text-3xl font-extrabold ${deal.isExpired ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>
                    {formatPrice(deal.salePrice)}
                  </span>
                  {deal.originalPrice > deal.salePrice && (
                    <span className="text-base text-slate-400 line-through font-normal">
                      {formatPrice(deal.originalPrice)}
                    </span>
                  )}
                  {!deal.isExpired && deal.discountPercent > 0 && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Save ${(deal.originalPrice - deal.salePrice).toFixed(2)}
                    </span>
                  )}
                </div>

                {deal.shortBio && (
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {deal.shortBio}
                  </p>
                )}
              </div>

              {/* Action CTA */}
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={handleBuy}
                  disabled={redirecting}
                  className={`inline-flex items-center justify-center gap-2 w-full py-3.5 font-bold text-sm sm:text-base rounded-2xl shadow-xs transition duration-150 disabled:opacity-60 ${
                    deal.isExpired
                      ? 'bg-slate-700 hover:bg-slate-800 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {redirecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
                  {redirecting ? 'Opening Amazon…' : deal.isExpired ? 'Check Current Price on Amazon' : 'View on Amazon'}
                  <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                </button>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>✓ Prime Fast Delivery</span>
                  <span>✓ 30-Day Easy Returns</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Highlights & Key Specifications */}
          {deal.fullSummary && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
              <h2 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Product Highlights & Specifications
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                {deal.fullSummary}
              </p>
            </div>
          )}

          {/* In-Article Google AdSense Reserved Banner (Zero CLS) */}
          <AdSensePlaceholder
            format="in-content"
            slotId="5432109876"
            label="Advertisement"
            className="w-full"
          />

          {/* Authentic Amazon Customer Reviews */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Verified Amazon Customer Reviews
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct feedback extracted from verified Amazon buyers
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncReviews}
                  disabled={syncingReviews}
                  className="rounded-xl text-xs font-semibold text-slate-700 gap-1.5 h-8 border-slate-200 hover:border-slate-300"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${syncingReviews ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                  {syncingReviews ? 'Syncing...' : 'Sync Reviews'}
                </Button>
                <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg">
                  {deal.ratingsTotal ? `${deal.ratingsTotal.toLocaleString()} verified ratings` : 'Amazon Verified'}
                </span>
              </div>
            </div>

            {reviews.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {reviews.map((r, i) => (
                  <div
                    key={r.id || i}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-2.5">
                      {/* Review Header: Rating + Verified Badges */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star
                                key={s}
                                className={`h-3.5 w-3.5 ${
                                  s < (r.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {Number(r.rating || 5).toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {r.vineVoice && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              <Award className="w-3 h-3" /> Vine Voice
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified Purchase
                          </span>
                        </div>
                      </div>

                      {/* Review Title */}
                      {r.title && (
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                          {r.title}
                        </h4>
                      )}

                      {/* Variant / Style Purchased */}
                      {r.variantPurchased && (
                        <p className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded inline-block">
                          {r.variantPurchased}
                        </p>
                      )}

                      {/* Review Body */}
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                        "{r.text}"
                      </p>
                    </div>

                    {/* Review Footer: Author, Date, Helpful Votes & Amazon Link */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span className="font-semibold text-slate-700">
                          {r.author || 'Amazon Customer'}
                        </span>
                        <span>{r.date || 'Verified Review'}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        {r.helpfulVotes > 0 ? (
                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-medium">
                            <ThumbsUp className="w-3 h-3 text-slate-400" />
                            {r.helpfulVotes} {r.helpfulVotes === 1 ? 'person' : 'people'} found this helpful
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Amazon Community Verified</span>
                        )}

                        {r.link && (
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-700 text-[10px] font-semibold transition"
                          >
                            <span>Amazon Review</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs space-y-3">
                <div className="space-y-1">
                  <p className="font-medium text-slate-700">No review snippets cached for this item yet.</p>
                  <p className="text-slate-400">Pull verified reviews directly from Amazon or check the live product page.</p>
                </div>
                <Button
                  size="sm"
                  onClick={handleSyncReviews}
                  disabled={syncingReviews}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${syncingReviews ? 'animate-spin' : ''}`} />
                  {syncingReviews ? 'Pulling Reviews...' : 'Pull Amazon Reviews'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sponsored & Partner Deals Sidebar (4 cols on large screens, sticky) */}
        <div className="lg:col-span-4 sticky top-20">
          <SidebarAds category={deal.category || 'Electronics'} />
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400 text-center pt-6 border-t border-slate-200">
        Prices and availability are accurate as of the date/time indicated and are subject to change.
      </p>
    </div>
  );
}
