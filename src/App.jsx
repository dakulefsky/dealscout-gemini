import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { BookmarksProvider } from '@/lib/BookmarksContext';
import Layout from '@/components/Layout';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
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

function RouteFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16" role="status" aria-live="polite">
      <div className="max-w-md mx-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
        <div className="mt-4 h-3 w-full rounded bg-slate-100 animate-pulse" />
        <div className="mt-2 h-3 w-4/5 rounded bg-slate-100 animate-pulse" />
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
                  <Route path="*" element={<Navigate to="/" replace />} />
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
