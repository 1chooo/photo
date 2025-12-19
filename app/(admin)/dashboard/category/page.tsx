'use client';

import { useAuth } from '@/lib/firebase/useAuth';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Tag, Pin, Check, Image as ImageIcon, Layers, Edit2, CheckSquare, Square } from 'lucide-react';
import Image from 'next/image';

interface UploadedImage {
  id: string;
  url: string;
  file_id: string;
  file_name: string;
  file_size: number;
  file_type?: string;
  uploaded_by?: string;
  uploaded_at: string;
  alt?: string;
}

interface CategoryInfo {
  slug: string;
  images: {
    id: string;
    url: string;
    file_name: string;
    alt?: string;
    variant: 'original' | 'square';
    uploaded_at: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface UploadedImageWithCategory extends UploadedImage {
  slug?: string;
  variant?: 'original' | 'square';
}

interface SelectedPhoto {
  photoId: string;
  order: number;
}

// --- Fetcher (保持不變) ---
const fetcher = async (url: string) => {
  const auth = (await import('firebase/auth')).getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function CategoryManagementPage() {
  const { user } = useAuth();
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [variantInput, setVariantInput] = useState<'original' | 'square'>('original');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'uncategorized' | 'categorized'>('uncategorized');
  
  // Batch selection states
  const [batchMode, setBatchMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [batchSlugInput, setBatchSlugInput] = useState('');
  const [batchSelectedSlug, setBatchSelectedSlug] = useState('');
  const [batchVariantInput, setBatchVariantInput] = useState<'original' | 'square'>('original');

  // --- Data Fetching (保持不變) ---
  const { data: imagesData, isLoading: imagesLoading } = useSWR<{ images: UploadedImage[] }>(
    user ? '/api/telegram/images' : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const { data: categoriesData } = useSWR<{ categories: CategoryInfo[] }>(
    user ? '/api/telegram/category' : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const { data: homepageData } = useSWR<{ selectedPhotos: SelectedPhoto[] }>(
    user ? '/api/homepage' : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const uploadedImages = imagesData?.images || [];
  const categories = categoriesData?.categories || [];
  const selectedPhotos = homepageData?.selectedPhotos || [];

  // --- Data Processing (保持不變) ---
  const categoryMap = new Map<string, { slug: string; variant: 'original' | 'square' }>();
  categories.forEach(category => {
    category.images?.forEach(img => {
      categoryMap.set(img.id, {
        slug: category.slug,
        variant: img.variant,
      });
    });
  });

  const imagesWithCategory: UploadedImageWithCategory[] = uploadedImages.map(img => {
    const category = categoryMap.get(img.id);
    return {
      ...img,
      slug: category?.slug,
      variant: category?.variant,
    };
  });

  const uncategorizedImages = imagesWithCategory.filter(img => !img.slug);
  const categorizedImages = imagesWithCategory.filter(img => img.slug);

  const imagesBySlug = categorizedImages.reduce((acc, img) => {
    if (!img.slug) return acc;
    if (!acc[img.slug]) acc[img.slug] = [];
    acc[img.slug].push(img);
    return acc;
  }, {} as Record<string, UploadedImage[]>);

  const existingSlugs = categories.map(cat => cat.slug).sort();

  // --- Handlers (保持不變) ---
  const handleUpdateSlug = async (imageId: string, newSlug: string) => {
    if (!user) return;
    const finalSlug = slugInput.trim() || selectedSlug;
    if (!finalSlug) {
      alert('請選擇或輸入一個 slug');
      return;
    }
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/telegram/category', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: imageId,
          slug: finalSlug,
          variant: variantInput,
        }),
      });
      if (!response.ok) throw new Error('Failed to update slug');
      await mutate('/api/telegram/images');
      await mutate('/api/telegram/category');
      setEditingImageId(null);
      setSlugInput('');
      setSelectedSlug('');
      setVariantInput('original');
    } catch (error) {
      console.error('Error updating slug:', error);
      alert('更新分類失敗');
    } finally {
      setSaving(false);
    }
  };

  const handlePinToHomepage = async (imageId: string) => {
    if (!user) return;
    const isAlreadyPinned = selectedPhotos.some(sp => sp.photoId === imageId);
    let newSelected;
    if (isAlreadyPinned) {
      newSelected = selectedPhotos
        .filter(sp => sp.photoId !== imageId)
        .map((sp, index) => ({ ...sp, order: index }));
    } else {
      newSelected = [
        ...selectedPhotos,
        { photoId: imageId, order: selectedPhotos.length },
      ];
    }
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/homepage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedPhotos: newSelected }),
      });
      if (response.ok) {
        await mutate('/api/homepage');
      } else {
        alert('Failed to update homepage');
      }
    } catch (error) {
      console.error('Error updating homepage:', error);
      alert('Failed to update homepage');
    } finally {
      setSaving(false);
    }
  };

  const handleBatchUpdate = async () => {
    if (!user || selectedImages.size === 0) return;
    const finalSlug = batchSlugInput.trim() || batchSelectedSlug;
    if (!finalSlug) {
      alert('請選擇或輸入一個 slug');
      return;
    }
    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/telegram/category/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedImages),
          slug: finalSlug,
          variant: batchVariantInput,
        }),
      });
      if (!response.ok) throw new Error('Failed to batch update slug');
      await mutate('/api/telegram/images');
      await mutate('/api/telegram/category');
      setSelectedImages(new Set());
      setBatchMode(false);
      setBatchSlugInput('');
      setBatchSelectedSlug('');
      setBatchVariantInput('original');
      alert(`成功批量更新 ${selectedImages.size} 張圖片`);
    } catch (error) {
      console.error('Error batch updating slug:', error);
      alert('批量更新分類失敗');
    } finally {
      setSaving(false);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) newSet.delete(imageId);
      else newSet.add(imageId);
      return newSet;
    });
  };

  const selectAllImages = () => {
    if (activeTab === 'uncategorized') {
      setSelectedImages(new Set(uncategorizedImages.map(img => img.id)));
    } else {
      setSelectedImages(new Set(categorizedImages.map(img => img.id)));
    }
  };

  const clearSelection = () => {
    setSelectedImages(new Set());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // --- UI Components ---

  const ImageCard = ({ image }: { image: UploadedImageWithCategory }) => {
    const isEditing = editingImageId === image.id;
    const isPinned = selectedPhotos.some(sp => sp.photoId === image.id);
    const isSelected = selectedImages.has(image.id);

    return (
      <div 
        className={`group relative bg-white border rounded-xl overflow-hidden transition-all duration-200 
          ${isSelected ? 'ring-2 ring-rurikon-500 border-transparent shadow-md' : 'border-rurikon-100 hover:border-rurikon-300 hover:shadow-lg'}
        `}
      >
        {/* Batch Selection Overlay */}
        {batchMode && (
          <div 
            onClick={() => toggleImageSelection(image.id)}
            className="absolute inset-0 z-20 cursor-pointer bg-black/0 hover:bg-black/5 transition-colors"
          >
            <div className="absolute top-3 left-3">
              <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-rurikon-600 text-white' : 'bg-white/80 text-gray-400 border border-gray-300'}`}>
                 {isSelected && <Check className="w-4 h-4" />}
              </div>
            </div>
          </div>
        )}
        
        {/* Image Area */}
        <div className="relative aspect-square bg-gray-50 border-b border-gray-100">
          <Image
            src={image.url}
            alt={image.alt || image.file_name}
            fill
            className={`object-cover transition-transform duration-500 ${!isEditing && 'group-hover:scale-105'}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          {/* Status Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            {isPinned && (
              <span className="bg-green-500/90 backdrop-blur-xs text-white p-1.5 rounded-full shadow-xs" title="Pinned to Homepage">
                <Pin className="w-3 h-3" />
              </span>
            )}
            {image.slug && (
              <span className="bg-rurikon-600/90 backdrop-blur-xs text-white text-[10px] px-2 py-1 rounded-full shadow-xs max-w-25 truncate">
                {image.slug}
              </span>
            )}
          </div>
        </div>

        {/* Info and Actions Area */}
        <div className="p-4 space-y-3">
          {/* File Name & Date */}
          <div className="space-y-1 mb-2">
             <p className="text-sm font-medium text-gray-700 truncate" title={image.file_name}>
              {image.file_name}
            </p>
            <p className="text-xs text-gray-400 font-mono">{formatDate(image.uploaded_at)}</p>
          </div>

          {/* Action Area */}
          {!batchMode && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              {isEditing ? (
                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</label>
                    {existingSlugs.length > 0 && (
                      <select
                        value={selectedSlug}
                        onChange={(e) => {
                          setSelectedSlug(e.target.value);
                          if (e.target.value) setSlugInput('');
                        }}
                        className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rurikon-500 focus:border-rurikon-500 outline-hidden bg-gray-50/50"
                      >
                        <option value="">Select existing...</option>
                        {existingSlugs.map((slug) => (
                          <option key={slug} value={slug}>{slug}</option>
                        ))}
                      </select>
                    )}
                    
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => {
                        setSlugInput(e.target.value);
                        if (e.target.value) setSelectedSlug('');
                      }}
                      placeholder={existingSlugs.length > 0 ? "Or type new..." : "Type new slug..."}
                      className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rurikon-500 focus:border-rurikon-500 outline-hidden"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Variant</label>
                    <select
                      value={variantInput}
                      onChange={(e) => setVariantInput(e.target.value as 'original' | 'square')}
                      className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rurikon-500 focus:border-rurikon-500 outline-hidden bg-gray-50/50"
                    >
                      <option value="original">Original</option>
                      <option value="square">Square</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleUpdateSlug(image.id, slugInput)}
                      disabled={saving || (!slugInput.trim() && !selectedSlug)}
                      className="flex-1 bg-rurikon-600 text-white rounded-md py-1.5 text-xs hover:bg-rurikon-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingImageId(null);
                        setSlugInput('');
                        setSelectedSlug('');
                        setVariantInput('original');
                      }}
                      className="px-3 bg-gray-100 text-gray-600 rounded-md py-1.5 text-xs hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                   <button
                    onClick={() => {
                      setEditingImageId(image.id);
                      setSlugInput(image.slug || '');
                      setSelectedSlug('');
                      setVariantInput(image.variant || 'original');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-rurikon-50 hover:text-rurikon-600 transition-colors border border-transparent hover:border-rurikon-200"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Edit</span>
                  </button>

                  <button
                    onClick={() => handlePinToHomepage(image.id)}
                    disabled={saving}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors border ${
                      isPinned
                        ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                    <span className="text-xs font-medium">{isPinned ? 'Pinned' : 'Pin'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (imagesLoading) {
    return (
      <div className="pb-6 sm:pb-10 md:pb-14 w-full h-[60vh] flex items-center justify-center flex-col">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rurikon-600 mb-4"></div>
        <p className="text-gray-400 font-medium">Loading Assets...</p>
      </div>
    );
  }

  return (
    <div className="pb-6 sm:pb-10 md:pb-14">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-rurikon-800 tracking-tight">Category Management</h1>
        <div className="text-sm text-gray-500">
           Total <span className="font-semibold text-rurikon-600">{imagesWithCategory.length}</span> assets
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-rurikon-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Total Images</div>
            <div className="text-2xl font-bold text-rurikon-900">{imagesWithCategory.length}</div>
          </div>
          <div className="p-3 bg-rurikon-50 rounded-lg text-rurikon-600">
            <ImageIcon className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-rurikon-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Uncategorized</div>
            <div className="text-2xl font-bold text-orange-600">{uncategorizedImages.length}</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-rurikon-100 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Pinned to Home</div>
            <div className="text-2xl font-bold text-green-600">{selectedPhotos.length}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <Pin className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-30 backdrop-blur-md py-4 mb-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          {/* Tabs */}
          <div className="bg-gray-100/50 p-1 rounded-lg inline-flex w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('uncategorized')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'uncategorized'
                  ? 'bg-white text-rurikon-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Uncategorized
              <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                {uncategorizedImages.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('categorized')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'categorized'
                  ? 'bg-white text-rurikon-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Categorized
              <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                {categorizedImages.length}
              </span>
            </button>
          </div>
          
          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) clearSelection();
            }}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              batchMode
                ? 'bg-rurikon-600 text-white shadow-md hover:bg-rurikon-700'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-rurikon-300 hover:text-rurikon-600'
            }`}
          >
            {batchMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {batchMode ? 'Exit Batch Mode' : 'Batch Select'}
          </button>
        </div>
      </div>

      {/* Batch Action Panel */}
      {batchMode && (
        <div className="animate-in slide-in-from-top-4 duration-300 mb-8">
           <div className="bg-rurikon-50/50 border border-rurikon-100 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-6 items-end">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between border-b border-rurikon-200/50 pb-2">
                  <h3 className="font-semibold text-rurikon-800 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-rurikon-600" />
                    Batch Actions
                    <span className="bg-rurikon-100 text-rurikon-700 text-xs px-2 py-1 rounded-full ml-2">
                      {selectedImages.size} selected
                    </span>
                  </h3>
                  <div className="flex gap-4 text-sm">
                    <button
                      onClick={selectAllImages}
                      className="text-rurikon-600 hover:text-rurikon-800 font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearSelection}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Slug Group</label>
                    <select
                      value={batchSelectedSlug}
                      onChange={(e) => {
                        setBatchSelectedSlug(e.target.value);
                        if (e.target.value) setBatchSlugInput('');
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rurikon-500 outline-hidden bg-white"
                    >
                      <option value="">-- Choose Existing --</option>
                      {existingSlugs.map((slug) => (
                        <option key={slug} value={slug}>{slug}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">New Slug</label>
                    <input
                      type="text"
                      value={batchSlugInput}
                      onChange={(e) => {
                        setBatchSlugInput(e.target.value);
                        if (e.target.value) setBatchSelectedSlug('');
                      }}
                      placeholder="Create new..."
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rurikon-500 outline-hidden bg-white"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Display Variant</label>
                    <select
                      value={batchVariantInput}
                      onChange={(e) => setBatchVariantInput(e.target.value as 'original' | 'square')}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rurikon-500 outline-hidden bg-white"
                    >
                      <option value="original">Original</option>
                      <option value="square">Square</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleBatchUpdate}
                disabled={saving || selectedImages.size === 0 || (!batchSlugInput.trim() && !batchSelectedSlug)}
                className="w-full lg:w-auto px-8 py-2.5 bg-rurikon-600 text-white rounded-lg hover:bg-rurikon-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {saving ? 'Processing...' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Content */}
      <div className="min-h-100">
        {activeTab === 'uncategorized' ? (
          <div>
            {uncategorizedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <div className="bg-white p-4 rounded-full shadow-xs mb-4">
                   <Check className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
                <p className="text-gray-500 mt-1">No uncategorized images found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {uncategorizedImages.map((image) => (
                  <ImageCard key={image.id} image={image} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {Object.keys(imagesBySlug).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Tag className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-gray-500">No categorized images yet.</p>
              </div>
            ) : (
              Object.entries(imagesBySlug).map(([slug, images]) => (
                <div key={slug} className="bg-gray-50/30 rounded-xl p-4 md:p-6 border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="p-2 bg-white rounded-lg shadow-xs text-rurikon-600 border border-gray-100">
                      <Tag className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-bold text-gray-800">
                      {slug}
                    </h2>
                    <span className="bg-rurikon-100 text-rurikon-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {images.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {images.map((image) => (
                      <ImageCard key={image.id} image={image} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
