import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { BookmarksProvider } from '@/lib/BookmarksContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';

import Home from '@/pages/Home';
import CategoryPage from '@/pages/CategoryPage';
import DealDetail from '@/pages/DealDetail';
import SavedDeals from '@/pages/SavedDeals';
import Disclosure from '@/pages/Disclosure';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import AdminHome from '@/pages/AdminHome';
import EditorialReview from '@/pages/EditorialReview';

export default function App() {
  return (
    <AuthProvider>
      <BookmarksProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/deal/:id" element={<DealDetail />} />
              <Route path="/saved" element={<SavedDeals />} />
              <Route path="/disclosure" element={<Disclosure />} />

              <Route path="/admin/access" element={<Login />} />
              <Route path="/admin/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminHome /></ProtectedRoute>} />
              <Route path="/admin/editorial" element={<ProtectedRoute adminOnly><EditorialReview /></ProtectedRoute>} />
              <Route path="/admin/operations" element={<Navigate to="/admin" replace />} />

              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/forgot-password" element={<Navigate to="/admin/access" replace />} />
              <Route path="/reset-password" element={<Navigate to="/admin/reset-password" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          <Toaster />
        </BrowserRouter>
      </BookmarksProvider>
    </AuthProvider>
  );
}
