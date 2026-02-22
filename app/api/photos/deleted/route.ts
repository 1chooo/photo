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
 * GET: 查看已刪除的照片列表
 */
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
    const deletedSnapshot = await db
      .collection('deleted-photos')
      .orderBy('deleted_at', 'desc')
      .get();

    const deletedPhotos = deletedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(
      { 
        success: true,
        photos: deletedPhotos,
        count: deletedPhotos.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching deleted photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted photos" },
      { status: 500 }
    );
  }
}
