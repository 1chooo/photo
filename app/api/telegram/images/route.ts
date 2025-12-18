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

// GET: 獲取所有已上傳的圖片
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
      .collection('tg-as-image-storage')
      .orderBy('uploaded_at', 'desc')
      .get();

    const images = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({ images }, { status: 200 });
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}

// DELETE: 刪除指定圖片
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
    const imageId = searchParams.get('id');

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    await db.collection('tg-as-image-storage').doc(imageId).delete();

    return NextResponse.json(
      { success: true, message: "Image deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}

// PUT: 更新圖片資訊（例如：alt text）
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
    const { id, alt } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const docRef = db.collection('tg-as-image-storage').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    await docRef.update({
      alt: alt || '',
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, message: "Image updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating image:", error);
    return NextResponse.json(
      { error: "Failed to update image" },
      { status: 500 }
    );
  }
}
