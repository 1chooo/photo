import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";

// 驗證 Firebase ID Token
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

interface DeletedPhotoData {
  id: string;
  url?: string;
  file_id?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
  alt?: string;
  category?: string;
  uploaded_at?: string;
  original_categories: string[]; // All categories this photo belonged to
  was_pinned: boolean; // Whether it was in home-pin
  deleted_at: string;
  deleted_by: string;
}

/**
 * POST: 軟刪除照片（第一階段）
 * - 從 tg-as-image-storage 移除
 * - 從所有 telegram-categories 移除
 * - 從 home-pin 移除（如果存在）
 * - 移到 deleted-photos
 */
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
    const { photoIds } = body; // 支援批次刪除

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "photoIds array is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const batch = db.batch();
    const deletedPhotos: DeletedPhotoData[] = [];
    const notFoundIds: string[] = [];
    const photoIdsSet = new Set(photoIds);

    // 先獲取所有分類資料（避免循環中重複查詢導致的衝突）
    const categoriesSnapshot = await db.collection('telegram-categories').get();
    const categoryUpdates = new Map<string, { ref: any; images: any[] }>();

    // 初始化 category 數據到 Map 中
    categoriesSnapshot.docs.forEach(categoryDoc => {
      categoryUpdates.set(categoryDoc.id, {
        ref: categoryDoc.ref,
        images: [...(categoryDoc.data().images || [])]
      });
    });

    // 處理每張照片
    for (const photoId of photoIds) {
      // 1. 從 tg-as-image-storage 獲取完整照片資料
      const imageRef = db.collection('tg-as-image-storage').doc(photoId);
      const imageDoc = await imageRef.get();

      if (!imageDoc.exists) {
        notFoundIds.push(photoId);
        continue;
      }

      const imageData = imageDoc.data();
      const originalCategories: string[] = [];
      
      // 2. 從內存中的分類數據中移除此照片
      for (const [categorySlug, categoryInfo] of categoryUpdates.entries()) {
        const photoIndex = categoryInfo.images.findIndex((img: any) => img.id === photoId);
        
        if (photoIndex !== -1) {
          originalCategories.push(categorySlug);
          // 從內存中的 images 陣列移除此照片
          categoryInfo.images.splice(photoIndex, 1);
        }
      }

      // 3. 檢查是否在 home-pin 中
      const homePinRef = db.collection('home-pin').doc(photoId);
      const homePinDoc = await homePinRef.get();
      const wasPinned = homePinDoc.exists;
      
      if (wasPinned) {
        batch.delete(homePinRef);
      }

      // 4. 準備刪除資料（過濾掉 undefined 值）
      const deletedPhotoData: DeletedPhotoData = {
        id: photoId,
        url: imageData?.url,
        file_id: imageData?.file_id,
        file_name: imageData?.file_name,
        file_size: imageData?.file_size,
        width: imageData?.width,
        height: imageData?.height,
        alt: imageData?.alt,
        category: imageData?.category,
        uploaded_at: imageData?.uploaded_at,
        original_categories: originalCategories,
        was_pinned: wasPinned,
        deleted_at: new Date().toISOString(),
        deleted_by: user.email || user.uid,
      };

      // 過濾掉 undefined 值以避免 Firestore 錯誤
      const cleanedData = Object.fromEntries(
        Object.entries(deletedPhotoData).filter(([_, value]) => value !== undefined)
      );

      deletedPhotos.push(deletedPhotoData);

      // 5. 寫入 deleted-photos
      const deletedDocRef = db.collection('deleted-photos').doc(photoId);
      batch.set(deletedDocRef, cleanedData);

      // 6. 從 tg-as-image-storage 刪除
      batch.delete(imageRef);
    }

    // 7. 批次更新所有受影響的分類
    for (const [categorySlug, categoryInfo] of categoryUpdates.entries()) {
      if (categoryInfo.images.length === 0) {
        // 如果分類沒有照片了，刪除整個分類
        batch.delete(categoryInfo.ref);
      } else {
        // 只更新有變化的分類（即原本有被刪除的照片）
        const originalImages = categoriesSnapshot.docs
          .find(doc => doc.id === categorySlug)
          ?.data().images || [];
        
        if (originalImages.length !== categoryInfo.images.length) {
          batch.update(categoryInfo.ref, {
            images: categoryInfo.images,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (deletedPhotos.length === 0) {
      return NextResponse.json(
        { 
          error: "No photos found to delete",
          notFoundIds 
        },
        { status: 404 }
      );
    }

    // 執行批次操作
    await batch.commit();

    return NextResponse.json(
      { 
        success: true, 
        message: `${deletedPhotos.length} photo(s) moved to trash`,
        deletedCount: deletedPhotos.length,
        deletedPhotos: deletedPhotos.map(p => ({
          id: p.id,
          categories: p.original_categories,
          wasPinned: p.was_pinned,
        })),
        notFoundIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error soft deleting photos:", error);
    return NextResponse.json(
      { error: "Failed to delete photos" },
      { status: 500 }
    );
  }
}
