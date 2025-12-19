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

// POST: 批量更新多張圖片的 slug
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
    const { imageIds, slug, variant } = body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: "Image IDs array is required" },
        { status: 400 }
      );
    }

    if (!slug || slug.trim() === '') {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const finalSlug = slug.trim();
    const finalVariant = variant || 'original';

    // 驗證所有圖片存在
    const imageRefs = imageIds.map(id => db.collection('tg-as-image-storage').doc(id));
    const imageDocs = await db.getAll(...imageRefs);
    
    const notFoundImages = imageDocs
      .filter(doc => !doc.exists)
      .map(doc => doc.id);
    
    if (notFoundImages.length > 0) {
      return NextResponse.json(
        { 
          error: "Some images not found",
          notFoundImages 
        },
        { status: 404 }
      );
    }

    // 取得目標 slug 的 document
    const slugRef = db.collection('telegram-categories').doc(finalSlug);
    const slugDoc = await slugRef.get();

    // 收集要更新的圖片資料
    const photosToAdd = imageDocs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        url: data?.url || '',
        file_name: data?.file_name || '',
        alt: data?.alt || '',
        variant: finalVariant,
        uploaded_at: data?.uploaded_at || new Date().toISOString(),
      };
    });

    // 更新或創建 category document
    if (slugDoc.exists) {
      // 現有分類，合併圖片
      const existingData = slugDoc.data();
      const existingImages = existingData?.images || [];
      
      // 建立現有圖片的 ID set 來避免重複
      const existingImageIds = new Set(existingImages.map((img: any) => img.id));
      
      // 只添加新的圖片
      const newImages = photosToAdd.filter(photo => !existingImageIds.has(photo.id));
      
      if (newImages.length > 0) {
        await slugRef.update({
          images: [...existingImages, ...newImages],
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      // 新分類，創建新的 document
      await slugRef.set({
        slug: finalSlug,
        images: photosToAdd,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 從其他分類中移除這些圖片
    const allCategories = await db.collection('telegram-categories').get();
    const updatePromises: Promise<any>[] = [];

    allCategories.forEach(categoryDoc => {
      if (categoryDoc.id === finalSlug) return; // 跳過目標分類
      
      const categoryData = categoryDoc.data();
      const images = categoryData.images || [];
      
      // 過濾掉要移動的圖片
      const filteredImages = images.filter((img: any) => !imageIds.includes(img.id));
      
      // 如果有圖片被移除，更新該分類
      if (filteredImages.length !== images.length) {
        updatePromises.push(
          categoryDoc.ref.update({
            images: filteredImages,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json(
      { 
        success: true, 
        message: `Successfully updated ${imageIds.length} images to slug: ${finalSlug}`,
        updatedCount: imageIds.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in batch update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
