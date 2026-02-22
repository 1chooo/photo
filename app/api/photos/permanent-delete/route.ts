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
 * DELETE: 永久刪除照片（第二階段）
 * - 從 deleted-photos 永久刪除
 * - 未來可擴展：刪除實體檔案
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const photoIdsParam = searchParams.get('photoIds');

    if (!photoIdsParam) {
      return NextResponse.json(
        { error: "photoIds parameter is required" },
        { status: 400 }
      );
    }

    // 支援多個 ID，以逗號分隔
    const photoIds = photoIdsParam.split(',').map(id => id.trim()).filter(id => id);

    if (photoIds.length === 0) {
      return NextResponse.json(
        { error: "At least one photo ID is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const batch = db.batch();
    const permanentlyDeletedIds: string[] = [];
    const notFoundIds: string[] = [];

    for (const photoId of photoIds) {
      const deletedPhotoRef = db.collection('deleted-photos').doc(photoId);
      const deletedPhotoDoc = await deletedPhotoRef.get();

      if (!deletedPhotoDoc.exists) {
        notFoundIds.push(photoId);
        continue;
      }

      // 永久刪除
      batch.delete(deletedPhotoRef);
      permanentlyDeletedIds.push(photoId);

      // TODO: 未來可以在這裡加上刪除實體檔案的邏輯
      // 例如從 Cloudflare R2 或其他儲存服務刪除
    }

    if (permanentlyDeletedIds.length === 0) {
      return NextResponse.json(
        { 
          error: "No photos found in trash to permanently delete",
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
        message: `${permanentlyDeletedIds.length} photo(s) permanently deleted`,
        deletedCount: permanentlyDeletedIds.length,
        deletedIds: permanentlyDeletedIds,
        notFoundIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error permanently deleting photos:", error);
    return NextResponse.json(
      { error: "Failed to permanently delete photos" },
      { status: 500 }
    );
  }
}
