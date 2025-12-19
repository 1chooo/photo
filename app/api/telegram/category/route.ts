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

// PUT: 更新圖片的 slug（分類）
export async function PUT(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, slug, variant } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    
    // 驗證圖片存在
    const imageRef = db.collection('tg-as-image-storage').doc(id);
    const imageDoc = await imageRef.get();

    if (!imageDoc.exists) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    const imageData = imageDoc.data();

    // 如果有新的 slug，處理分類
    if (slug && slug.trim() !== '') {
      const newSlug = slug.trim();
      
      // 取得新 slug 的 document
      const newSlugRef = db.collection('telegram-categories').doc(newSlug);
      const newSlugDoc = await newSlugRef.get();

      // 建立圖片物件
      const photoData = {
        id: id,
        url: imageData?.url,
        file_name: imageData?.file_name,
        alt: imageData?.alt || '',
        variant: variant || 'original',
        uploaded_at: imageData?.uploaded_at,
      };

      // 檢查是否已經在其他 slug 中
      const allSlugsSnapshot = await db.collection('telegram-categories').get();
      for (const doc of allSlugsSnapshot.docs) {
        const data = doc.data();
        const images = data.images || [];
        const existingIndex = images.findIndex((img: any) => img.id === id);
        
        if (existingIndex !== -1) {
          if (doc.id === newSlug) {
            // 同一個 slug，只更新 variant
            images[existingIndex] = photoData;
            await doc.ref.update({
              images: images,
              updatedAt: new Date().toISOString(),
            });
            return NextResponse.json(
              { success: true, message: "Image updated in same category" },
              { status: 200 }
            );
          } else {
            // 從舊 slug 移除
            images.splice(existingIndex, 1);
            await doc.ref.update({
              images: images,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 加到新 slug
      if (newSlugDoc.exists) {
        const existingImages = newSlugDoc.data()?.images || [];
        await newSlugRef.update({
          images: [...existingImages, photoData],
          updatedAt: new Date().toISOString(),
        });
      } else {
        await newSlugRef.set({
          slug: newSlug,
          images: [photoData],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      // 如果 slug 是空的，從所有 slug 中移除這張圖片
      const allSlugsSnapshot = await db.collection('telegram-categories').get();
      for (const doc of allSlugsSnapshot.docs) {
        const data = doc.data();
        const images = data.images || [];
        const filteredImages = images.filter((img: any) => img.id !== id);
        
        if (filteredImages.length !== images.length) {
          if (filteredImages.length === 0) {
            // 如果沒有圖片了，刪除整個 document
            await doc.ref.delete();
          } else {
            await doc.ref.update({
              images: filteredImages,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Image category updated successfully",
        slug: slug && slug.trim() !== '' ? slug.trim() : null,
        variant: variant || 'original'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating image category:", error);
    return NextResponse.json(
      { error: "Failed to update image category" },
      { status: 500 }
    );
  }
}

// GET: 獲取所有分類資訊
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const db = getAdminDb();
    const snapshot = await db
      .collection('telegram-categories')
      .orderBy('updatedAt', 'desc')
      .get();

    const categories = snapshot.docs.map(doc => ({
      slug: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
