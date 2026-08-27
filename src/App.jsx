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
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Admin from '@/pages/Admin';
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
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/editorial"
                element={
                  <ProtectedRoute adminOnly>
                    <EditorialReview />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
          <Toaster />
        </BrowserRouter>
      </BookmarksProvider>
    </AuthProvider>
  );
}
