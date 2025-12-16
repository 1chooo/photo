export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export type GalleryItemSize = 'full' | 'half';

export interface GalleryLayoutItem {
  size: GalleryItemSize;
}

export type GalleryLayoutColumn = GalleryLayoutItem[];

export interface GalleryLayout {
  columns: GalleryLayoutColumn[];
}
