import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { BookmarksProvider } from '@/lib/BookmarksContext';
import Layout from '@/components/Layout';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminOperationsControls from '@/components/AdminOperationsControls';
import { Toaster } from '@/components/ui/toaster';
import Home from '@/pages/Home';

const CategoryPage = lazy(() => import('@/pages/CategoryPage'));
const DealDetail = lazy(() => import('@/pages/DealDetail'));
const SavedDeals = lazy(() => import('@/pages/SavedDeals'));
const Disclosure = lazy(() => import('@/pages/Disclosure'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Support = lazy(() => import('@/pages/Support'));
const Login = lazy(() => import('@/pages/Login'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AdminHome = lazy(() => import('@/pages/AdminHome'));
const AddDeal = lazy(() => import('@/pages/AddDeal'));
const EditorialReview = lazy(() => import('@/pages/EditorialReview'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function RouteFallback() {
  return (
    <div className="ds-shell py-16 sm:py-20" role="status" aria-live="polite">
      <div className="max-w-3xl border-y border-emerald-950/10 py-10">
        <div className="h-2.5 w-24 bg-stone-200 animate-pulse" />
        <div className="mt-5 h-8 w-3/5 bg-stone-200 animate-pulse" />
        <div className="mt-4 h-3 w-full max-w-xl bg-stone-100 animate-pulse" />
        <div className="mt-2 h-3 w-4/5 max-w-lg bg-stone-100 animate-pulse" />
        <span className="sr-only">Loading page</span>
      </div>
    </div>
  );
}

function LegacyResetRedirect() {
  const location = useLocation();
  return <Navigate to={`/admin/reset-password${location.search}`} replace />;
}

function AdminDashboard() {
  return (
    <>
      <AdminOperationsControls />
      <AdminHome />
      <Link
        to="/admin/add-deal"
        className="fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-xl shadow-emerald-900/20 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        aria-label="Add a deal"
      >
        <span className="text-lg leading-none">+</span> Add deal
      </Link>
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BookmarksProvider>
          <BrowserRouter>
            <Layout>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/category/:slug" element={<CategoryPage />} />
                  <Route path="/deal/:id" element={<DealDetail />} />
                  <Route path="/saved" element={<SavedDeals />} />
                  <Route path="/disclosure" element={<Disclosure />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/support" element={<Support />} />

                  <Route path="/admin/access" element={<Login />} />
                  <Route path="/admin/reset-password" element={<ResetPassword />} />
                  <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/add-deal" element={<ProtectedRoute adminOnly><AddDeal /></ProtectedRoute>} />
                  <Route path="/admin/editorial" element={<ProtectedRoute adminOnly><EditorialReview /></ProtectedRoute>} />
                  <Route path="/admin/operations" element={<Navigate to="/admin" replace />} />

                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="/register" element={<Navigate to="/" replace />} />
                  <Route path="/forgot-password" element={<Navigate to="/admin/access" replace />} />
                  <Route path="/reset-password" element={<LegacyResetRedirect />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </Layout>
            <Toaster />
          </BrowserRouter>
        </BookmarksProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
