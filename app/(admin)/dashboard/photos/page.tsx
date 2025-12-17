'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';

interface Photo {
  id: string;
  url: string;
  alt?: string;
  variant?: 'original' | 'square';
  order: number;
  createdAt: string;
}

interface Gallery {
  slug: string;
  photos: Photo[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PhotosManagement() {
  const { data, error, isLoading } = useSWR<{ galleries: Gallery[] }>(
    '/api/photos',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const galleries = data?.galleries || [];
  const [selectedSlug, setSelectedSlug] = useState<string>('');
  const [newSlug, setNewSlug] = useState<string>('');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [newPhotoAlt, setNewPhotoAlt] = useState<string>('');
  const [newPhotoVariant, setNewPhotoVariant] = useState<'original' | 'square'>('original');
  const [loading, setLoading] = useState(false);
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState<string>('');
  const [editingUrl, setEditingUrl] = useState<string>('');
  const [editingVariant, setEditingVariant] = useState<'original' | 'square'>('original');

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim()) return;

    const slugToUse = newSlug.trim() || selectedSlug;
    if (!slugToUse) {
      alert('Please select or enter a slug');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugToUse,
          url: newPhotoUrl.trim(),
          alt: newPhotoAlt.trim(),
          variant: newPhotoVariant,
        }),
      });

      if (response.ok) {
        setNewPhotoUrl('');
        setNewPhotoAlt('');
        setNewPhotoVariant('original');
        setNewSlug('');
        mutate('/api/photos'); // SWR revalidation
        setSelectedSlug(slugToUse);
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      console.error('Error adding photo:', error);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (slug: string, photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const response = await fetch(`/api/photos?slug=${slug}&photoId=${photoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        mutate('/api/photos'); // SWR revalidation
      } else {
        alert('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Delete failed');
    }
  };

  const handleUpdatePhoto = async (slug: string, photoId: string, url: string, alt: string, variant: 'original' | 'square') => {
    try {
      const response = await fetch('/api/photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, photoId, url, alt, variant }),
      });

      if (response.ok) {
        mutate('/api/photos'); // SWR revalidation
        setEditingPhotoId(null);
        setEditingAlt('');
        setEditingUrl('');
        setEditingVariant('original');
      } else {
        alert('Update failed');
      }
    } catch (error) {
      console.error('Error updating photo:', error);
      alert('Update failed');
    }
  };

  const handleDragStart = (photoId: string) => {
    setDraggedPhoto(photoId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetPhotoId: string, slug: string) => {
    e.preventDefault();
    if (!draggedPhoto || draggedPhoto === targetPhotoId) return;

    const gallery = galleries.find(g => g.slug === slug);
    if (!gallery) return;

    const photos = [...gallery.photos];
    const draggedIndex = photos.findIndex(p => p.id === draggedPhoto);
    const targetIndex = photos.findIndex(p => p.id === targetPhotoId);

    const [removed] = photos.splice(draggedIndex, 1);
    photos.splice(targetIndex, 0, removed);

    try {
      const response = await fetch('/api/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, photos }),
      });

      if (response.ok) {
        mutate('/api/photos'); // SWR revalidation
      }
    } catch (error) {
      console.error('Error reordering photos:', error);
    }

    setDraggedPhoto(null);
  };

  const currentGallery = galleries.find(g => g.slug === selectedSlug);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-red-600">Failed to load galleries. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Photo Management</h1>

        {isLoading && (
          <div className="bg-white rounded-lg shadow p-6 mb-8 text-center">
            <p className="text-gray-600">Loading galleries...</p>
          </div>
        )}

        {/* Add Photo Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Photo</h2>
          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Existing Slug
                </label>
                <select
                  value={selectedSlug}
                  onChange={(e) => {
                    setSelectedSlug(e.target.value);
                    setNewSlug('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">-- Select Slug --</option>
                  {galleries.map(gallery => (
                    <option key={gallery.slug} value={gallery.slug}>
                      {gallery.slug} ({gallery.photos.length} photos)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Enter New Slug
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => {
                    setNewSlug(e.target.value);
                    if (e.target.value) setSelectedSlug('');
                  }}
                  placeholder="e.g.: dtla, jioufen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo URL
              </label>
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alt Text (Optional)
              </label>
              <input
                type="text"
                value={newPhotoAlt}
                onChange={(e) => setNewPhotoAlt(e.target.value)}
                placeholder="Describe the photo for accessibility"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variant
              </label>
              <select
                value={newPhotoVariant}
                onChange={(e) => setNewPhotoVariant(e.target.value as 'original' | 'square')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="original">Original (Default)</option>
                <option value="square">Square</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Uploading...' : 'Add Photo'}
            </button>
          </form>
        </div>

        {/* Gallery List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Gallery List</h2>
          
          <div className="space-y-2 mb-6">
            {galleries.map(gallery => (
              <button
                key={gallery.slug}
                onClick={() => setSelectedSlug(gallery.slug)}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                  selectedSlug === gallery.slug
                    ? 'bg-blue-100 text-blue-900 border-2 border-blue-500'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <span className="font-medium">{gallery.slug}</span>
                <span className="ml-2 text-sm text-gray-500">
                  ({gallery.photos.length} photos)
                </span>
              </button>
            ))}
          </div>

          {/* Photos Display */}
          {currentGallery && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                {currentGallery.slug}'s Photos
                <span className="text-sm text-gray-500 ml-2">
                  (Drag photos to reorder)
                </span>
              </h3>
              
              {currentGallery.photos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No photos in this gallery yet</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentGallery.photos
                    .sort((a, b) => a.order - b.order)
                    .map((photo) => (
                      <div
                        key={photo.id}
                        draggable
                        onDragStart={() => handleDragStart(photo.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, photo.id, currentGallery.slug)}
                        className="relative group cursor-move bg-gray-100 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                      >
                        <div className="aspect-square relative">
                          <img
                            src={photo.url}
                            alt={photo.alt || `Photo ${photo.order + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                            #{photo.order + 1}
                          </div>
                          <button
                            onClick={() => handleDeletePhoto(currentGallery.slug, photo.id)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="p-2 bg-white">
                          {editingPhotoId === photo.id ? (
                            <div className="space-y-2">
                              <input
                                type="url"
                                value={editingUrl}
                                onChange={(e) => setEditingUrl(e.target.value)}
                                placeholder="Photo URL"
                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-gray-900"
                              />
                              <input
                                type="text"
                                value={editingAlt}
                                onChange={(e) => setEditingAlt(e.target.value)}
                                placeholder="Alt text"
                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-gray-900"
                              />
                              <select
                                value={editingVariant}
                                onChange={(e) => setEditingVariant(e.target.value as 'original' | 'square')}
                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-gray-900"
                              >
                                <option value="original">Original</option>
                                <option value="square">Square</option>
                              </select>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdatePhoto(currentGallery.slug, photo.id, editingUrl, editingAlt, editingVariant)}
                                  className="flex-1 bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPhotoId(null);
                                    setEditingAlt('');
                                    setEditingUrl('');
                                    setEditingVariant('original');
                                  }}
                                  className="flex-1 bg-gray-300 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-500 truncate mb-1">{photo.url}</p>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-gray-700 truncate flex-1">
                                  {photo.alt ? `${photo.alt}` : 'No alt text'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-600">
                                  Variant: {photo.variant || 'original'}
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingPhotoId(photo.id);
                                    setEditingAlt(photo.alt || '');
                                    setEditingUrl(photo.url);
                                    setEditingVariant(photo.variant || 'original');
                                  }}
                                  className="text-blue-500 hover:text-blue-700 text-xs ml-2"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
