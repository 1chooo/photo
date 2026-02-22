import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";

// Verify Firebase ID Token
async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}

interface DeletedPhoto {
  id: string;
  url: string;
  file_name?: string;
  alt?: string;
  variant: 'original' | 'square';
  uploaded_at?: string;
  original_slug: string;
  deleted_at: string;
  deleted_by: string;
}

// POST: Batch delete photos with soft delete pattern
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { slug, photoIds } = body;

    if (!slug || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "Slug and photoIds array are required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const docRef = db.collection('telegram-categories').doc(slug);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const images = doc.data()?.images || [];
    const photoIdsSet = new Set(photoIds);
    
    // Separate photos into deleted and remaining
    const photosToDelete: DeletedPhoto[] = [];
    const remainingPhotos = images.filter((img: any) => {
      if (photoIdsSet.has(img.id)) {
        // Prepare deleted photo record
        photosToDelete.push({
          id: img.id,
          url: img.url,
          file_name: img.file_name,
          alt: img.alt,
          variant: img.variant || 'original',
          uploaded_at: img.uploaded_at,
          original_slug: slug,
          deleted_at: new Date().toISOString(),
          deleted_by: user.email || user.uid,
        });
        return false;
      }
      return true;
    });

    if (photosToDelete.length === 0) {
      return NextResponse.json(
        { error: "No matching photos found to delete" },
        { status: 404 }
      );
    }

    // Use batch operation for atomic writes
    const batch = db.batch();

    // 1. Save deleted photos to 'deleted-photos' collection
    for (const deletedPhoto of photosToDelete) {
      const deletedDocRef = db.collection('deleted-photos').doc(deletedPhoto.id);
      batch.set(deletedDocRef, deletedPhoto);
    }

    // 2. Update or delete the category
    if (remainingPhotos.length === 0) {
      // If no photos left, delete the entire category
      batch.delete(docRef);
    } else {
      // Update with remaining photos
      batch.update(docRef, {
        images: remainingPhotos,
        updatedAt: new Date().toISOString(),
      });
    }

    // Commit all operations atomically
    await batch.commit();

    return NextResponse.json(
      { 
        success: true, 
        message: `${photosToDelete.length} photo(s) deleted successfully`,
        deletedCount: photosToDelete.length,
        remainingCount: remainingPhotos.length,
        categoryDeleted: remainingPhotos.length === 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error batch deleting photos:", error);
    return NextResponse.json(
      { error: "Failed to delete photos" },
      { status: 500 }
    );
  }
}
