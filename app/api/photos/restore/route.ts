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

/**
 * POST: 恢復已刪除的照片
 * - 從 deleted-photos 讀取資料
 * - 恢復到 tg-as-image-storage
 * - 可選：恢復到原來的分類和首頁釘選
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
    const { photoIds, restoreCategories = true, restorePin = true } = body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "photoIds array is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const batch = db.batch();
    const restoredPhotos: any[] = [];
    const notFoundIds: string[] = [];

    for (const photoId of photoIds) {
      // 1. 從 deleted-photos 獲取資料
      const deletedPhotoRef = db.collection('deleted-photos').doc(photoId);
      const deletedPhotoDoc = await deletedPhotoRef.get();

      if (!deletedPhotoDoc.exists) {
        notFoundIds.push(photoId);
        continue;
      }

      const deletedData = deletedPhotoDoc.data();
      if (!deletedData) continue;

      // 2. 準備恢復的資料（移除刪除相關欄位）
      const {
        original_categories,
        was_pinned,
        deleted_at,
        deleted_by,
        ...imageData
      } = deletedData;

      // 3. 恢復到 tg-as-image-storage（過濾掉 undefined 值）
      const imageRef = db.collection('tg-as-image-storage').doc(photoId);
      const restoreData = {
        ...imageData,
        restored_at: new Date().toISOString(),
        restored_by: user.email || user.uid,
      };
      
      // 過濾掉 undefined 值以避免 Firestore 錯誤
      const cleanedRestoreData = Object.fromEntries(
        Object.entries(restoreData).filter(([_, value]) => value !== undefined)
      );
      
      batch.set(imageRef, cleanedRestoreData);

      // 4. 可選：恢復到原來的分類
      if (restoreCategories && original_categories && original_categories.length > 0) {
        for (const categorySlug of original_categories) {
          const categoryRef = db.collection('telegram-categories').doc(categorySlug);
          const categoryDoc = await categoryRef.get();

          const photoData = {
            id: photoId,
            url: imageData.url,
            file_name: imageData.file_name,
            alt: imageData.alt || '',
            variant: 'original',
            uploaded_at: imageData.uploaded_at,
          };

          if (categoryDoc.exists) {
            const existingImages = categoryDoc.data()?.images || [];
            // 檢查是否已存在（避免重複）
            const alreadyExists = existingImages.some((img: any) => img.id === photoId);
            if (!alreadyExists) {
              batch.update(categoryRef, {
                images: [...existingImages, photoData],
                updatedAt: new Date().toISOString(),
              });
            }
          } else {
            // 如果分類不存在，重新創建
            batch.set(categoryRef, {
              slug: categorySlug,
              images: [photoData],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 5. 可選：恢復首頁釘選
      if (restorePin && was_pinned) {
        const homePinRef = db.collection('home-pin').doc(photoId);
        batch.set(homePinRef, {
          photoId: photoId,
          order: 999, // 恢復時放到最後，需要手動調整順序
          updated_at: new Date().toISOString(),
        });
      }

      // 6. 從 deleted-photos 刪除
      batch.delete(deletedPhotoRef);

      restoredPhotos.push({
        id: photoId,
        restoredToCategories: restoreCategories ? original_categories : [],
        restoredToPin: restorePin && was_pinned,
      });
    }

    if (restoredPhotos.length === 0) {
      return NextResponse.json(
        { 
          error: "No photos found in trash to restore",
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
        message: `${restoredPhotos.length} photo(s) restored successfully`,
        restoredCount: restoredPhotos.length,
        restoredPhotos,
        notFoundIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error restoring photos:", error);
    return NextResponse.json(
      { error: "Failed to restore photos" },
      { status: 500 }
    );
  }
}
