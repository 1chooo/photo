'use client';

import { useAuth } from '@/lib/firebase/useAuth';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Tag, Pin, X, Check, Image as ImageIcon } from 'lucide-react';
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

  // 獲取所有 telegram 圖片
  const { data: imagesData, isLoading: imagesLoading } = useSWR<{ images: UploadedImage[] }>(
    user ? '/api/telegram/images' : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  // 獲取所有分類資訊
  const { data: categoriesData } = useSWR<{ categories: CategoryInfo[] }>(
    user ? '/api/telegram/category' : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  // 獲取 homepage 選中的圖片
  const { data: homepageData } = useSWR<{ selectedPhotos: SelectedPhoto[] }>(
    user ? '/api/homepage' : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  const uploadedImages = imagesData?.images || [];
  const categories = categoriesData?.categories || [];
  const selectedPhotos = homepageData?.selectedPhotos || [];

  // 建立 image_id 到分類資訊的對照表（從 slug 陣列中找）
  const categoryMap = new Map<string, { slug: string; variant: 'original' | 'square' }>();
  categories.forEach(category => {
    category.images?.forEach(img => {
      categoryMap.set(img.id, {
        slug: category.slug,
        variant: img.variant,
      });
    });
  });

  // 合併圖片和分類資訊
  const imagesWithCategory: UploadedImageWithCategory[] = uploadedImages.map(img => {
    const category = categoryMap.get(img.id);
    return {
      ...img,
      slug: category?.slug,
      variant: category?.variant,
    };
  });


  // 分類圖片
  const uncategorizedImages = imagesWithCategory.filter(img => !img.slug);
  const categorizedImages = imagesWithCategory.filter(img => img.slug);

  // 按 slug 分組
  const imagesBySlug = categorizedImages.reduce((acc, img) => {
    if (!img.slug) return acc;
    if (!acc[img.slug]) acc[img.slug] = [];
    acc[img.slug].push(img);
    return acc;
  }, {} as Record<string, UploadedImage[]>);

  // 取得所有現有的 slug 列表
  const existingSlugs = categories.map(cat => cat.slug).sort();

  const handleUpdateSlug = async (imageId: string, newSlug: string) => {
    if (!user) return;
    
    // 使用選擇的 slug 或輸入的新 slug
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

      if (!response.ok) {
        throw new Error('Failed to update slug');
      }

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
      // Unpin
      newSelected = selectedPhotos
        .filter(sp => sp.photoId !== imageId)
        .map((sp, index) => ({ ...sp, order: index }));
    } else {
      // Pin
      newSelected = [
        ...selectedPhotos,
        {
          photoId: imageId,
          order: selectedPhotos.length,
        },
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

      if (!response.ok) {
        throw new Error('Failed to batch update slug');
      }

      await mutate('/api/telegram/images');
      await mutate('/api/telegram/category');
      
      // Reset batch mode
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
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
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

  const ImageCard = ({ image }: { image: UploadedImageWithCategory }) => {
    const isEditing = editingImageId === image.id;
    const isPinned = selectedPhotos.some(sp => sp.photoId === image.id);
    const isSelected = selectedImages.has(image.id);

    return (
      <div className="group relative border border-rurikon-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
        {/* Batch Selection Checkbox */}
        {batchMode && (
          <div className="absolute top-2 left-2 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleImageSelection(image.id)}
              className="w-5 h-5 rounded border-gray-300 text-rurikon-600 focus:ring-rurikon-500 cursor-pointer"
            />
          </div>
        )}
        
        {/* Image */}
        <div className="relative aspect-square bg-rurikon-50">
          <Image
            src={image.url}
            alt={image.alt || image.file_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        {/* Info and Actions */}
        <div className="p-4 space-y-3">
          {/* Pin Button - hide in batch mode */}
          {!batchMode && (
            <button
              onClick={() => handlePinToHomepage(image.id)}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isPinned
                  ? 'bg-rurikon-600 text-white hover:bg-rurikon-700'
                  : 'bg-rurikon-100 text-rurikon-700 hover:bg-rurikon-200'
              }`}
            >
              <Pin className="h-4 w-4" />
              <span className="text-sm font-medium">
                {isPinned ? 'Pinned to Homepage' : 'Pin to Homepage'}
              </span>
            </button>
          )}

          {/* Slug Editor - hide in batch mode */}
          {!batchMode && (isEditing ? (
            <div className="space-y-2">
              {/* Dropdown for existing slugs */}
              {existingSlugs.length > 0 && (
                <select
                  value={selectedSlug}
                  onChange={(e) => {
                    setSelectedSlug(e.target.value);
                    if (e.target.value) {
                      setSlugInput(''); // 清空輸入框如果選擇了現有 slug
                    }
                  }}
                  className="w-full px-3 py-2 border border-rurikon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rurikon-500 bg-white"
                >
                  <option value="">-- 選擇現有 slug --</option>
                  {existingSlugs.map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </select>
              )}
              
              {/* Divider text */}
              {existingSlugs.length > 0 && (
                <div className="text-center text-xs text-gray-500">或</div>
              )}
              
              {/* Input for new slug */}
              <input
                type="text"
                value={slugInput}
                onChange={(e) => {
                  setSlugInput(e.target.value);
                  if (e.target.value) {
                    setSelectedSlug(''); // 清空選擇如果輸入了新 slug
                  }
                }}
                placeholder="輸入新的 slug"
                className="w-full px-3 py-2 border border-rurikon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rurikon-500"
                autoFocus={existingSlugs.length === 0}
              />
              
              {/* Variant selector */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Variant</label>
                <select
                  value={variantInput}
                  onChange={(e) => setVariantInput(e.target.value as 'original' | 'square')}
                  className="w-full px-3 py-2 border border-rurikon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rurikon-500 bg-white"
                >
                  <option value="original">Original (預設)</option>
                  <option value="square">Square</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateSlug(image.id, slugInput)}
                  disabled={saving || (!slugInput.trim() && !selectedSlug)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-4 w-4" />
                  <span className="text-sm">儲存</span>
                </button>
                <button
                  onClick={() => {
                    setEditingImageId(null);
                    setSlugInput('');
                    setSelectedSlug('');
                    setVariantInput('original');
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  <X className="h-4 w-4" />
                  <span className="text-sm">取消</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingImageId(image.id);
                setSlugInput(image.slug || '');
                setSelectedSlug('');
                setVariantInput(image.variant || 'original');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rurikon-100 text-rurikon-700 rounded-md hover:bg-rurikon-200 transition-colors"
            >
              <Tag className="h-4 w-4" />
              <span className="text-sm font-medium">
                {image.slug ? `${image.slug} (${image.variant || 'original'})` : '設定分類'}
              </span>
            </button>
          ))}

          {/* File Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <p className="truncate" title={image.file_name}>
              {image.file_name}
            </p>
            <p>{formatDate(image.uploaded_at)}</p>
          </div>
        </div>
      </div>
    );
  };

  if (imagesLoading) {
    return (
      <div className="pb-6 sm:pb-10 md:pb-14">
        <h1 className="font-semibold mb-7 text-rurikon-600">Category Management</h1>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rurikon-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 sm:pb-10 md:pb-14">
      <h1 className="font-semibold mb-7 text-rurikon-600">Category Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-rurikon-200">
          <div className="text-sm text-gray-500">總圖片數</div>
          <div className="text-2xl font-bold text-rurikon-600">{imagesWithCategory.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-rurikon-200">
          <div className="text-sm text-gray-500">未分類</div>
          <div className="text-2xl font-bold text-orange-600">{uncategorizedImages.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-rurikon-200">
          <div className="text-sm text-gray-500">已 Pin 到主頁</div>
          <div className="text-2xl font-bold text-green-600">{selectedPhotos.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-rurikon-200 mb-6">
        <div className="flex gap-4 justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('uncategorized')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'uncategorized'
                  ? 'border-rurikon-600 text-rurikon-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              未分類 ({uncategorizedImages.length})
            </button>
            <button
              onClick={() => setActiveTab('categorized')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'categorized'
                  ? 'border-rurikon-600 text-rurikon-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              已分類 ({categorizedImages.length})
            </button>
          </div>
          
          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) {
                clearSelection();
              }
            }}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              batchMode
                ? 'bg-rurikon-600 text-white hover:bg-rurikon-700'
                : 'bg-rurikon-100 text-rurikon-700 hover:bg-rurikon-200'
            }`}
          >
            {batchMode ? '退出批量模式' : '批量設定'}
          </button>
        </div>
      </div>

      {/* Batch Action Panel */}
      {batchMode && (
        <div className="bg-rurikon-50 border border-rurikon-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-rurikon-700">
                  批量操作 ({selectedImages.size} 張圖片已選擇)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllImages}
                    className="text-sm text-rurikon-600 hover:text-rurikon-700 underline"
                  >
                    全選
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-rurikon-600 hover:text-rurikon-700 underline"
                  >
                    清除
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Existing slug dropdown */}
                {existingSlugs.length > 0 && (
                  <select
                    value={batchSelectedSlug}
                    onChange={(e) => {
                      setBatchSelectedSlug(e.target.value);
                      if (e.target.value) {
                        setBatchSlugInput('');
                      }
                    }}
                    className="px-3 py-2 border border-rurikon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rurikon-500 bg-white"
                  >
                    <option value="">-- 選擇現有 slug --</option>
                    {existingSlugs.map((slug) => (
                      <option key={slug} value={slug}>
                        {slug}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* New slug input */}
                <input
                  type="text"
                  value={batchSlugInput}
                  onChange={(e) => {
                    setBatchSlugInput(e.target.value);
                    if (e.target.value) {
                      setBatchSelectedSlug('');
                    }
                  }}
                  placeholder="或輸入新的 slug"
                  className="px-3 py-2 border border-rurikon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rurikon-500"
                />
                
                {/* Variant selector */}
                <select
                  value={batchVariantInput}
                  onChange={(e) => setBatchVariantInput(e.target.value as 'original' | 'square')}
                  className="px-3 py-2 border border-rurikon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rurikon-500 bg-white"
                >
                  <option value="original">Original (預設)</option>
                  <option value="square">Square</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handleBatchUpdate}
              disabled={saving || selectedImages.size === 0 || (!batchSlugInput.trim() && !batchSelectedSlug)}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap"
            >
              批量更新
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'uncategorized' ? (
        <div>
          {uncategorizedImages.length === 0 ? (
            <div className="text-center py-10">
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">沒有未分類的圖片</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {uncategorizedImages.map((image) => (
                <ImageCard key={image.id} image={image} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(imagesBySlug).length === 0 ? (
            <div className="text-center py-10">
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">沒有已分類的圖片</p>
            </div>
          ) : (
            Object.entries(imagesBySlug).map(([slug, images]) => (
              <div key={slug}>
                <h2 className="text-xl font-semibold text-rurikon-700 mb-4 flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  {slug}
                  <span className="text-sm font-normal text-gray-500">({images.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  );
}
